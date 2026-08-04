import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { configDefaults } from 'vitest/config'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
  base: '/robamimi-dakoku/',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        setup: resolve(import.meta.dirname, 'index.html'),
        wake: resolve(import.meta.dirname, 'wake/index.html'),
        sleep: resolve(import.meta.dirname, 'sleep/index.html'),
        memo: resolve(import.meta.dirname, 'memo/index.html'),
        history: resolve(import.meta.dirname, 'history/index.html'),
      },
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'src/firebase/firestore.rules.test.ts'],
  },
})
