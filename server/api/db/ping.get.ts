import { pingMysql } from '../../utils/db'

/** Comprueba conectividad MySQL (útil tras configurar .env). */
export default defineEventHandler(async () => {
  const ok = await pingMysql()
  return { ok, mysql: ok ? 'reachable' : 'unreachable' }
})
