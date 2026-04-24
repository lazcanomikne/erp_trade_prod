import { createError, readMultipartFormData } from 'h3'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 12 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const bridgeUrl = String(config.uploadBridgeUrl)
  const bridgeToken = String(config.uploadBridgeToken)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart vacío' })
  }

  const filePart = parts.find(p => p.name === 'file' && p.filename && p.data?.length)
  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Campo "file" requerido' })
  }

  if (filePart.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Archivo demasiado grande (máx 12 MB)' })
  }

  const mime = filePart.type || 'application/octet-stream'
  if (!ALLOWED.has(mime)) {
    throw createError({ statusCode: 415, statusMessage: 'Tipo no permitido (usa imagen JPEG, PNG, WebP o GIF)' })
  }

  const formData = new FormData()
  formData.append('file', new Blob([filePart.data], { type: mime }), filePart.filename)

  let res: Response
  try {
    res = await fetch(bridgeUrl, {
      method: 'POST',
      headers: { Authorization: bridgeToken },
      body: formData
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'No se pudo conectar con el servicio de almacenamiento' })
  }

  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `Servicio de almacenamiento respondió ${res.status}` })
  }

  const result = await res.json() as { success?: boolean; url?: string; error?: string }

  if (!result.success || !result.url) {
    throw createError({ statusCode: 502, statusMessage: result.error ?? 'Respuesta inválida del servicio de almacenamiento' })
  }

  return { ok: true, url: result.url }
})
