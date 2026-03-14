import Anthropic from '@anthropic-ai/sdk'
import type { SearchRequest, SupplierResult } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  // Build message content - add image if provided
  type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }

  const messageContent: ContentBlock[] = []

  if (req.imageBase64 && req.imageMimeType) {
    const validTypes: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const mimeType = validTypes.includes(req.imageMimeType as ImageMediaType)
      ? (req.imageMimeType as ImageMediaType)
      : 'image/jpeg'
    messageContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: req.imageBase64,
      },
    })
    messageContent.push({
      type: 'text',
      text: userMessage + '\n\nThe image above shows the product being sourced. Use it to refine your search.',
    })
  } else {
    messageContent.push({ type: 'text', text: userMessage })
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: messageContent }],
    tools: [{ type: 'web_search_20250305' as 'web_search_20250305', name: 'web_search', max_uses: 8 }],
  }, {
    headers: { 'anthropic-beta': 'web-search-2025-03-05' },
  })

  // Extract text content from the response
  const textContent = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  return parseSuppliers(textContent)
}

function parseSuppliers(raw: string): SupplierResult[] {
  // Strip markdown code blocks if present
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  // Find JSON array in the response
  const arrayStart = cleaned.indexOf('[')
  const arrayEnd = cleaned.lastIndexOf(']')

  if (arrayStart === -1 || arrayEnd === -1) {
    console.error('[CLAUDE] No JSON array found in response:', cleaned.substring(0, 200))
    return []
  }

  const jsonStr = cleaned.substring(arrayStart, arrayEnd + 1)

  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) return []
    return parsed as SupplierResult[]
  } catch (err) {
    console.error('[CLAUDE] JSON parse error:', err)
    return []
  }
}
