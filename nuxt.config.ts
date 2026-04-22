// https://nuxt.com/docs/api/configuration/nuxt-config
import { copyFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Evita undefined/"" en producción si faltan variables en el panel de hosting. */
function envOr(value: string | undefined, fallback: string): string {
  const v = value != null ? String(value).trim() : ''
  return v.length ? v : fallback
}

const defaultMysqlHost = 'localhost'
const defaultMysqlPort = '3306'
const defaultMysqlUser = 'sa'
const defaultMysqlPassword = ''
const defaultMysqlDatabase = 'tradeadmin_sergio_erp_comercial'
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
    mysqlHost: envOr(process.env.NUXT_MYSQL_HOST, defaultMysqlHost),
    mysqlPort: envOr(process.env.NUXT_MYSQL_PORT, defaultMysqlPort),
    mysqlUser: envOr(process.env.NUXT_MYSQL_USER, defaultMysqlUser),
    mysqlPassword: envOr(process.env.NUXT_MYSQL_PASSWORD, defaultMysqlPassword),
    mysqlDatabase: envOr(process.env.NUXT_MYSQL_DATABASE, defaultMysqlDatabase),
    public: {
      /** Solo true si el env es exactamente la cadena "true" (minúsculas). */
      requireAuth: envOr(process.env.NUXT_PUBLIC_REQUIRE_AUTH, 'false') === 'true',
      uploadsPublicBase: envOr(process.env.NUXT_PUBLIC_UPLOADS_PUBLIC_BASE, defaultUploadsBase)
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
        const out = nitro.options.output.dir
        const root = nitro.options.rootDir
        // Punto de entrada en servidor: app.cjs. La línea "Apache" suelta no es directiva válida → # Apache.
        const htaccess = [
          '# Apache',
          'RewriteEngine On',
          'RewriteCond %{REQUEST_FILENAME} !-f',
          'RewriteCond %{REQUEST_FILENAME} !-d',
          'RewriteRule ^(.*)$ app.cjs/$1 [L]',
          ''
        ].join('\n')
        await writeFile(join(out, '.htaccess'), htaccess, 'utf8')
        await copyFile(join(root, 'app.cjs'), join(out, 'app.cjs'))
        // Sin dependencias: mysql2, xlsx, etc. en node_modules del servidor (no sobrescribir con FTP).
        await writeFile(
          join(out, 'package.json'),
          `${JSON.stringify({ type: 'module' }, null, 2)}\n`,
          'utf8'
        )
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
