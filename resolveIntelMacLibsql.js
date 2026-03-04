import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'

try {
    const pkg = '@libsql/darwin-x64'

    console.log(`📦 Downloading latest ${pkg}...`)
    const tarball = execSync(`npm pack ${pkg}`, { encoding: 'utf-8' }).trim()
    console.log(`Downloaded tarball: ${tarball}`)

    // Temp extraction folder
    const tempDir = join(process.cwd(), 'native-libsql-temp-x64')
    rmSync(tempDir, { recursive: true, force: true })
    mkdirSync(tempDir, { recursive: true })

    console.log(`📂 Extracting tarball...`)
    execSync(`tar -xzf ${tarball} -C ${tempDir} --strip-components=1`)

    // Remove tarball
    execSync(`rm ${tarball}`)

    // Target folder in node_modules
    const targetDir = join(process.cwd(), 'node_modules', '@libsql', 'darwin-x64')
    rmSync(targetDir, { recursive: true, force: true })
    mkdirSync(targetDir, { recursive: true })

    // Recursive copy
    function copyRecursive(src, dest) {
        const entries = readdirSync(src)
        for (const entry of entries) {
            const srcPath = join(src, entry)
            const destPath = join(dest, entry)
            if (statSync(srcPath).isDirectory()) {
                mkdirSync(destPath, { recursive: true })
                copyRecursive(srcPath, destPath)
            } else {
                copyFileSync(srcPath, destPath)
            }
        }
    }

    copyRecursive(tempDir, targetDir)

    // Clean up temp folder
    rmSync(tempDir, { recursive: true, force: true })

    console.log(`✅ ${pkg} is ready at node_modules/@libsql/darwin-x64`)
} catch (err) {
    console.error('❌ Failed to fetch or copy libsql x64:', err)
    process.exit(1)
}
