import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

const BASE_PATH = process.env.VITE_BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        exportType: "named",
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: "**/*.svg",
    }),
  ],
  // Allow overriding the build base path with VITE_BASE_PATH.
  base: command === 'build' ? BASE_PATH : '/',
}))
