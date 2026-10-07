import { useId, useState } from 'react'
import SitePolicyModal from './SitePolicyModal'

export default function SitePolicyAgreement({ checked, onChange, inputRef, error }) {
  const id = useId()
  const [type, setType] = useState(null)
  return <>
    <div className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
      <input id={id} ref={inputRef} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--gold-primary)]" />
      <div>
        <label htmlFor={id} className="cursor-pointer">I agree to the 
          <button type="button" onClick={() => setType('terms')} className="mx-1 font-medium text-[var(--gold-primary)] underline underline-offset-4"> Terms of Service </button>
           and acknowledge the 
          <button type="button" onClick={() => setType('privacy')} className="mx-1 font-medium text-[var(--gold-primary)] underline underline-offset-4"> Privacy Policy.</button>
        
        {error && <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
        </label>
      </div>
    </div>
    <SitePolicyModal type={type} onTypeChange={setType} onClose={() => setType(null)} agreement={{ checked, onChange }} />
  </>
}
