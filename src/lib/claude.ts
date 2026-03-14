import Anthropic from '@anthropic-ai/sdk'
import type { SearchRequest, SupplierResult, Attachment } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const VALID_IMAGE_TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function buildAttachmentBlocks(attachments: Attachment[]): Anthropic.MessageParam['content'] {
  const blocks: Anthropic.ContentBlockParam[] = []

  for (const att of attachments) {
    if (att.mimeType === 'application/pdf') {
      // PDF via document block (beta)
      blocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: att.base64,
        },
        title: att.name,
        context: 'Specification or reference document provided by the buyer.',
      } as unknown as Anthropic.ContentBlockParam)
    } else if (VALID_IMAGE_TYPES.includes(att.mimeType as ImageMediaType)) {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.mimeType as ImageMediaType,
          data: att.base64,
        },
      })
    }
    // unsupported types are silently skipped
  }

  return blocks
}

export async function searchSuppliers(req: SearchRequest): Promise<SupplierResult[]> {
  const incotermNote = req.incoterm && req.incoterm !== 'Any'
    ? `The buyer prefers ${req.incoterm} incoterm terms.`
    : 'No specific incoterm preference.'

  const systemPrompt = `You are a global procurement intelligence agent. Your task is to find real, verifiable suppliers for goods or services.

Search the web thoroughly for suppliers matching the user's requirements. For each supplier found, extract:
- Company name
- Full address (street, city, country)
- Country
- Website URL (main site)
- Direct catalog or product page URL (if findable — look for product pages, not just homepages)
- Phone number (with country code if available)
- Email address (sales, procurement, or info email)
- Product details (what they offer that matches the need)
- Supplier rating (from Google Reviews, Trustpilot, Alibaba ratings, industry directories — cite the source)
- Incoterms they support (if mentioned on their site)
- Any relevant notes

Return ONLY a valid JSON array with no markdown, no explanation, no code blocks. Just the raw JSON array.
Each element must have: name, address, country, website, productDetails (required) plus optional fields.

Search in multiple languages (Spanish, English, Portuguese) as appropriate for the location.
Check B2B directories: Alibaba, Thomasnet, Kompass, Europages, MercadoLibre Business, local trade directories.
Prioritize suppliers with verifiable web presence and contact information.
Return between 5 and 10 suppliers. Quality over quantity — only include suppliers with at least a website.`

  const userMessage = `Find suppliers for the following procurement need:

WHAT IS NEEDED: ${req.description}
${req.brandOrSku ? `BRAND / SKU / REFERENCE: ${req.brandOrSku}` : ''}
BUYER LOCATION: ${req.location}
INCOTERM: ${incotermNote}

Search for real suppliers accessible from ${req.location}. Include local suppliers in ${req.location} as well as international suppliers that ship there.`

  // Build message content with all attachments
  const attachmentBlocks = req.attachments?.length
    ? buildAttachmentBlocks(req.attachments)
    : []

  const hasAttachments = Array.isArray(attachmentBlocks) && attachmentBlocks.length > 0
  const textSuffix = hasAttachments
    ? '\n\nThe attached files (images and/or documents) show the product or specifications. Use them to refine your search.'
    : ''

  const messageContent: Anthropic.ContentBlockParam[] = [
    ...(Array.isArray(attachmentBlocks) ? attachmentBlocks as Anthropic.ContentBlockParam[] : []),
    { type: 'text', text: userMessage + textSuffix },
  ]

  const headers: Record<string, string> = { 'anthropic-beta': 'web-search-2025-03-05' }
  // Add PDFs beta header if any PDF is included
  if (req.attachments?.some(a => a.mimeType === 'application/pdf')) {
    headers['anthropic-beta'] = 'web-search-2025-03-05,pdfs-2024-09-25'
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: messageContent }],
    tools: [{ type: 'web_search_20250305' as 'web_search_20250305', name: 'web_search', max_uses: 5 }],
  }, { headers })

  const textContent = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  return parseSuppliers(textContent)
}

function parseSuppliers(raw: string): SupplierResult[] {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  const arrayStart = cleaned.indexOf('[')
  const arrayEnd = cleaned.lastIndexOf(']')

  if (arrayStart === -1 || arrayEnd === -1) {
    console.error('[CLAUDE] No JSON array found in response:', cleaned.substring(0, 200))
    return []
  }

  try {
    const parsed = JSON.parse(cleaned.substring(arrayStart, arrayEnd + 1))
    if (!Array.isArray(parsed)) return []
    return parsed as SupplierResult[]
  } catch (err) {
    console.error('[CLAUDE] JSON parse error:', err)
    return []
  }
}
