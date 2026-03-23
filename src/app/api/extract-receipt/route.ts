import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image, mimeType } = body

    if (!image) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
    type ImageMediaType = typeof validTypes[number]
    const mediaType: ImageMediaType = validTypes.includes(mimeType as ImageMediaType)
      ? (mimeType as ImageMediaType)
      : 'image/jpeg'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: 'text',
              text: `Analyze this receipt, invoice, or expense proof image. Extract all relevant information and return it as a JSON object with these fields:

{
  "vendor": "Name of the business/vendor",
  "date": "YYYY-MM-DD format",
  "total": 0.00,
  "subtotal": 0.00,
  "tax": 0.00,
  "currency": "USD or detected currency code",
  "invoiceNumber": "Invoice/receipt number if visible",
  "category": "Best match: Accommodation, Meals, Transportation, Flights, Office Supplies, Communication, Entertainment, Professional Services, or Other",
  "lineItems": [
    { "description": "Item description", "quantity": 1, "unitPrice": 0.00, "amount": 0.00 }
  ],
  "paymentMethod": "Cash, Credit Card, etc. if visible",
  "confidence": 0.95
}

Rules:
- Return ONLY the JSON object, no other text
- If a field is not visible or unclear, use null
- For currency, detect from symbols ($ = USD, € = EUR, S/ = PEN, R$ = BRL, ₡ = CRC) or text
- Confidence should be between 0 and 1 based on image quality and readability
- Parse all amounts as numbers (not strings)
- Date should always be YYYY-MM-DD format`,
            },
          ],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const rawText = textBlock ? (textBlock as Anthropic.TextBlock).text : '{}'

    // Parse the JSON response (Claude might wrap it in markdown code blocks)
    let extracted
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      extracted = { error: 'Failed to parse extraction', rawText }
    }

    return new Response(
      JSON.stringify({ ok: true, extracted }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[EXTRACT-RECEIPT] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
}
