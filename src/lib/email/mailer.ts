import nodemailer from 'nodemailer'

function getTransport() {
  if (!process.env.SMTP_HOST) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const isLocalHttp =
      appUrl.startsWith('http://localhost') || appUrl.startsWith('http://127.0.0.1')

    if (process.env.NODE_ENV !== 'production' || isLocalHttp) return null
    throw new Error('SMTP_HOST is required in production')
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  })
}

const FROM = process.env.SMTP_FROM ?? 'SBC Files <noreply@sbcfiles.io>'

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const transport = getTransport()
  if (!transport) {
    console.info(`[email:dev] OTP for ${email}: ${code}`)
    return
  }

  await transport.sendMail({
    from: FROM,
    to: email,
    subject: 'Your SBC Files Access Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#0f172a">Secure Document Access</h2>
        <p>Your one-time access code is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#6366f1;padding:16px 0">${code}</div>
        <p style="color:#64748b;font-size:14px">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  })
}

export async function sendShareEmail(
  to: string,
  senderName: string,
  documentTitle: string,
  shareUrl: string,
  message?: string,
): Promise<void> {
  const transport = getTransport()
  if (!transport) {
    console.info(`[email:dev] Share email to ${to}: ${shareUrl}`)
    return
  }

  await transport.sendMail({
    from: FROM,
    to,
    subject: `${senderName} shared a document with you`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#0f172a">${senderName} shared "${documentTitle}" with you</h2>
        ${message ? `<p style="color:#334155">${message}</p>` : ''}
        <a href="${shareUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">
          View Document Securely
        </a>
        <p style="color:#94a3b8;font-size:12px">This link may be protected by OTP and expiration policies set by the sender.</p>
      </div>
    `,
  })
}

export async function sendAccessRevokedEmail(to: string, documentTitle: string): Promise<void> {
  const transport = getTransport()
  if (!transport) {
    console.info(`[email:dev] Access revoked email to ${to}: ${documentTitle}`)
    return
  }

  await transport.sendMail({
    from: FROM,
    to,
    subject: `Access revoked: "${documentTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#0f172a">Access Revoked</h2>
        <p>Your access to <strong>${documentTitle}</strong> has been revoked by the document owner.</p>
      </div>
    `,
  })
}
