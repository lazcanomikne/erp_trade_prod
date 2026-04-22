export interface AuthSession {
  authenticated: boolean
  username: string
}

export const useAuthStore = defineStore('auth', () => {
  const session = useCookie<AuthSession | null>('auth-session', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    path: '/'
  })

  const isLoggedIn = computed(() => session.value?.authenticated === true)
  const username = computed(() => session.value?.username ?? null)

  function login(user: string, password: string): boolean {
    if (user === 'admin' && password === 'admin') {
      session.value = { authenticated: true, username: user }
      return true
    }
    return false
  }

  function logout() {
    session.value = null
  }

  return { session, isLoggedIn, username, login, logout }
})
