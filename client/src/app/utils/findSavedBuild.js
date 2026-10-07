import { readSavedBuilds, mergeWalkInSavedBuilds } from './walkInSavedBuilds.js'
import { adminApi } from './adminApi.js'

export async function findSavedBuild(id, authenticated) {
  let local
  for (const key of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
    const found = readSavedBuilds(window.localStorage, key).find(build => build.id === id)
    if (found) { local = found; break }
  }
  if (!authenticated || (local && !local.dbCustomizationId && !local.customization_id)) return local || null
  try {
    const { data } = await adminApi.getMyCustomizations()
    const databaseId = local?.dbCustomizationId || local?.customization_id || id
    const found = data.find(build => build.customization_id === databaseId)
    if (!found) return local || null
    return mergeWalkInSavedBuilds(local ? [local] : [], [found], found.user_id, found.guitar_type === 'bass' ? 'bass' : 'electric', true)[0]
  } catch (error) {
    if (local) return local
    throw error
  }
}
