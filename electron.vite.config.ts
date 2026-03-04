import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import path from 'path'

export default defineConfig({
    main: {
        build: {
            rollupOptions: {
                external: ['libsql']
            }
        }
    },
    preload: {},
    renderer: {
        resolve: {
            alias: {
                src: path.resolve(__dirname, 'src'),
                '@renderer': path.resolve('src/renderer/src')
            }
        },
        plugins: [react()]
    }
})
