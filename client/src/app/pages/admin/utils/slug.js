export function generateSlug(text) {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function updateIfChanged(currentData, newData, setter) {
  const currentStr = JSON.stringify(currentData)
  const newStr = JSON.stringify(newData)
  if (currentStr !== newStr) {
    setter(newData)
  }
}
