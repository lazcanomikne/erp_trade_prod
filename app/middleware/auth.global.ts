export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig()
  if (!config.public.requireAuth) {
    return
  }

  if (to.path === '/login') {
    return
  }

  const auth = useAuthStore()
  if (auth.isLoggedIn) {
    return
  }

  return navigateTo({
    path: '/login',
    ...(to.path !== '/' && { query: { redirect: to.fullPath } })
  })
})
