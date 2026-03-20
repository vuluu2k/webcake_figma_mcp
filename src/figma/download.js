import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = process.env.PROJECT_ROOT || join(import.meta.dirname, '..', '..', '..', '..')
const CACHE_DIR = join(ROOT, '.figma-cache')

export async function downloadToFile(url, filename) {
  await mkdir(CACHE_DIR, { recursive: true })
  const filePath = join(CACHE_DIR, filename)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${filename}`)
  await writeFile(filePath, Buffer.from(await res.arrayBuffer()))
  return filePath
}
