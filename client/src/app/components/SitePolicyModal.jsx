import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSiteContact } from '../hooks/useSiteContact'
import { POLICY_UPDATED, termsOfService, privacyPolicy } from '../content/sitePolicies'
import { orderTerms } from '../content/orderTerms'
import { customizationTerms } from '../content/customizationTerms'

export default function SitePolicyModal({ type, onTypeChange, onClose, agreement }) {
  const contact = useSiteContact()
  const id = useId()
  const dialog = useRef(null), panel = useRef(null), closeButton = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  const open = Boolean(type)
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]') || [])
        .filter(element => element.getClientRects().length)
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open])
  useEffect(() => { if (panel.current) panel.current.scrollTop = 0 }, [type])
  if (!open) return null
  const policy = type === 'privacy' ? privacyPolicy : termsOfService
  return createPortal(<div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] shadow-2xl">
      <header className="shrink-0 border-b border-[var(--border)] p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-primary)]">CosmosCraft</p>
            <h2 id={`${id}-title`} className="mt-2 text-xl font-bold sm:text-2xl">{policy.title}</h2>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Last updated: {POLICY_UPDATED}</p></div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Close policy"
            className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Close</button>
        </div>
        <div role="tablist" aria-label="Site policies" className="mt-4 flex gap-2">{[['terms','Terms of Service'],['privacy','Privacy Policy']].map(([key,label]) =>
          <button key={key} type="button" role="tab" id={`${id}-${key}-tab`} aria-selected={type === key} aria-controls={`${id}-panel`}
            onClick={() => onTypeChange(key)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${type === key ? 'border-[var(--gold-primary)] text-[var(--gold-primary)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>{label}</button>
        )}</div>
      </header>
      <div ref={panel} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${type}-tab`} tabIndex={0}
        className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 text-sm leading-7 text-[var(--text-muted)] sm:p-6">
        <p>{policy.introduction}</p>
        {policy.sections.map((section,index) => <section key={section.id}>
          <h3 className="font-semibold text-[var(--text-light)]">{index + 1}. {section.title}</h3>
          {section.paragraphs.map(paragraph => <p key={paragraph} className="mt-2">{paragraph}</p>)}
          {section.links?.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-block text-[var(--gold-primary)] underline underline-offset-4">{link.label}</a>)}
        </section>)}
        {type === 'terms' && <details className="rounded-xl border border-[var(--border)] p-4">
          <summary className="cursor-pointer font-semibold text-[var(--text-light)]">Purchase terms for orders and customizations</summary>
          {[orderTerms,customizationTerms].map(purchase => <section key={purchase.id} className="mt-5 space-y-3">
            <h3 className="font-bold text-[var(--text-light)]">{purchase.label}</h3>
            {purchase.sections.map(section => <div key={section.title}><h4 className="font-semibold text-[var(--text-light)]">{section.title}</h4>
              {section.paragraphs.map(paragraph => <p key={paragraph} className="mt-2">{paragraph}</p>)}</div>)}
          </section>)}
        </details>}
        <section><h3 className="font-semibold text-[var(--text-light)]">Contact CosmosCraft</h3>
          <p className="mt-2">For policy questions or privacy requests, email <a href={`mailto:${contact.email}`} className="break-all text-[var(--gold-primary)] underline">{contact.email}</a>.</p>
        </section>
      </div>
      <footer className="shrink-0 space-y-3 border-t border-[var(--border)] p-4 sm:px-6">
        {agreement && <label className="flex items-start gap-3 text-sm text-[var(--text-muted)]">
          <input type="checkbox" checked={agreement.checked} onChange={event => agreement.onChange(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--gold-primary)]" />
          <span>I agree to the Terms of Service and acknowledge the Privacy Policy.</span>
        </label>}
        <div className="flex justify-end"><button type="button" onClick={onClose}
          className="rounded-lg bg-[var(--gold-primary)] px-5 py-2.5 text-sm font-semibold text-black">Done</button></div>
      </footer>
    </div>
  </div>, document.body)
}
