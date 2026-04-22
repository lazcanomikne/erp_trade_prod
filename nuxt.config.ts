// https://nuxt.com/docs/api/configuration/nuxt-config

/** Evita undefined/"" en producción si faltan variables en el panel de hosting. */
function envOr(value: string | undefined, fallback: string): string {
  const v = value != null ? String(value).trim() : ''
  return v.length ? v : fallback
}

const defaultDbHost = 'localhost'
const defaultDbPort = '3306'
const defaultDbUser = 'sa'
const defaultDbPassword = ''
const defaultDbName = 'tradeadmin_sergio_erp_comercial'
const defaultUploadsBase = 'http://erp.tradestandart.com.mx/uploads/articulos'

export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt',
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],
  ssr: true,
  devtools: {
    enabled: true
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    /** DB_* en .env / Vercel; NUXT_MYSQL_* se mantiene como respaldo por compatibilidad. */
    dbHost: envOr(
      process.env.DB_HOST || process.env.NUXT_MYSQL_HOST,
      defaultDbHost
    ),
    dbPort: envOr(
      process.env.DB_PORT || process.env.NUXT_MYSQL_PORT,
      defaultDbPort
    ),
    dbUser: envOr(
      process.env.DB_USER || process.env.NUXT_MYSQL_USER,
      defaultDbUser
    ),
    dbPassword: envOr(
      process.env.DB_PASSWORD ?? process.env.NUXT_MYSQL_PASSWORD,
      defaultDbPassword
    ),
    dbName: envOr(
      process.env.DB_NAME || process.env.NUXT_MYSQL_DATABASE,
      defaultDbName
    ),
    public: {
      /** Solo true si el env es exactamente la cadena "true" (minúsculas). */
      requireAuth: envOr(process.env.NUXT_PUBLIC_REQUIRE_AUTH, 'false') === 'true',
      uploadsPublicBase: envOr(process.env.NUXT_PUBLIC_UPLOADS_PUBLIC_BASE, defaultUploadsBase)
    }
  },

  build: {
    transpile: ['vue']
  },

  routeRules: {
    '/': { redirect: '/dashboard' },
    '/modulos': { redirect: '/dashboard' },
    '/logistica/limbo': { redirect: '/logistica/arribos-no-identificados' },
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    preset: 'vercel',
    externals: {
      inline: ['vue', '@vue/server-renderer']
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
