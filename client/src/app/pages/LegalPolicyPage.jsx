import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSiteContact } from '../hooks/useSiteContact'
import { POLICY_UPDATED, termsOfService, privacyPolicy } from '../content/sitePolicies'
import TermsAndConditionsModal from '../components/TermsAndConditionsModal'

function LegalPolicyPage({ policy, showPurchaseTerms = false }) {
  const contact = useSiteContact()
  const [termsOpen, setTermsOpen] = useState(false)
  useEffect(() => {
    const previous = document.title
    document.title = `${policy.title} | CosmosCraft`
    return () => { document.title = previous }
  }, [policy.title])
  return <article className="mx-auto max-w-4xl px-4 pb-16 pt-28 text-[var(--text-light)] sm:px-6 sm:pt-32">
    <Link to="/" className="text-sm text-[var(--gold-primary)] hover:underline">Back to CosmosCraft</Link>
    <header className="mt-6 border-b border-[var(--border)] pb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-primary)]">CosmosCraft</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{policy.title}</h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">Last updated: <time dateTime="2026-10-07">{POLICY_UPDATED}</time></p>
      <p className="mt-5 text-base leading-7 text-[var(--text-muted)]">{policy.introduction}</p>
    </header>
    <nav aria-label="On this page" className="my-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
      <h2 className="text-sm font-semibold">On this page</h2>
      <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{policy.sections.map(section => <li key={section.id}>
        <a href={`#${section.id}`} className="text-[var(--gold-primary)] hover:underline">{section.title}</a>
      </li>)}</ul>
    </nav>
    <div className="space-y-8">{policy.sections.map((section,index) => <section id={section.id} key={section.id} className="scroll-mt-28">
      <h2 className="text-xl font-semibold">{index + 1}. {section.title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--text-muted)]">{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
      {section.links?.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-block break-words text-sm text-[var(--gold-primary)] underline underline-offset-4">{link.label}</a>)}
    </section>)}</div>
    {showPurchaseTerms && <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-5">
      <h2 className="text-lg font-semibold">Terms for your purchase</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Read the current order and customization terms used at checkout.</p>
      <button type="button" onClick={() => setTermsOpen(true)} className="mt-4 rounded-lg bg-[var(--gold-primary)] px-4 py-2.5 text-sm font-semibold text-black">View purchase terms</button>
    </div>}
    <section className="mt-8 border-t border-[var(--border)] pt-8">
      <h2 className="text-xl font-semibold">Contact CosmosCraft</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">For questions about this policy{showPurchaseTerms ? '' : ' or requests about your personal information'}, email <a href={`mailto:${contact.email}`} className="break-all text-[var(--gold-primary)] underline">{contact.email}</a>. Include enough information to identify your request.</p>
      <Link to={showPurchaseTerms ? '/privacy-policy' : '/terms-of-service'} className="mt-4 inline-block text-sm text-[var(--gold-primary)] hover:underline">Read the {showPurchaseTerms ? 'Privacy Policy' : 'Terms of Service'}</Link>
    </section>
    {showPurchaseTerms && <TermsAndConditionsModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />}
  </article>
}

export function TermsOfServicePage() { return <LegalPolicyPage policy={termsOfService} showPurchaseTerms /> }
export function PrivacyPolicyPage() { return <LegalPolicyPage policy={privacyPolicy} /> }
