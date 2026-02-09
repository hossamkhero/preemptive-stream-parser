import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const studioDir = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
    root: resolve(studioDir),
    plugins: [
        react(),
        tailwindcss(),
    ],
})
