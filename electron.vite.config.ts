import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import path from 'path'

export default defineConfig({
    main: {},
    preload: {},
    renderer: {
        resolve: {
            alias: {
                src: path.resolve(__dirname, 'src')
            }
        },
        plugins: [react()]
    }
})
