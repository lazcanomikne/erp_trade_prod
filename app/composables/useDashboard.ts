import { createSharedComposable } from '@vueuse/core'

const _useDashboard = () => {
  const router = useRouter()

  defineShortcuts({
    'g-d': () => router.push('/dashboard'),
    'g-p': () => router.push('/proyectos'),
    'g-x': () => router.push('/cuentas-por-cobrar'),
    'g-l': () => router.push('/logistica'),
    'g-b': () => router.push('/logistica/arribos-no-identificados'),
    'g-r': () => router.push('/reportes')
  })

  return {}
}

export const useDashboard = createSharedComposable(_useDashboard)
