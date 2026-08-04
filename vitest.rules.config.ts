import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/firebase/firestore.rules.test.ts'],
  },
})
