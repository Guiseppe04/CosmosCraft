import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSiteContact } from '../hooks/useSiteContact'
import { useModalScrollLock } from '../hooks/useModalScrollLock'
import { ALL_TERMS_TYPES, TERMS_BY_TYPE } from '../utils/checkoutTerms'
import { termsOfService, privacyPolicy } from '../content/sitePolicies'

export default function TermsAndConditionsModal({ isOpen, onClose, types = ALL_TERMS_TYPES, account = false, onAgree }) {
  const contact = useSiteContact()
  const id = useId()
  const panel = useRef(null)
  const dialog = useRef(null)
  const submitting = useRef(false)
  const [read, setRead] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scope = account ? 'account' : types.join(',')
  useModalScrollLock(isOpen)
  useEffect(() => {
    if (!isOpen) return
    setRead(false)
    setError('')
    const previous = document.activeElement
    const element = panel.current
    element.scrollTop = 0
    element.focus()
    // Fully visible content needs no scrolling; explicit agreement is still required.
    const check = () => {
      if (element.clientHeight > 0 && element.scrollHeight <= element.clientHeight + 2) setRead(true)
    }
    const observer = new ResizeObserver(check)
    observer.observe(element)
    check()
    return () => { observer.disconnect(); previous?.focus?.() }
  }, [isOpen, scope])
  const close = () => { if (!submitting.current) onClose() }
  const agree = async () => {
    if (!read || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try { await onAgree() }
    catch (failure) { setError(failure.message || 'Unable to save your agreement. Please try again.') }
    finally { submitting.current = false; setBusy(false) }
  }
  const handleKeys = event => {
    if (event.key === 'Escape') { event.preventDefault(); close() }
    if (event.key !== 'Tab') return
    const elements = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')]
    const first = elements[0], last = elements[elements.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  if (!isOpen) return null
  const documents = account
    ? [{ label: termsOfService.title, description: termsOfService.introduction, sections: termsOfService.sections },
       { label: privacyPolicy.title, description: privacyPolicy.introduction, sections: privacyPolicy.sections }]
    : ALL_TERMS_TYPES.filter(type => types.includes(type)).map(type => TERMS_BY_TYPE[type])
  return createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={handleKeys}
      className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] shadow-2xl">
      <header className="shrink-0 border-b border-[var(--border)] p-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">CosmosCraft</p>
        <h2 id={`${id}-title`} className="mt-2 text-xl font-bold sm:text-2xl">Terms and Conditions</h2>
        <p id={`${id}-instruction`} className="mt-2 text-sm text-[var(--text-muted)]">{onAgree ? 'Scroll to the bottom of these terms to enable acknowledgment.' : 'Review the applicable terms below.'}</p>
      </header>
      <div ref={panel} tabIndex={0} aria-describedby={`${id}-instruction`}
        onScroll={event => {
          const element = event.currentTarget
          if (element.scrollTop + element.clientHeight >= element.scrollHeight - 2) setRead(true)
        }}
        className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 text-sm leading-7 text-[var(--text-muted)] sm:px-6">
        {documents.map(document => <section key={document.label} className="space-y-5">
          <h3 className="text-lg font-bold text-[var(--gold-primary)]">{document.label}</h3>
          <p>{document.description}</p>
          {document.sections.map((section, index) => <section key={section.title}>
            <h4 className="font-bold text-[var(--text-light)]">{index + 1}. {section.title}</h4>
            {section.paragraphs.map(paragraph => <p key={paragraph} className="mt-2">{paragraph}</p>)}
            {section.links?.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="text-[var(--gold-primary)] underline">{link.label}</a>)}
          </section>)}
          {document.summary && <p className="rounded-xl border border-[var(--border)] p-4">{document.summary}</p>}
        </section>)}
        <section><h4 className="font-bold text-[var(--text-light)]">Questions and Support</h4>
          <p>Contact CosmosCraft through the Contact Us page or email for clarification before agreeing.</p>
          <a href={`mailto:${contact.email}`} className="break-all text-[var(--gold-primary)] underline">{contact.email}</a>
        </section>
      </div>
      <footer className="shrink-0 space-y-3 border-t border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:px-6">
        {onAgree && <p aria-live="polite" className="text-sm" style={{ color: read ? '#22c55e' : '#ef4444' }}>{read ? 'You can now acknowledge these terms.' : 'Please scroll through the complete terms above.'}</p>}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <button type="button" disabled={busy} onClick={close} className="rounded-xl border border-[var(--border)] px-4 py-3 disabled:opacity-50">{onAgree ? 'Cancel' : 'Close'}</button>
          {onAgree && <button type="button" disabled={!read || busy} onClick={agree}
            className="rounded-xl bg-[var(--gold-primary)] px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Saving acknowledgment...' : 'I Have Read and Agree to the Terms and Conditions'}</button>}
        </div>
      </footer>
    </div>
  </div>, document.body)
}
