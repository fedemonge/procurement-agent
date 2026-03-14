import { NextRequest } from 'next/server'
import { searchSuppliers } from '@/lib/claude'
import { SearchRequestSchema } from '@/lib/validators'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = SearchRequestSchema.safeParse(body)

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const req = parsed.data
  console.log(`[SEARCH] Query: "${req.description}" | Location: ${req.location}`)

  const stream = new ReadableStream({
    async start(controller) {
      // Send keepalive ticks every 5s so the connection stays alive
      const keepalive = setInterval(() => {
        try { controller.enqueue(sseEvent({ type: 'ping' })) } catch { /* closed */ }
      }, 5000)

      try {
        const suppliers = await searchSuppliers(req)
        clearInterval(keepalive)

        if (suppliers.length === 0) {
          controller.enqueue(sseEvent({ type: 'error', message: 'No suppliers found. Try a different description or location.' }))
        } else {
          console.log(`[SEARCH] Found ${suppliers.length} suppliers`)
          controller.enqueue(sseEvent({ type: 'result', suppliers, searchId: randomUUID() }))
        }
      } catch (err) {
        clearInterval(keepalive)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[SEARCH] Error:', msg)
        controller.enqueue(sseEvent({ type: 'error', message: 'Search failed. Please try again.' }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
