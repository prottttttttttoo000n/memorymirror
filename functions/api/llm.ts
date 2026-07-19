/**
 * Cloudflare Pages Function — LLM proxy for Workers AI (Llama 3.1 8B).
 *
 * Receives POST /api/llm from the browser, forwards to Workers AI REST API.
 * Keeps the Cloudflare API token server-side (never exposed to the browser).
 */

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_API_TOKEN: string
  /** Optional: override the Llama model name */
  LLM_MODEL?: string
}

interface LlmRequestBody {
  messages: { role: string; content: string }[]
  temperature?: number
  max_tokens?: number
}

export async function onRequest(context: {
  request: Request
  env: Env
}): Promise<Response> {
  const { request, env } = context

  // ── CORS headers (same-origin in prod, but Pages Functions need explicit for OPTIONS preflight) ──
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return Response.json({ success: false, error: 'Method not allowed' }, {
      status: 405,
      headers: corsHeaders,
    })
  }

  // ── Validate credentials ────────────────────────────────────────
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    return Response.json(
      { success: false, error: 'Cloudflare credentials not configured on the server.' },
      { status: 500, headers: corsHeaders },
    )
  }

  // ── Parse request body ──────────────────────────────────────────
  let body: LlmRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, {
      status: 400,
      headers: corsHeaders,
    })
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ success: false, error: 'messages array is required' }, {
      status: 400,
      headers: corsHeaders,
    })
  }

  const model = env.LLM_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast'

  // ── Forward to Workers AI ───────────────────────────────────────
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: body.messages,
        ...(body.temperature !== undefined && { temperature: body.temperature }),
        ...(body.max_tokens !== undefined && { max_tokens: body.max_tokens }),
      }),
    })
  } catch (err) {
    return Response.json(
      { success: false, error: `Network error calling Workers AI: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 502, headers: corsHeaders },
    )
  }

  const result = await response.json()

  // ── Handle API errors ───────────────────────────────────────────
  if (!response.ok || !result.success) {
    const errorMessage = result.errors?.[0]?.message || result.error || `Workers AI returned status ${response.status}`
    return Response.json(
      { success: false, error: errorMessage },
      { status: response.status, headers: corsHeaders },
    )
  }

  // Workers AI returns { result: { response: "..." } }
  const text = result.result?.response
  if (typeof text !== 'string') {
    return Response.json(
      { success: false, error: 'Unexpected response format from Workers AI' },
      { status: 502, headers: corsHeaders },
    )
  }

  return Response.json(
    { success: true, data: { text } },
    { headers: corsHeaders },
  )
}
