import { NextRequest, NextResponse } from 'next/server'
import { EmailRequestSchema } from '@/lib/validators'
import { generateExcel } from '@/lib/excel'
import { buildPdfHtml } from '@/lib/templates/pdf-report'
import { buildOwnerAlertHtml, buildUserResultsHtml } from '@/lib/templates/email-alert'

export const dynamic = 'force-dynamic'

const N8N_WEBHOOK = 'https://fedemonge.app.n8n.cloud/webhook/procurement-email'

async function sendViaN8n(payload: {
  to: string
  subject: string
  userHtml: string
  reportHtml?: string
  reportFilename?: string
  excelBase64?: string
  excelFilename?: string
}) {
  const res = await fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`n8n responded ${res.status}: ${text.substring(0, 200)}`)
  }
  return true
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
    console.log(`[EMAIL] Processing for ${userEmail} — ${suppliers.length} suppliers`)

    const ts = Date.now()

    // Generate Excel
    const excelBuffer = await generateExcel(suppliers, searchRequest)
    const excelBase64 = excelBuffer.toString('base64')
    console.log(`[EMAIL] Excel ready (${excelBuffer.length} bytes)`)

    // Build HTML report
    const reportHtml = buildPdfHtml(suppliers, searchRequest)

    // Send report to user via n8n
    await sendViaN8n({
      to: userEmail,
      subject: `Your Procurement Report — ${suppliers.length} supplier(s) found`,
      userHtml: buildUserResultsHtml(userName, suppliers.length),
      reportHtml,
      reportFilename: `procurement-report-${ts}.html`,
      excelBase64,
      excelFilename: `procurement-suppliers-${ts}.xlsx`,
    })
    console.log(`[EMAIL] Report sent to ${userEmail}`)

    // Alert owner (non-blocking)
    sendViaN8n({
      to: process.env.OWNER_EMAIL || 'fede@fedemongeconsulting.com',
      subject: `New Procurement Search — ${userName} (${suppliers.length} suppliers)`,
      userHtml: buildOwnerAlertHtml(userName, userEmail, searchRequest, suppliers.length),
    }).catch((err) => console.error('[EMAIL] Owner alert failed:', err))

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
