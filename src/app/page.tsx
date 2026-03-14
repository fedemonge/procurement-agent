'use client'

import { useState, useRef, useCallback } from 'react'
import type { SupplierResult, SearchRequest, SearchResponse, Attachment } from '@/types'

const INCOTERMS = ['Any', 'EXW', 'FOB', 'CIF', 'DDP', 'DAP', 'FCA', 'CPT', 'CFR']

const LOADING_MESSAGES = [
  'Searching global supplier databases...',
  'Analyzing product specifications...',
  'Verifying supplier contacts...',
  'Checking trade directories...',
  'Compiling results...',
]

export default function ProcurementPage() {
  // Form state
  const [description, setDescription] = useState('')
  const [brandOrSku, setBrandOrSku] = useState('')
  const [location, setLocation] = useState('')
  const [incoterm, setIncoterm] = useState('Any')
  const [attachments, setAttachments] = useState<(Attachment & { preview?: string })[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierResult[] | null>(null)
  const [searchReq, setSearchReq] = useState<SearchRequest | null>(null)

  // Email state
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null)

  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const MAX_FILES = 6

  const addFiles = useCallback((files: File[]) => {
    const valid = files.filter(f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
    if (valid.length < files.length) alert('Some files were skipped — only images and PDFs under 10MB are accepted.')

    valid.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const base64 = dataUrl.split(',')[1]
        setAttachments(prev => {
          if (prev.length >= MAX_FILES) return prev
          // deduplicate by name
          if (prev.some(a => a.name === file.name)) return prev
          return [...prev, {
            base64,
            mimeType: file.type,
            name: file.name,
            preview: file.type.startsWith('image/') ? dataUrl : undefined,
          }]
        })
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const removeAttachment = useCallback((name: string) => {
    setAttachments(prev => prev.filter(a => a.name !== name))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuppliers(null)
    setEmailStatus(null)
    setLoading(true)
    setLoadingMsg(0)

    const msgInterval = setInterval(() => {
      setLoadingMsg((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 2500)

    const req: SearchRequest = {
      description,
      brandOrSku: brandOrSku || undefined,
      location,
      incoterm: incoterm !== 'Any' ? incoterm : undefined,
      attachments: attachments.length > 0
        ? attachments.map(({ base64, mimeType, name }) => ({ base64, mimeType, name }))
        : undefined,
    }
    setSearchReq(req)

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })

      if (!res.ok || !res.body) throw new Error('Search failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotResult = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const event = JSON.parse(line.slice(6)) as { type: string; suppliers?: SupplierResult[]; message?: string }
          if (event.type === 'result' && event.suppliers) {
            gotResult = true
            setSuppliers(event.suppliers)
          } else if (event.type === 'error') {
            gotResult = true
            throw new Error(event.message || 'Search failed')
          }
          // 'ping' events just keep the connection alive
        }
      }

      if (!gotResult) {
        throw new Error('The search timed out. Please try again — complex queries can take up to 45 seconds.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      clearInterval(msgInterval)
      setLoading(false)
    }
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!suppliers || !searchReq) return
    setEmailLoading(true)
    setEmailStatus(null)
    try {
      const res = await fetch('/api/email-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, userEmail, searchRequest: searchReq, suppliers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setEmailStatus({ ok: true, message: data.message })
    } catch (err) {
      setEmailStatus({ ok: false, message: err instanceof Error ? err.message : 'Failed to send email.' })
    } finally {
      setEmailLoading(false)
    }
  }

  const reset = () => {
    setSuppliers(null)
    setError(null)
    setEmailStatus(null)
    setSearchReq(null)
    setAttachments([])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1d1e', color: '#2d3436' }}>
      {/* Header */}
      <header style={{ background: '#0F2D3A', borderBottom: '1px solid #28cfe230', padding: '0 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 32, height: 32, background: '#28cfe2', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0F2D3A', fontSize: 14 }}>FM</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>Procurement Agent</div>
              <div style={{ color: '#28cfe2', fontSize: 11, marginTop: 2 }}>Federico Monge Consulting</div>
            </div>
          </div>
          <a href="https://www.fedemongeconsulting.com" style={{ color: '#636e72', fontSize: 12, textDecoration: 'none' }}>
            ← Main Site
          </a>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero */}
        {!suppliers && !loading && (
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0F2D3A', border: '1px solid #28cfe240', borderRadius: 20, padding: '6px 16px', marginBottom: 20 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28cfe2', display: 'inline-block' }}></span>
              <span style={{ color: '#28cfe2', fontSize: 12 }}>AI-Powered Supplier Discovery</span>
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>
              Find Suppliers for<br />
              <span style={{ color: '#28cfe2' }}>Anything, Anywhere</span>
            </h1>
            <p style={{ color: '#b3babd', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
              Describe what you need to source. Our AI searches global trade directories, B2B platforms,
              and supplier databases to build your shortlist — with contact details and ratings.
            </p>
          </div>
        )}

        {/* Search Form */}
        {!suppliers && !loading && (
          <form onSubmit={handleSearch}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, color: '#0F2D3A', marginBottom: 20, paddingBottom: 12, borderBottom: '2px solid #28cfe2' }}>
                What are you looking for?
              </h2>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F2D3A', marginBottom: 6 }}>
                  Describe the product or service <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Industrial PVC pipes 6 inch diameter, schedule 40, for water distribution. Need 500 units."
                  required
                  rows={3}
                  style={{ width: '100%', border: '1.5px solid #d4d9db', borderRadius: 8, padding: '10px 14px', fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={(e) => e.target.style.borderColor = '#28cfe2'}
                  onBlur={(e) => e.target.style.borderColor = '#d4d9db'}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F2D3A', marginBottom: 6 }}>
                  Brand / SKU / Item code / Reference <span style={{ color: '#636e72', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={brandOrSku}
                  onChange={(e) => setBrandOrSku(e.target.value)}
                  placeholder="e.g., Tigre PVC-U, SKU-12345, Part #ABC"
                  style={{ width: '100%', border: '1.5px solid #d4d9db', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                  onFocus={(e) => e.target.style.borderColor = '#28cfe2'}
                  onBlur={(e) => e.target.style.borderColor = '#d4d9db'}
                />
              </div>

              {/* Multi-file Upload */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F2D3A', marginBottom: 6 }}>
                  Images &amp; specification files <span style={{ color: '#636e72', fontWeight: 400 }}>(optional — up to 6 files)</span>
                </label>

                {/* Drop zone */}
                {attachments.length < MAX_FILES && (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    style={{ border: '2px dashed #d4d9db', borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s', marginBottom: attachments.length > 0 ? 12 : 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#28cfe2')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#d4d9db')}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
                    <div style={{ color: '#636e72', fontSize: 13 }}>
                      Click or drag &amp; drop — JPEG, PNG, WEBP, PDF (max 10MB each)
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }}
                    />
                  </div>
                )}

                {/* Attachment thumbnails */}
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {attachments.map((att) => (
                      <div key={att.name} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, border: '1.5px solid #28cfe2', overflow: 'hidden', background: '#f0fafe' }}>
                        {att.preview ? (
                          <img src={att.preview} alt={att.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <span style={{ fontSize: 24 }}>📄</span>
                            <span style={{ fontSize: 9, color: '#636e72', textAlign: 'center', padding: '0 4px', wordBreak: 'break-word', lineHeight: 1.2 }}>
                              {att.name.length > 14 ? att.name.substring(0, 12) + '…' : att.name}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.name)}
                          style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', marginBottom: 24 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, color: '#0F2D3A', marginBottom: 20, paddingBottom: 12, borderBottom: '2px solid #28cfe2' }}>
                Where and how?
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F2D3A', marginBottom: 6 }}>
                    City / Country <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Bogotá, Colombia"
                    required
                    style={{ width: '100%', border: '1.5px solid #d4d9db', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                    onFocus={(e) => e.target.style.borderColor = '#28cfe2'}
                    onBlur={(e) => e.target.style.borderColor = '#d4d9db'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F2D3A', marginBottom: 6 }}>
                    Incoterm <span style={{ color: '#636e72', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <select
                    value={incoterm}
                    onChange={(e) => setIncoterm(e.target.value)}
                    style={{ width: '100%', border: '1.5px solid #d4d9db', borderRadius: 8, padding: '10px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff' }}
                    onFocus={(e) => e.target.style.borderColor = '#28cfe2'}
                    onBlur={(e) => e.target.style.borderColor = '#d4d9db'}
                  >
                    {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              style={{ width: '100%', background: 'linear-gradient(135deg, #28cfe2, #1fb8c9)', color: '#0F2D3A', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 8, padding: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(40,207,226,0.4)', transition: 'transform 0.1s' }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              🔍 Search Suppliers
            </button>
          </form>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '60px 32px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 56, height: 56, border: '4px solid #f0fafe', borderTop: '4px solid #28cfe2', borderRadius: '50%', margin: '0 auto 24px', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: '#0F2D3A', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{LOADING_MESSAGES[loadingMsg]}</p>
            <p style={{ color: '#636e72', fontSize: 13 }}>This may take up to 30 seconds — Claude is searching the web</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fff5f5', border: '1.5px solid #ef4444', borderRadius: 12, padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
            <p style={{ color: '#c0392b', fontWeight: 600 }}>{error}</p>
            <button onClick={reset} style={{ marginTop: 16, color: '#28cfe2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Try again</button>
          </div>
        )}

        {/* Results */}
        {suppliers && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>
                  Found <span style={{ color: '#28cfe2' }}>{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</span>
                </h2>
                <p style={{ color: '#636e72', fontSize: 13, marginTop: 4 }}>
                  Results sourced from public web data — verify details before contacting suppliers
                </p>
              </div>
              <button onClick={reset} style={{ background: 'none', border: '1.5px solid #28cfe2', color: '#28cfe2', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                New Search
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16, marginBottom: 40 }}>
              {suppliers.map((s, i) => (
                <SupplierCard key={i} supplier={s} />
              ))}
            </div>

            {/* Email Results Section */}
            <div style={{ background: '#0F2D3A', borderRadius: 12, padding: '32px', border: '1px solid #28cfe230' }}>
              <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>📧 Get a Full Report</h3>
              <p style={{ color: '#b3babd', fontSize: 13, marginBottom: 24 }}>
                Receive this supplier list as a branded <strong style={{ color: '#28cfe2' }}>Excel file</strong> and <strong style={{ color: '#28cfe2' }}>HTML report</strong> — ready to share with your team.
              </p>

              {emailStatus ? (
                <div style={{ background: emailStatus.ok ? '#d1fae5' : '#fee2e2', borderRadius: 8, padding: '16px 20px', color: emailStatus.ok ? '#065f46' : '#c0392b', fontWeight: 600 }}>
                  {emailStatus.ok ? '✅' : '❌'} {emailStatus.message}
                </div>
              ) : (
                <form onSubmit={handleEmail} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, fontWeight: 600 }}>Your Name</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="John Doe"
                      required
                      style={{ width: '100%', background: '#1a1d1e', border: '1.5px solid #28cfe240', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#fff', outline: 'none', fontFamily: 'inherit' }}
                      onFocus={(e) => e.target.style.borderColor = '#28cfe2'}
                      onBlur={(e) => e.target.style.borderColor = '#28cfe240'}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 6, fontWeight: 600 }}>Email Address</label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="maria@company.com"
                      required
                      style={{ width: '100%', background: '#1a1d1e', border: '1.5px solid #28cfe240', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#fff', outline: 'none', fontFamily: 'inherit' }}
                      onFocus={(e) => e.target.style.borderColor = '#28cfe2'}
                      onBlur={(e) => e.target.style.borderColor = '#28cfe240'}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={emailLoading}
                    style={{ background: emailLoading ? '#636e72' : 'linear-gradient(135deg, #28cfe2, #1fb8c9)', color: '#0F2D3A', fontWeight: 700, border: 'none', borderRadius: 8, padding: '10px 20px', cursor: emailLoading ? 'not-allowed' : 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
                  >
                    {emailLoading ? 'Sending...' : 'Email Me →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{ textAlign: 'center', marginTop: 48, paddingTop: 24, borderTop: '1px solid #2d3436', color: '#636e72', fontSize: 12 }}>
          <a href="https://www.fedemongeconsulting.com" style={{ color: '#28cfe2', textDecoration: 'none', fontWeight: 600 }}>Federico Monge Consulting</a>
          {' · '}AI · Strategy · Finance
        </footer>
      </main>
    </div>
  )
}

function SupplierCard({ supplier: s }: { supplier: SupplierResult }) {
  const [expanded, setExpanded] = useState(false)
  const longDetails = s.productDetails.length > 150

  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', borderLeft: '4px solid #28cfe2' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: 17, color: '#0F2D3A', marginBottom: 4 }}>{s.name}</h3>
          <span style={{ display: 'inline-block', background: '#f0fafe', border: '1px solid #28cfe240', color: '#0F2D3A', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
            {s.country}
          </span>
        </div>
        {s.rating && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: '#0F2D3A', fontSize: 14 }}>{s.rating}</div>
            {s.ratingSource && <div style={{ fontSize: 10, color: '#636e72', marginTop: 2 }}>{s.ratingSource}</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#636e72', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Address</div>
          <div style={{ fontSize: 13, color: '#2d3436' }}>{s.address}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#636e72', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Contact</div>
          {s.phone && <div style={{ fontSize: 13 }}><a href={`tel:${s.phone}`} style={{ color: '#0F2D3A', textDecoration: 'none' }}>📞 {s.phone}</a></div>}
          {s.email && <div style={{ fontSize: 13, marginTop: 2 }}><a href={`mailto:${s.email}`} style={{ color: '#28cfe2', textDecoration: 'none' }}>✉ {s.email}</a></div>}
          {!s.phone && !s.email && <div style={{ fontSize: 13, color: '#636e72' }}>—</div>}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#636e72', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Product Details</div>
        <div style={{ fontSize: 13, color: '#2d3436', lineHeight: 1.6 }}>
          {expanded || !longDetails ? s.productDetails : s.productDetails.substring(0, 150) + '...'}
          {longDetails && (
            <button onClick={() => setExpanded(!expanded)} style={{ marginLeft: 8, color: '#28cfe2', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0F2D3A', color: '#28cfe2', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
          🌐 Website
        </a>
        {s.catalogUrl && (
          <a href={s.catalogUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fafe', color: '#0F2D3A', border: '1px solid #28cfe2', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            📋 Catalog / Product Page
          </a>
        )}
      </div>
    </div>
  )
}
