import { useEffect, useSyncExternalStore } from 'react'
import { useSocketEvent } from '../context/SocketContext'
import {
  getSiteContactSnapshot,
  publishSiteContact,
  refreshSiteContact,
  subscribeSiteContact,
} from '../utils/siteContact'

export function useSiteContact() {
  const contact = useSyncExternalStore(
    subscribeSiteContact,
    getSiteContactSnapshot,
    getSiteContactSnapshot,
  )

  useEffect(() => {
    refreshSiteContact()
    // Refresh after returning to a tab, including updates missed while offline.
    window.addEventListener('focus', refreshSiteContact)
    return () => window.removeEventListener('focus', refreshSiteContact)
  }, [])

  useSocketEvent('site-contact:updated', publishSiteContact)
  useSocketEvent('connect', refreshSiteContact)

  return contact
}
