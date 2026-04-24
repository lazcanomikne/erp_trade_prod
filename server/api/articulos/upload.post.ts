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
  // Apache en cPanel suele eliminar el header Authorization antes de que llegue a PHP.
  // Enviamos el token también como campo POST para que el bridge pueda leerlo desde $_POST['token'].
  formData.append('token', bridgeToken)

  let res: Response
  try {
    res = await fetch(bridgeUrl, {
      method: 'POST',
      headers: { Authorization: bridgeToken },
      body: formData
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw createError({ statusCode: 502, statusMessage: `Bridge inalcanzable (${bridgeUrl}): ${msg}` })
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw createError({ statusCode: 502, statusMessage: `Bridge respondió ${res.status} — ${body.slice(0, 200)}` })
  }

  let result: { success?: boolean; url?: string; error?: string }
  try {
    result = await res.json() as typeof result
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Bridge devolvió respuesta no-JSON' })
  }

  if (!result.success || !result.url) {
    throw createError({ statusCode: 502, statusMessage: result.error ?? 'Bridge: success=false sin url' })
  }

  return { ok: true, url: result.url }
})
