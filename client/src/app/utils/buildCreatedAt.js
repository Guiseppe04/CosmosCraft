export function getBuildCreatedAt(build = {}, customization = {}) {
  return customization.created_at || build.created_at || build.createdAt || build.savedAt || null
}

export function formatBuildCreatedAt(build, customization) {
  const value = getBuildCreatedAt(build, customization)
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Date unavailable'
  const options = { timeZone: 'Asia/Manila' }
  const day = date.toLocaleDateString('en-US', { ...options, month: 'short', day: 'numeric', year: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { ...options, hour: 'numeric', minute: '2-digit' })
  return `${day} • ${time}`
}
