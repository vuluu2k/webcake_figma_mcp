const WEBCAKE_API = process.env.WEBCAKE_API_URL || 'https://api.storecake.io'
const WEBCAKE_TOKEN = process.env.WEBCAKE_JWT

export async function uploadUrls(urls) {
  if (!WEBCAKE_TOKEN) throw new Error('WEBCAKE_JWT env required for image upload')
  if (!urls.length) return []

  const res = await fetch(`${WEBCAKE_API}/api/v1/assets/upload_file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WEBCAKE_TOKEN}`,
    },
    body: JSON.stringify({ urls }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Webcake upload ${res.status}: ${body}`)
  }

  return res.json()
}
