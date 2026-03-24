import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const PARSE_CV_PROMPT = `Analyze this CV/resume document and extract all relevant information. Return it as a JSON object with these exact fields:

{
  "fullName": "Candidate's full name",
  "email": "Email address",
  "phone": "Phone number (include country code if present)",
  "address": "Full address or city/country if full address not available",
  "dateOfBirth": "YYYY-MM-DD if present, otherwise null",
  "nationality": "Nationality if mentioned",
  "linkedIn": "LinkedIn URL if present",
  "summary": "Professional summary or objective (2-3 sentences max)",
  "education": [
    {
      "institution": "University/school name",
      "degree": "Degree type and field (e.g. Bachelor in Business Administration)",
      "year": "Graduation year or period (e.g. 2010-2014)"
    }
  ],
  "workExperience": [
    {
      "company": "Company name",
      "role": "Job title",
      "period": "Period (e.g. 2020-2023 or Jan 2020 - Present)",
      "description": "Brief description of responsibilities (1-2 sentences)"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "languages": ["Language (Level)"],
  "certifications": ["certification1"],
  "confidence": 0.95
}

Rules:
- Return ONLY the JSON object, no other text, no markdown
- If a field is not found, use null for strings or empty array [] for arrays
- For education and work experience, list in reverse chronological order (most recent first)
- Keep descriptions concise
- Confidence should be between 0 and 1 based on document quality and readability
- For phone numbers, preserve the original format found in the document`

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image, mimeType } = body

    if (!image) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const isPdf = mimeType === 'application/pdf'
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
    type ImageMediaType = typeof validImageTypes[number]

    const contentBlocks: Anthropic.ContentBlockParam[] = []

    if (isPdf) {
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: image,
        },
        title: 'CV/Resume',
        context: 'This is a curriculum vitae or resume document to extract candidate information from.',
      } as unknown as Anthropic.ContentBlockParam)
    } else {
      const mediaType: ImageMediaType = validImageTypes.includes(mimeType as ImageMediaType)
        ? (mimeType as ImageMediaType)
        : 'image/jpeg'

      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: image,
        },
      })
    }

    contentBlocks.push({
      type: 'text',
      text: PARSE_CV_PROMPT,
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const rawText = textBlock ? (textBlock as Anthropic.TextBlock).text : '{}'

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
    console.error('[PARSE-CV] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
}
