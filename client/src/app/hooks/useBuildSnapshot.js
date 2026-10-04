import { useEffect, useRef, useState } from 'react'
import { buildSnapshot, normalizeBuildSnapshot } from '../utils/buildSnapshot.js'

// Keep the existing saved snapshot/navigation blocker. While a build is loaded,
// automatic defaults and placement hydration belong to its saved baseline.
export function useBuildSnapshot(config, stickers, draftKey, editing) {
  const [savedSnapshot, setSnapshot] = useState(() => {
    if (editing) return buildSnapshot(config, stickers)
    try { return normalizeBuildSnapshot(sessionStorage.getItem(`${draftKey}.savedSnapshot`)) }
    catch { return null }
  })
  const [loadingBaseline, setLoadingBaseline] = useState(Boolean(editing))
  const loadingRef = useRef(Boolean(editing))
  const current = buildSnapshot(config, stickers)
  useEffect(() => {
    if (loadingRef.current) {
      setSnapshot(current)
      try { sessionStorage.setItem(`${draftKey}.savedSnapshot`, current) } catch { }
    }
  }, [current, loadingBaseline, draftKey])

  const beginLoadedBuild = () => {
    loadingRef.current = true
    setLoadingBaseline(true)
  }
  const markDesignChanged = () => {
    if (loadingRef.current) {
      setSnapshot(current)
      loadingRef.current = false
      setLoadingBaseline(false)
    }
  }
  const setSavedSnapshot = snapshot => {
    loadingRef.current = false
    setLoadingBaseline(false)
    setSnapshot(normalizeBuildSnapshot(snapshot))
  }
  return { savedSnapshot, setSavedSnapshot, beginLoadedBuild, markDesignChanged,
    hasUnsavedChanges: !loadingBaseline && (savedSnapshot == null || savedSnapshot !== current) }
}
