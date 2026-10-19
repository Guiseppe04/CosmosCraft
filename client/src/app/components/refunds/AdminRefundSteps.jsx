import { useId, useRef, useState } from 'react'

// Navigation only: keep panels mounted so uploads and unsaved form values survive.
export default function AdminRefundSteps({ children, actionTitle, status, disabled = false }) {
  const [active, setActive] = useState(['pending', 'under_review'].includes(status) ? 0 : 2)
  const id = useId(), heading = useRef(null)
  const steps = ['Request details', 'Photos and evidence', actionTitle]
  function navigate(index) {
    setActive(index)
    heading.current?.focus()
    heading.current?.scrollIntoView({ block: 'nearest' })
  }
  return <div className="space-y-4">
    <nav aria-label="Admin refund steps">
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {steps.map((title, index) => <li key={index}>
          <button type="button" aria-label={`Step ${index + 1}: ${title}`} aria-current={active === index ? 'step' : undefined} disabled={disabled}
            onClick={() => navigate(index)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)] ${active === index ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current font-semibold">{index + 1}</span>
            <span>{title}</span>
          </button>
        </li>)}
      </ol>
    </nav>
    <div>
      <h3 ref={heading} tabIndex={-1} id={`${id}-heading`} className="text-base font-semibold text-[var(--text-light)] outline-none">Step {active + 1} of 3: {steps[active]}</h3>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Back and Next only change the section. Use the action button to save a decision.</p>
    </div>
    {children.map((panel, index) => <div key={index} hidden={active !== index} className="space-y-4" aria-label={steps[index]}>{panel}</div>)}
    <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
      <button type="button" disabled={disabled || active === 0} onClick={() => navigate(active - 1)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-light)] disabled:opacity-40">Back</button>
      <span className="text-xs text-[var(--text-muted)]">{active + 1} / 3</span>
      {active < 2 ? <button type="button" disabled={disabled} onClick={() => navigate(active + 1)} className="rounded-lg bg-[var(--gold-primary)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">Next</button> : <span className="w-16" aria-hidden="true" />}
    </div>
  </div>
}
