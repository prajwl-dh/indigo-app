import { execSync } from 'child_process'
import fs from 'fs'

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const tag = `v${version}`

function release() {
    execSync(`git tag ${tag}`, { stdio: 'inherit' })
    execSync(`git push origin ${tag}`, { stdio: 'inherit' })
}

function deleteCurrentRelease() {
    execSync(`git tag -d ${tag}`, { stdio: 'inherit' })
    execSync(`git push origin --delete ${tag}`, { stdio: 'inherit' })
}

const command = process.argv[2]

if (command === 'release') {
    release()
}

if (command === 'delete') {
    deleteCurrentRelease()
}
