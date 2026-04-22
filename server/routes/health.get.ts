/** Sin DB ni dependencias: comprobar que el servidor responde (p. ej. curl /health). */
export default defineEventHandler(() => ({
  ok: true,
  service: 'tradeerp',
  at: new Date().toISOString()
}))
