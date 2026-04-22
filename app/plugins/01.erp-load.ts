export default defineNuxtPlugin({
  name: 'erp-load',
  enforce: 'pre',
  async setup() {
    const store = useInventarioStore()
    try {
      await store.ensureLoaded()
    } catch {
      /** MySQL caído o sin tablas: la UI puede quedar sin datos hasta que DB responda. */
    }
  }
})
