import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds to ./dist, which admin/firebase.json serves as the `strengthhub-admin`
// Hosting site.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
})
