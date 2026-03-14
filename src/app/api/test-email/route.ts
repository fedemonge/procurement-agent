import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const steps: string[] = []

  try {
    steps.push('start')

    // Step 1: test Excel import
    const { generateExcel } = await import('@/lib/excel')
    steps.push('excel-imported')

    const fakeSuppliers = [{ name: 'Test Co', address: '123 Test St', country: 'Peru', website: 'https://test.com', productDetails: 'Test product' }]
    const buf = await generateExcel(fakeSuppliers as never, { description: 'test', location: 'Lima', incoterm: 'FOB' })
    steps.push(`excel-generated-${buf.length}bytes`)

    // Step 2: test SMTP
    const sent = await sendEmail({
      to: process.env.OWNER_EMAIL || 'fede@fedemongeconsulting.com',
      subject: 'Procurement Agent — SMTP Diagnostic Test',
      html: '<p>If you receive this, SMTP is working from Vercel.</p>',
    })
    steps.push(sent ? 'smtp-sent' : 'smtp-returned-false')

    return NextResponse.json({ ok: true, steps })
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
    return NextResponse.json({ ok: false, steps, error: msg }, { status: 500 })
  }
}
