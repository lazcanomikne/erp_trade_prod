export default defineNuxtPlugin({
  name: 'erp-load',
  /** Sin `enforce: 'pre'`: debe ir después del plugin `pinia` (@pinia/nuxt). */
  dependsOn: ['pinia'],
  async setup() {
    const store = useInventarioStore()
    try {
      await store.ensureLoaded()
    } catch {
      /** MySQL caído o sin tablas: la UI puede quedar sin datos hasta que DB responda. */
    }
  }
})
