/** Sin DB ni dependencias: útil para comprobar que Node/Passenger responde (curl /health). */
export default defineEventHandler(() => ({
  ok: true,
  service: 'tradeerp',
  at: new Date().toISOString()
}))
