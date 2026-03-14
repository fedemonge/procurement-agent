import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
}): Promise<boolean> {
  try {
    const transporter = createTransporter()
    const result = await transporter.sendMail({
      from: `"Federico Monge Consulting" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    })
    console.log(`[MAILER] SENT: ${params.subject} → ${params.to} (${result.messageId})`)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[MAILER] FAILED: ${params.subject} → ${params.to} — ${msg}`)
    return false
  }
}
