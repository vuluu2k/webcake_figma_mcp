const WEBCAKE_API = process.env.WEBCAKE_API_URL || 'https://api.storecake.io'
const WEBCAKE_TOKEN = process.env.WEBCAKE_JWT
const WEBCAKE_SESSION = process.env.WEBCAKE_SESSION_ID

export async function uploadUrls(urls) {
  if (!WEBCAKE_TOKEN) throw new Error('WEBCAKE_JWT env required for image upload')
  if (!urls.length) return []

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${WEBCAKE_TOKEN}`,
  }
  if (WEBCAKE_SESSION) headers['x-session-id'] = WEBCAKE_SESSION

  const res = await fetch(`${WEBCAKE_API}/api/v1/assets/upload_file`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ urls }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Webcake upload ${res.status}: ${body}`)
  }

  const data = await res.json()
  // API returns { success: true, content_urls: ["url1", "url2"] }
  if (data.success && Array.isArray(data.content_urls)) {
    return data.content_urls
  }
  return []
}
