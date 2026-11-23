/**
 * Design-review only. Serves index.education-preview.html with the Education
 * page's data layer replaced by an in-memory mock, so the real components can
 * be reviewed without a network session. `npm run dev` / `npm run build`
 * ignore this file.
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const mock = fileURLToPath(new URL('./src/preview/educationMockApi.js', import.meta.url))
const supabaseStub = fileURLToPath(new URL('./src/preview/supabaseStub.js', import.meta.url))

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', allowedHosts: true },
  resolve: {
    alias: [
      { find: /^\.\.\/Services\/educationApi$/, replacement: mock },
      { find: /^\.\.\/\.\.\/Services\/educationApi$/, replacement: mock },
      // No network in a design review: stub the Supabase client too.
      { find: /^.*\/lib\/supabase$/, replacement: supabaseStub },
    ],
  },
})
