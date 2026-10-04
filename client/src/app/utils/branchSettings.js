import { API } from './apiConfig'

export const DEFAULT_APPOINTMENT_BRANCH = {
  id: 'balagtas-main',
  name: 'CosmosCraft Balagtas Branch',
  address: 'Sp 047-K St Peter Compound, Balagtas, 3016 Bulacan',
  hours: 'Mon-Sat 9:00 AM - 6:00 PM',
  address_details: null,
}
// Keep database-backed cache separate from the former browser-only setting.
export const BRANCH_SETTINGS_STORAGE_KEY = 'cosmoscraft.branch.settings'
const listeners = new Set()
let revision = 0
let pendingRequest = null

function parseBranch(value) {
  if (value?.id !== DEFAULT_APPOINTMENT_BRANCH.id || typeof value?.address !== 'string' || !value.address.trim()) return null
  return {
    id: value.id,
    name: value.name || DEFAULT_APPOINTMENT_BRANCH.name,
    address: value.address.trim(),
    hours: value.hours || DEFAULT_APPOINTMENT_BRANCH.hours,
    address_details: value.address_details || null,
  }
}

function readCachedBranch() {
  if (typeof window === 'undefined') return null
  try {
    return parseBranch(JSON.parse(window.localStorage.getItem(BRANCH_SETTINGS_STORAGE_KEY)))
  } catch { return null }
}

let snapshot = { branch: readCachedBranch() || DEFAULT_APPOINTMENT_BRANCH, isLoading: true, isLoaded: false, error: null }
export const getBranchSettingsSnapshot = () => snapshot

function updateSnapshot(changes) {
  snapshot = { ...snapshot, ...changes }
  listeners.forEach((listener) => listener())
}

function applyBranch(value, persist = true) {
  const branch = parseBranch(value)
  if (!branch) return snapshot.branch
  if (persist && typeof window !== 'undefined') {
    try { window.localStorage.setItem(BRANCH_SETTINGS_STORAGE_KEY, JSON.stringify(branch)) }
    catch { /* Storage is only a cache; the database remains authoritative. */ }
  }
  if (JSON.stringify(branch) !== JSON.stringify(snapshot.branch) || !snapshot.isLoaded || snapshot.error || snapshot.isLoading) {
    revision += 1
    updateSnapshot({ branch, isLoaded: true, isLoading: false, error: null })
  }
  return snapshot.branch
}

export function publishBranchSettings(branch) {
  revision += 1
  return applyBranch(branch)
}

const onStorage = (event) => {
  if (event.key === BRANCH_SETTINGS_STORAGE_KEY) applyBranch(readCachedBranch(), false)
}

export function subscribeBranchSettings(listener) {
  if (listeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

export function refreshBranchSettings() {
  if (pendingRequest) return pendingRequest
  const startedAtRevision = revision
  updateSnapshot({ isLoading: !snapshot.isLoaded, error: null })
  pendingRequest = Promise.resolve()
    .then(() => fetch(`${API}/api/branch/settings`))
    .then(async (response) => {
      const result = await response.json()
      if (!response.ok || !parseBranch(result.data)) throw new Error(result.message || 'Failed to load branch address.')
      if (revision === startedAtRevision) applyBranch(result.data)
      return snapshot.branch
    })
    .catch((error) => {
      if (revision === startedAtRevision) updateSnapshot({ isLoading: false, error: error.message })
      return snapshot.branch
    })
    .finally(() => { pendingRequest = null })
  return pendingRequest
}
