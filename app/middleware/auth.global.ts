export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig()
  if (!config.public.requireAuth) {
    return
  }

  const auth = useAuthStore()
  if (auth.isLoggedIn) {
    return
  }

  return navigateTo({
    path: '/dashboard',
    ...(to.path !== '/' && to.path !== '/dashboard' && { query: { redirect: to.fullPath } })
  })
})
