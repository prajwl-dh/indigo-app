export function capitalizeWords(value: string): string {
    return value
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

export function normalizeNoSpace(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '')
}

export function truncateActiveDatabasePath(filePath: string, maxLength = 20): string {
    if (filePath.length <= maxLength) return filePath

    const sep = filePath.includes('\\') ? '\\' : '/'
    const parts = filePath.split(sep)
    const fileName = parts.pop()!

    let start = ''
    let i = 0

    while (i < parts.length) {
        const next = start ? start + sep + parts[i] : parts[i]
        if ((next + sep + '..' + sep + fileName).length > maxLength) break
        start = next
        i++
    }

    if (i < parts.length) {
        return `${start}${sep}..${sep}${fileName}`
    } else {
        return `${start}${sep}${fileName}`
    }
}

export const stripHtml = (html: string): string => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent + ' ' || tmp.innerText + ' ' || ' '
}
