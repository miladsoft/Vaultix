/**
 * PDF Processing Worker
 *
 * Converts PDF pages to secure JPEG images and stores them in S3.
 * Runs as a standalone Node.js process. Requires Node 20+ (use Docker).
 * Sharp is used for image processing; pdf2pic wraps Ghostscript/GraphicsMagick.
 */

import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink, mkdir, rm, readdir } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, extname, join } from 'path'

const execFileAsync = promisify(execFile)

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? '', 'hex')
const ALGORITHM = 'aes-256-gcm'
const BUCKET = process.env.S3_BUCKET!

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null })
const prisma = new PrismaClient()
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
})

function decryptKey(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

function encryptKey(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

async function downloadFromS3(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function uploadPageToS3(key: string, buffer: Buffer): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
    }),
  )
}

async function convertOfficeToPdf(inputPath: string, outputDir: string): Promise<string> {
  await execFileAsync(
    'soffice',
    [
      '--headless',
      '--nologo',
      '--nofirststartwizard',
      '--nodefault',
      '--norestore',
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      inputPath,
    ],
    { timeout: 120_000 },
  )

  const expected = join(outputDir, `${basename(inputPath, extname(inputPath))}.pdf`)
  const files = await readdir(outputDir)
  const converted = files.find((file) => file.toLowerCase().endsWith('.pdf'))

  return converted ? join(outputDir, converted) : expected
}

async function convertPdfPageToImage(
  pdfPath: string,
  page: number,
  outputDir: string,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const outputPath = join(outputDir, `page-${page}.jpg`)

  // Use Ghostscript to render PDF page to JPEG at 150 DPI
  await execFileAsync('gs', [
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    `-dFirstPage=${page}`,
    `-dLastPage=${page}`,
    '-sDEVICE=jpeg',
    '-r150',
    '-dJPEGQ=85',
    `-sOutputFile=${outputPath}`,
    pdfPath,
  ])

  const buffer = await readFile(outputPath)

  // Get dimensions with sharp
  const sharp = (await import('sharp')).default
  const meta = await sharp(buffer).metadata()

  await unlink(outputPath).catch(() => {})

  return {
    buffer,
    width: meta.width ?? 1200,
    height: meta.height ?? 1600,
  }
}

async function getPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync('gs', [
    '-dNOPAUSE',
    '-dBATCH',
    '-dNODISPLAY',
    '-q',
    `-sFileName=${pdfPath}`,
    '-c',
    'FileName (r) file runpdfbegin pdfpagecount = quit',
  ])
  return parseInt(stdout.trim()) || 1
}

const worker = new Worker(
  'pdf-processing',
  async (job) => {
    const { documentId, storageKey, mimeType } = job.data

    console.log(`[worker] Processing document ${documentId}`)

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    })

    try {
      const rawKey = decryptKey(storageKey)
      const fileBuffer = await downloadFromS3(rawKey)

      const tmpDir = join(tmpdir(), `sbcfiles-${documentId}`)
      await mkdir(tmpDir, { recursive: true })

      let pageCount = 1

      if (
        mimeType === 'application/pdf' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        let pdfPath = join(tmpDir, 'document.pdf')

        if (mimeType === 'application/pdf') {
          await writeFile(pdfPath, fileBuffer)
        } else {
          const extension = mimeType.includes('spreadsheetml') ? 'xlsx' : 'docx'
          const officePath = join(tmpDir, `document.${extension}`)
          await writeFile(officePath, fileBuffer)
          pdfPath = await convertOfficeToPdf(officePath, tmpDir)
        }

        pageCount = await getPageCount(pdfPath)

        for (let page = 1; page <= pageCount; page++) {
          await job.updateProgress(Math.floor((page / pageCount) * 90))

          const { buffer, width, height } = await convertPdfPageToImage(pdfPath, page, tmpDir)

          const pageStorageKey = `pages/${documentId}/page-${page}.jpg`
          const encryptedPageKey = encryptKey(pageStorageKey)

          await uploadPageToS3(pageStorageKey, buffer)

          await prisma.documentPage.upsert({
            where: { documentId_pageNumber: { documentId, pageNumber: page } },
            create: {
              documentId,
              pageNumber: page,
              storageKey: encryptedPageKey,
              width,
              height,
              fileSize: buffer.length,
              isRendered: true,
            },
            update: {
              storageKey: encryptedPageKey,
              width,
              height,
              fileSize: buffer.length,
              isRendered: true,
            },
          })
        }

        await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      } else {
        // For images: store as-is with a single page
        const sharp = (await import('sharp')).default
        const meta = await sharp(fileBuffer).metadata()
        const jpegBuffer = await sharp(fileBuffer).jpeg({ quality: 90 }).toBuffer()

        const pageStorageKey = `pages/${documentId}/page-1.jpg`
        const encryptedPageKey = encryptKey(pageStorageKey)

        await uploadPageToS3(pageStorageKey, jpegBuffer)

        await prisma.documentPage.upsert({
          where: { documentId_pageNumber: { documentId, pageNumber: 1 } },
          create: {
            documentId,
            pageNumber: 1,
            storageKey: encryptedPageKey,
            width: meta.width ?? 1200,
            height: meta.height ?? 1600,
            fileSize: jpegBuffer.length,
            isRendered: true,
          },
          update: {
            storageKey: encryptedPageKey,
            width: meta.width ?? 1200,
            height: meta.height ?? 1600,
            fileSize: jpegBuffer.length,
            isRendered: true,
          },
        })
        pageCount = 1
      }

      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'READY', pageCount },
      })

      console.log(`[worker] Document ${documentId} processed: ${pageCount} pages`)
    } catch (error) {
      console.error(`[worker] Failed to process ${documentId}:`, error)
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          pages: { deleteMany: {} },
        },
      })
      throw error
    }
  },
  { connection, concurrency: 3 },
)

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message)
})

console.log('[worker] PDF processor started')
