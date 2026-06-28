// ════════════════════════════════════════════════════════════════
// Shared CORS + bot-protection helpers for the PUBLIC booking endpoints.
//
// The marketing website is a different origin from the app, and these
// endpoints are anon-callable, so every response needs CORS headers and
// every write needs a Cloudflare Turnstile check.
//
// Secrets: WEBSITE_ORIGIN (comma-separated allowlist), TURNSTILE_SECRET
// ════════════════════════════════════════════════════════════════

// Comma-separated allowlist, e.g. "https://stylzzbycliff.com,https://app.stylzzbycliff.com".
// Falls back to "*" only when unset (dev). In prod, always set WEBSITE_ORIGIN.
const ORIGINS = (Deno.env.get('WEBSITE_ORIGIN') ?? '')
  .split(',').map((o) => o.trim()).filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allow = ORIGINS.length === 0
    ? '*'
    : (ORIGINS.includes(origin) ? origin : ORIGINS[0])
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

// Preflight short-circuit. Returns a Response for OPTIONS, else null.
export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }
  return null
}

// Verify a Cloudflare Turnstile token. Returns true if disabled (no secret),
// so the function still works in dev before bot protection is configured.
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET')
  if (!secret) return true // not configured yet → allow (dev)
  if (!token) return false
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}
