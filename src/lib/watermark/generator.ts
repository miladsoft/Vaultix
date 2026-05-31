import sharp from 'sharp'
import type { WatermarkConfig } from '@/types'

export async function applyWatermark(pageBuffer: Buffer, config: WatermarkConfig): Promise<Buffer> {
  const meta = await sharp(pageBuffer).metadata()
  const width = meta.width ?? 800
  const height = meta.height ?? 1100

  if (width === 0 || height === 0) throw new Error('Invalid page dimensions')

  const text = [
    config.text,
    config.email,
    `IP: ${config.ip}`,
    config.timestamp,
    `Session: ${config.sessionId.slice(0, 8)}`,
  ].join(' • ')

  // Clamp opacity — 0.2 minimum so JPEG compression doesn't erase the watermark
  const opacity = Math.max(0.2, Math.min(0.5, config.opacity))

  const rows = Math.ceil(height / 120) + 2
  const cols = Math.ceil(width / 300) + 2
  let textElements = ''

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const x = col * 300 + (row % 2 === 0 ? 0 : 150)
      const y = row * 120
      // Use fill + fill-opacity (proper SVG spec), NOT CSS rgba().
      // Some librsvg versions on Alpine/musl silently ignore CSS rgba() fill,
      // rendering the text as fully transparent — producing watermark-free output
      // without any error, which bypasses all retry logic.
      textElements += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="12" fill="#646464" fill-opacity="${opacity}" transform="rotate(-30 ${x} ${y})">${escapeXml(text)}</text>`
    }
  }

  // No leading whitespace — older libvips/librsvg versions use buffer-sniffing
  // to detect SVG format and can fail to detect it when the buffer starts with whitespace.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${textElements}</svg>`
  const svgBuffer = Buffer.from(svg)

  // Pre-rasterize SVG → PNG before compositing.
  // Direct SVG composite can silently produce wrong output when librsvg is
  // unavailable or behaves differently across Alpine Docker environments.
  // A pre-rasterized PNG is always reliably handled by Sharp's compositor.
  const watermarkPng = await sharp(svgBuffer).png().toBuffer()

  const result = await sharp(pageBuffer)
    .composite([{ input: watermarkPng, top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer()

  // Sanity check: if output is identical to input the watermark was silently dropped
  if (result.equals(pageBuffer)) {
    throw new Error('Watermark composite produced no change — SVG rendering may have failed')
  }

  return result
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildWatermarkText(
  recipientName: string,
  recipientEmail: string,
  ip: string,
  sessionId: string,
): WatermarkConfig {
  return {
    text: recipientName || 'Confidential',
    email: recipientEmail,
    ip,
    timestamp: new Date().toISOString(),
    sessionId,
    opacity: 0.2,
  }
}
