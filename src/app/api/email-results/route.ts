import { NextRequest, NextResponse } from 'next/server'
import { EmailRequestSchema } from '@/lib/validators'
import { sendEmail } from '@/lib/mailer'
import { generateExcel } from '@/lib/excel'
import { buildPdfHtml } from '@/lib/templates/pdf-report'
import { buildOwnerAlertHtml, buildUserResultsHtml } from '@/lib/templates/email-alert'

export const dynamic = 'force-dynamic'

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
    console.log(`[EMAIL] Processing for ${userEmail} — ${suppliers.length} suppliers`)

    // Generate Excel
    const excelBuffer = await generateExcel(suppliers, searchRequest)
    console.log(`[EMAIL] Excel generated (${excelBuffer.length} bytes)`)

    // Build report HTML
    const pdfHtml = buildPdfHtml(suppliers, searchRequest)

    // Send to user
    const ts = Date.now()
    await sendEmail({
      to: userEmail,
      subject: `Your Procurement Report — ${suppliers.length} supplier(s) found`,
      html: buildUserResultsHtml(userName, suppliers.length),
      attachments: [
        {
          filename: `procurement-report-${ts}.html`,
          content: Buffer.from(pdfHtml, 'utf-8'),
          contentType: 'text/html',
        },
        {
          filename: `procurement-suppliers-${ts}.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    })

    // Alert owner (fire and forget — don't block user response)
    sendEmail({
      to: process.env.OWNER_EMAIL || 'fede@fedemongeconsulting.com',
      subject: `New Procurement Search — ${userName} (${suppliers.length} suppliers)`,
      html: buildOwnerAlertHtml(userName, userEmail, searchRequest, suppliers.length),
    }).catch((err) => console.error('[EMAIL] Owner alert failed:', err))

    console.log(`[EMAIL] Done for ${userEmail}`)
    return NextResponse.json({
      success: true,
      message: `Report emailed to ${userEmail} — check your inbox (and spam folder).`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[EMAIL] Error:', msg)
    return NextResponse.json({ error: `Failed to send email: ${msg}` }, { status: 500 })
  }
}
