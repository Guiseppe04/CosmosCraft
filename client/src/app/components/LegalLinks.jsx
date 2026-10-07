import { useState } from 'react'
import SitePolicyModal from './SitePolicyModal'

export function LegalLinks() {
  const [type, setType] = useState(null)
  return <><nav aria-label="Legal policies" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
    <button type="button" onClick={() => setType('terms')} className="text-[var(--text-muted)] hover:text-[var(--gold-primary)] underline underline-offset-4">Terms of Service</button>
    <button type="button" onClick={() => setType('privacy')} className="text-[var(--text-muted)] hover:text-[var(--gold-primary)] underline underline-offset-4">Privacy Policy</button>
  </nav>
    <SitePolicyModal type={type} onTypeChange={setType} onClose={() => setType(null)} />
  </>
}
