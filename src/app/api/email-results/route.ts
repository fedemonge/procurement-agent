import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { EmailRequestSchema } from '@/lib/validators'
import { sendEmail } from '@/lib/mailer'
import { generateExcel } from '@/lib/excel'
import { buildPdfHtml } from '@/lib/templates/pdf-report'
import { buildOwnerAlertHtml, buildUserResultsHtml } from '@/lib/templates/email-alert'

export const maxDuration = 60

async function processAndSend(
  userName: string,
  userEmail: string,
  searchRequest: Parameters<typeof buildPdfHtml>[1],
  suppliers: Parameters<typeof buildPdfHtml>[0]
) {
  try {
    console.log(`[EMAIL] Starting PDF+Excel generation for ${userEmail}`)

    // Generate Excel
    const excelBuffer = await generateExcel(suppliers, searchRequest)

    // Generate PDF (HTML string — we send as HTML attachment since no puppeteer on free tier)
    const pdfHtml = buildPdfHtml(suppliers, searchRequest)

    // Send to user
    await sendEmail({
      to: userEmail,
      subject: `Your Procurement Report — ${suppliers.length} supplier(s) found`,
      html: buildUserResultsHtml(userName, suppliers.length),
      attachments: [
        {
          filename: `procurement-report-${Date.now()}.html`,
          content: Buffer.from(pdfHtml, 'utf-8'),
          contentType: 'text/html',
        },
        {
          filename: `procurement-suppliers-${Date.now()}.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    })

    // Alert owner
    const ownerAlertHtml = buildOwnerAlertHtml(userName, userEmail, searchRequest, suppliers.length)
    await sendEmail({
      to: process.env.OWNER_EMAIL || 'fede@fedemongeconsulting.com',
      subject: `🔔 New Procurement Search — ${userName} (${suppliers.length} suppliers)`,
      html: ownerAlertHtml,
    })

    console.log(`[EMAIL] Done for ${userEmail}`)
  } catch (err) {
    console.error('[EMAIL] Background processing error:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = EmailRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { userName, userEmail, searchRequest, suppliers } = parsed.data

    // Return immediately — process in background
    waitUntil(processAndSend(userName, userEmail, searchRequest, suppliers))

    return NextResponse.json({
      success: true,
      message: `Your report is being prepared and will be emailed to ${userEmail} shortly.`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[EMAIL-RESULTS] Error:', msg)
    return NextResponse.json({ error: 'Failed to queue email.' }, { status: 500 })
  }
}
