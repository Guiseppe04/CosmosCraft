import { useEffect, useState } from 'react'

const memoryDrafts = new Map()
const readDraft = (key) => {
  if (memoryDrafts.has(key)) return memoryDrafts.get(key)
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || 'null')
    return draft && Array.isArray(draft.stickers) ? draft : null
  } catch { return null }
}

// Matches the builder config's session draft without changing any selections.
export function useStickerDraft(builderType) {
  const key = `cosmoscraft.${builderType}.stickerDraft`
  const [stickers, setStickers] = useState(() => readDraft(key)?.stickers || [])
  const [selectedStickerId, setSelectedStickerId] = useState(() => readDraft(key)?.selectedStickerId || null)
  useEffect(() => {
    const draft = { stickers, selectedStickerId }
    memoryDrafts.set(key, draft)
    try { sessionStorage.setItem(key, JSON.stringify(draft)) }
    catch (error) { console.warn('Sticker draft kept in memory; session storage is unavailable:', error.message) }
  }, [key, stickers, selectedStickerId])
  return { stickers, setStickers, selectedStickerId, setSelectedStickerId }
}
