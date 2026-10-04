import { useEffect, useSyncExternalStore } from 'react'
import { useSocketEvent } from '../context/SocketContext'
import { getBranchSettingsSnapshot, publishBranchSettings, refreshBranchSettings, subscribeBranchSettings } from '../utils/branchSettings'

export function useBranchSettings() {
  const settings = useSyncExternalStore(subscribeBranchSettings, getBranchSettingsSnapshot, getBranchSettingsSnapshot)
  useEffect(() => {
    refreshBranchSettings()
    window.addEventListener('focus', refreshBranchSettings)
    return () => window.removeEventListener('focus', refreshBranchSettings)
  }, [])
  useSocketEvent('branch:updated', publishBranchSettings)
  useSocketEvent('connect', refreshBranchSettings)
  return settings
}
