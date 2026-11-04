import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// static hosts serve 404.html for unknown paths, which lets /work/<slug> boot the app
const spaFallback = () => ({
  name: 'spa-fallback',
  closeBundle() {
    const dist = path.resolve('dist')
    if (fs.existsSync(path.join(dist, 'index.html'))) fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'))
  },
})

export default defineConfig({ plugins: [react(), spaFallback()] })
