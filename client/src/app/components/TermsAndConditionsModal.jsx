import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSiteContact } from '../hooks/useSiteContact'
import { ALL_TERMS_TYPES, TERMS_BY_TYPE } from '../utils/checkoutTerms'

export default function TermsAndConditionsModal({ isOpen, onClose, types = ALL_TERMS_TYPES, initialType }) {
  const contactInfo = useSiteContact()
  const availableTypes = ALL_TERMS_TYPES.filter((type) => types.includes(type))
  const defaultType = availableTypes.includes(initialType) ? initialType : availableTypes[0]
  const [selectedType, setSelectedType] = useState(defaultType)
  useEffect(() => { if (isOpen) setSelectedType(defaultType) }, [isOpen, defaultType])
  const activeType = availableTypes.includes(selectedType) ? selectedType : defaultType
  const terms = TERMS_BY_TYPE[activeType]

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !terms) return null

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
        <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }} role="dialog" aria-modal="true" aria-labelledby="checkout-terms-title"
          className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)] shadow-2xl">
          <div className="shrink-0 border-b border-[var(--border)] px-5 py-5 sm:px-6 flex justify-between items-start gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">CosmosCraft</p>
              <h3 id="checkout-terms-title" className="mt-2 text-xl sm:text-2xl font-bold">{terms.label}</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Close terms and conditions"
              className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-light)]">X</button>
          </div>
          {availableTypes.length > 1 && (
            <div role="tablist" aria-label="Terms categories" className="shrink-0 flex gap-2 border-b border-[var(--border)] px-5 py-3 sm:px-6">
              {availableTypes.map((type) => (
                <button key={type} type="button" role="tab" id={`terms-tab-${type}`} aria-controls={`terms-panel-${type}`}
                  aria-selected={activeType === type} onClick={() => setSelectedType(type)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${activeType === type ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-light)]'}`}>
                  {TERMS_BY_TYPE[type].shortLabel}
                </button>
              ))}
            </div>
          )}
          <div key={activeType} id={`terms-panel-${activeType}`} role={availableTypes.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={availableTypes.length > 1 ? `terms-tab-${activeType}` : undefined} tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6 space-y-5 text-sm text-[var(--text-muted)]">
            <div className="rounded-2xl border border-[var(--gold-primary)]/35 bg-[var(--gold-primary)]/10 px-5 py-4">
              <p className="font-semibold text-[var(--text-light)]">Please read these terms before completing checkout.</p>
              <p className="mt-2">{terms.description}</p>
            </div>
            {terms.sections.map((section, index) => (
              <section key={section.title}>
                <h4 className="font-bold text-[var(--text-light)]">{index + 1}. {section.title}</h4>
                {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-2 leading-relaxed">{paragraph}</p>)}
              </section>
            ))}
            <section>
              <h4 className="font-bold text-[var(--text-light)]">Questions and Support</h4>
              <p className="mt-2">Contact CosmosCraft through the Contact Us page or by email if you need clarification before accepting these terms.</p>
              <a href={`mailto:${contactInfo.email}`} className="mt-2 inline-block break-all text-[var(--gold-primary)] underline underline-offset-4 hover:text-[var(--gold-secondary)]">{contactInfo.email}</a>
            </section>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
              <h4 className="font-bold text-[var(--text-light)]">Acceptance</h4>
              <p className="mt-2">{terms.summary}</p>
            </section>
          </div>
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4 sm:px-6 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3 hover:bg-[var(--bg-primary)]">Close</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
