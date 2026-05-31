import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Clock } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { ShareForm } from './ShareForm'
import { PageHeader, PageShell, Surface } from '@/components/ui/surface'

export const metadata = { title: 'Share Document | SBC Files' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function SharePage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  const doc = await prisma.document.findFirst({
    where: { id, deletedAt: null, userId: session.sub },
    select: { id: true, title: true, status: true },
  })

  if (!doc) return notFound()

  return (
    <PageShell className="max-w-6xl">
      <div className="mb-5">
        <Link href={`/documents/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-300 focus-ring">
          <ArrowLeft className="h-4 w-4" />
          Back to document
        </Link>
      </div>

      <PageHeader
        eyebrow="Secure Sharing"
        title="Share Document"
        description={`Configure recipient identity, permissions and access limits for "${doc.title}".`}
      />

      {doc.status !== 'READY' ? (
        <Surface className="mx-auto max-w-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20">
            <Clock className="h-7 w-7" />
          </div>
          <p className="font-semibold text-amber-300">Document is still processing</p>
          <p className="mt-2 text-sm text-slate-500">Please wait until status is READY before sharing.</p>
        </Surface>
      ) : (
        <ShareForm documentId={doc.id} documentTitle={doc.title} />
      )}
    </PageShell>
  )
}
