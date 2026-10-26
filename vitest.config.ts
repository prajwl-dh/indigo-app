import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Electron end-to-end tests build and launch the app, so they run
        // separately through `npm run test:e2e`.
        exclude: [...configDefaults.exclude, 'e2e/**']
    }
})
