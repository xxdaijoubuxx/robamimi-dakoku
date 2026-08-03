import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: '/robamimi-dakoku/',
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
})
