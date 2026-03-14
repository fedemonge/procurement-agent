import type { SearchRequest } from '@/types'

export function buildOwnerAlertHtml(
  userName: string,
  userEmail: string,
  req: SearchRequest,
  supplierCount: number
): string {
  const now = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'full', timeStyle: 'short',
  })
  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; color: #2d3436; }
  .header { background: #0F2D3A; color: #28cfe2; padding: 16px 20px; border-radius: 6px 6px 0 0; }
  .body { border: 1px solid #d4e8f0; border-top: none; padding: 20px; border-radius: 0 0 6px 6px; }
  .row { margin-bottom: 10px; }
  .label { font-size: 10px; text-transform: uppercase; color: #636e72; letter-spacing: 1px; }
  .value { font-weight: 600; margin-top: 2px; }
  .tag { display: inline-block; background: #f0fafe; border: 1px solid #28cfe2; color: #0F2D3A; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
</style></head>
<body>
  <div class="header"><strong>🔔 New Procurement Search</strong></div>
  <div class="body">
    <div class="row"><div class="label">Time (COT)</div><div class="value">${now}</div></div>
    <div class="row"><div class="label">User Name</div><div class="value">${userName}</div></div>
    <div class="row"><div class="label">User Email</div><div class="value"><a href="mailto:${userEmail}">${userEmail}</a></div></div>
    <div class="row"><div class="label">Searched For</div><div class="value">${req.description}</div></div>
    ${req.brandOrSku ? `<div class="row"><div class="label">Brand / SKU</div><div class="value">${req.brandOrSku}</div></div>` : ''}
    <div class="row"><div class="label">Location</div><div class="value">${req.location}</div></div>
    ${req.incoterm && req.incoterm !== 'Any' ? `<div class="row"><div class="label">Incoterm</div><div class="value"><span class="tag">${req.incoterm}</span></div></div>` : ''}
    <div class="row"><div class="label">Suppliers Found</div><div class="value">${supplierCount}</div></div>
    ${req.attachments?.length ? `<div class="row"><div class="label">Attachments</div><div class="value">✅ ${req.attachments.length} file(s) uploaded</div></div>` : ''}
  </div>
</body>
</html>`
}

export function buildUserResultsHtml(userName: string, supplierCount: number): string {
  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; color: #2d3436; background: #f7fbfc; }
  .card { background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: #0F2D3A; padding: 24px; text-align: center; }
  .header h1 { color: #28cfe2; font-size: 18px; margin-bottom: 4px; }
  .header p { color: #aaa; font-size: 12px; }
  .body { padding: 24px; }
  .cta { display: block; background: #28cfe2; color: #0F2D3A !important; text-align: center; padding: 12px 24px; border-radius: 6px; font-weight: 700; text-decoration: none; margin-top: 20px; }
  .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 20px; }
  .footer a { color: #28cfe2; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <h1>Your Procurement Report is Ready</h1>
      <p>Federico Monge Consulting · AI · Strategy · Finance</p>
    </div>
    <div class="body">
      <p>Hi ${userName},</p>
      <br>
      <p>Your supplier search results are attached to this email as:</p>
      <ul style="margin:12px 0 12px 20px;line-height:2">
        <li><strong>PDF Report</strong> — formatted for presentations and sharing</li>
        <li><strong>Excel File</strong> — for filtering, sorting, and further analysis</li>
      </ul>
      <p>We found <strong>${supplierCount} supplier(s)</strong> matching your requirements.</p>
      <br>
      <p style="font-size:11px;color:#636e72">
        <em>Reminder: always verify supplier details independently before making purchasing decisions.
        Results are sourced from public web data and may change.</em>
      </p>
      <a href="https://www.fedemongeconsulting.com" class="cta">Visit Federico Monge Consulting</a>
    </div>
    <div class="footer">
      <a href="https://procurement.fedemongeconsulting.com">Run another search</a> &nbsp;·&nbsp;
      <a href="https://www.fedemongeconsulting.com">www.fedemongeconsulting.com</a>
    </div>
  </div>
</body>
</html>`
}
