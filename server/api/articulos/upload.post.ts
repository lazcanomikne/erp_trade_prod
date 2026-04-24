import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createError, readMultipartFormData } from 'h3'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 12 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const baseUrl = String(config.public.uploadsPublicBase || '').replace(/\/$/, '')

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart vacío' })
  }

  const filePart = parts.find(p => p.name === 'file' && p.filename && p.data?.length)
  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Campo "file" requerido' })
  }

  if (filePart.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Archivo demasiado grande' })
  }

  const mime = filePart.type || 'application/octet-stream'
  if (!ALLOWED.has(mime)) {
    throw createError({ statusCode: 415, statusMessage: 'Tipo no permitido (usa imagen)' })
  }

  const ext = extFromMime(mime, filePart.filename)
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
  const dir = join(process.cwd(), 'public', 'uploads', 'articulos')

  try {
    await mkdir(dir, { recursive: true })
    const abs = join(dir, name)
    await writeFile(abs, filePart.data)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Almacenamiento local no disponible en este entorno' })
  }

  const publicPath = `/uploads/articulos/${name}`
  const url = baseUrl ? `${baseUrl}/${name}` : publicPath

  return {
    ok: true,
    filename: name,
    path: publicPath,
    url
  }
})

function extFromMime(mime: string, original: string): string {
  if (mime === 'image/png') {
    return '.png'
  }
  if (mime === 'image/webp') {
    return '.webp'
  }
  if (mime === 'image/gif') {
    return '.gif'
  }
  const m = /\.[a-z0-9]+$/i.exec(original)
  if (m && m[0].length <= 5) {
    return m[0].toLowerCase()
  }
  return '.jpg'
}
