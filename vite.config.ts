/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Phase 0 c1 has no test files yet (dataset invariants arrive with c2).
    // Removed as soon as real tests exist, so a broken include glob can't
    // silently pass.
    passWithNoTests: true,
  },
})
