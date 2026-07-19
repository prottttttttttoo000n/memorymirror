/**
 * Cloudflare Pages Function — STT proxy for Workers AI (Whisper).
 *
 * Receives POST /api/stt with a FormData audio blob from the browser,
 * forwards to Workers AI Whisper REST API.
 * Keeps the Cloudflare API token server-side (never exposed to the browser).
 */

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_API_TOKEN: string
  /** Optional: override the Whisper model name */
  STT_MODEL?: string
}

export async function onRequest(context: {
  request: Request
  env: Env
}): Promise<Response> {
  const { request, env } = context

  // ── CORS headers ────────────────────────────────────────────────
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

  // ── Parse FormData ──────────────────────────────────────────────
  let audioBlob: Blob
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!audio || !(audio instanceof Blob)) {
      return Response.json(
        { success: false, error: 'Missing audio field in FormData' },
        { status: 400, headers: corsHeaders },
      )
    }
    audioBlob = audio
  } catch {
    return Response.json(
      { success: false, error: 'Failed to parse FormData body' },
      { status: 400, headers: corsHeaders },
    )
  }

  // ── Validate audio ──────────────────────────────────────────────
  if (audioBlob.size === 0) {
    return Response.json(
      { success: false, error: 'Empty audio blob' },
      { status: 400, headers: corsHeaders },
    )
  }

  // Whisper expects a file upload — use a reasonable filename
  const model = env.STT_MODEL || '@cf/openai/whisper-large-v3-turbo'
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`

  // Workers AI Whisper expects audio as FormData with an "audio" field
  const whisperForm = new FormData()
  whisperForm.set(
    'audio',
    audioBlob,
    `recording.${audioBlob.type.includes('webm') ? 'webm' : audioBlob.type.includes('ogg') ? 'ogg' : 'mp4'}`,
  )

  // ── Forward to Workers AI ───────────────────────────────────────
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        // Do NOT set Content-Type here — fetch sets it automatically with the boundary for FormData
      },
      body: whisperForm,
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

  // Workers AI returns { result: { text: "..." } } for Whisper
  const text = result.result?.text
  if (typeof text !== 'string') {
    return Response.json(
      { success: false, error: 'Unexpected response format from Workers AI Whisper' },
      { status: 502, headers: corsHeaders },
    )
  }

  return Response.json(
    { success: true, data: { text } },
    { headers: corsHeaders },
  )
}
