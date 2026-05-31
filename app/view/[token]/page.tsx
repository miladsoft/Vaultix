import { hashToken } from '@/lib/crypto/encryption'
import { prisma } from '@/lib/db/client'
import { SecureViewer } from '@/components/viewer/SecureViewer'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ email?: string; name?: string }>
}

export const metadata: Metadata = {
  title: 'Secure Document | SBC Files',
  robots: 'noindex, nofollow',
}

export default async function ViewPage({ params, searchParams }: Props) {
  const { token } = await params
  const { email, name } = await searchParams

  const hashedToken = hashToken(token)

  const share = await prisma.share.findUnique({
    where: { token: hashedToken },
    include: {
      document: {
        select: { id: true, title: true, pageCount: true, status: true },
      },
    },
  })

  if (!share) return notFound()

  if (share.status === 'REVOKED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center text-white p-8">
          <h1 className="text-2xl font-bold mb-2">Access Revoked</h1>
          <p className="text-slate-400">The owner has revoked access to this document.</p>
        </div>
      </div>
    )
  }

  if (share.expiresAt && share.expiresAt < new Date()) {
    await prisma.share.update({ where: { id: share.id }, data: { status: 'EXPIRED' } }).catch(() => {})
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center text-white p-8">
          <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
          <p className="text-slate-400">This document link is no longer valid.</p>
        </div>
      </div>
    )
  }

  if (share.maxViews !== null && share.currentViews >= share.maxViews) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center text-white p-8">
          <h1 className="text-2xl font-bold mb-2">View Limit Reached</h1>
          <p className="text-slate-400">This document link has reached its maximum number of views.</p>
        </div>
      </div>
    )
  }

  if (share.document.status !== 'READY') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center text-white p-8">
          <h1 className="text-2xl font-bold mb-2">Processing</h1>
          <p className="text-slate-400">This document is still being prepared. Please try again shortly.</p>
        </div>
      </div>
    )
  }

  await prisma.share.update({
    where: { id: share.id },
    data: { currentViews: { increment: 1 } },
  })

  return (
    <SecureViewer
      document={{
        id: share.document.id,
        title: share.document.title,
        pageCount: share.document.pageCount,
        allowDownload: share.allowDownload,
        allowPrint: share.allowPrint,
        allowCopy: share.allowCopy,
        showWatermark: share.showWatermark,
      }}
      token={token}
      email={email}
      name={name}
    />
  )
}
