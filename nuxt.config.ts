// https://nuxt.com/docs/api/configuration/nuxt-config
import { copyFile } from 'node:fs/promises'
import { join } from 'node:path'

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
    mysqlHost: process.env.NUXT_MYSQL_HOST || 'localhost',
    mysqlPort: process.env.NUXT_MYSQL_PORT || '3306',
    mysqlUser: process.env.NUXT_MYSQL_USER || 'sa',
    mysqlPassword: process.env.NUXT_MYSQL_PASSWORD || '',
    mysqlDatabase: process.env.NUXT_MYSQL_DATABASE || 'tradeadmin_sergio_erp_comercial',
    public: {
      requireAuth: process.env.NUXT_PUBLIC_REQUIRE_AUTH === 'true',
      uploadsPublicBase: process.env.NUXT_PUBLIC_UPLOADS_PUBLIC_BASE
        || 'http://erp.tradestandart.com.mx/uploads/articulos'
    }
  },

  routeRules: {
    '/': { redirect: '/dashboard' },
    '/modulos': { redirect: '/dashboard' },
    '/logistica/limbo': { redirect: '/logistica/arribos-no-identificados' },
    '/api/**': {
      cors: true
    }
  },

  devServer: {
    port: 7020,
    host: '0.0.0.0'
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    output: {
      serverDir: '.output/server',
      publicDir: '.output/public'
    },
    hooks: {
      compiled: async (nitro) => {
        const src = join(nitro.options.rootDir, 'public/.htaccess')
        const dest = join(nitro.options.output.dir, '.htaccess')
        await copyFile(src, dest)
      }
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
