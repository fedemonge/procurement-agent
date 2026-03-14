import { NextRequest, NextResponse } from 'next/server'
import { searchSuppliers } from '@/lib/claude'
import { SearchRequestSchema } from '@/lib/validators'
import { randomUUID } from 'crypto'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = SearchRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const req = parsed.data
    console.log(`[SEARCH] Query: "${req.description}" | Location: ${req.location}`)

    const suppliers = await searchSuppliers(req)

    if (suppliers.length === 0) {
      return NextResponse.json(
        { error: 'No suppliers found. Try a different description or location.' },
        { status: 404 }
      )
    }

    console.log(`[SEARCH] Found ${suppliers.length} suppliers`)

    return NextResponse.json({
      suppliers,
      searchId: randomUUID(),
      query: req.description,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[SEARCH] Error:', msg)
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    )
  }
}
