import { UploadZone } from '@/components/upload/UploadZone'
import { PageHeader, PageShell } from '@/components/ui/surface'

export const metadata = { title: 'Upload Document | SBC Files' }

export default function UploadPage() {
  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        eyebrow="Secure Intake"
        title="Upload Document"
        description="Files are validated, encrypted and processed into secure previews. Originals are never exposed directly to recipients."
      />
      <UploadZone />
    </PageShell>
  )
}
