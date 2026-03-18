import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CACHE_DIR = join(tmpdir(), 'figma-vue-screenshots')

export async function downloadToFile(url, filename) {
  await mkdir(CACHE_DIR, { recursive: true })
  const filePath = join(CACHE_DIR, filename)
  const res = await fetch(url)
  if (!res.ok) return null
  const buffer = Buffer.from(await res.arrayBuffer())
  await writeFile(filePath, buffer)
  return filePath
}
