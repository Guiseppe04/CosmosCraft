import { Link } from 'react-router'
import { ArrowLeft, ArrowRight, Orbit, Sparkles } from 'lucide-react'

export function NotFoundPage() {
  return (
    <section
      aria-labelledby="not-found-title"
      className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-5 py-16 text-[var(--text-light)] sm:px-8"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
        <div className="relative mb-8 flex h-32 w-32 items-center justify-center text-[var(--gold-primary)]">
          <div className="absolute inset-2 rounded-full border border-[var(--gold-primary)]/35" />
          <div className="absolute inset-0 rounded-full border border-dashed border-[var(--gold-primary)]/20" />
          <Orbit aria-hidden="true" className="h-20 w-20 stroke-[1.25]" />
          <Sparkles aria-hidden="true" className="absolute right-1 top-3 h-5 w-5 text-[var(--gold-secondary)]" />
          <span className="absolute -bottom-1 rounded-full border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-1 text-xs font-bold tracking-[0.16em] text-[var(--text-light)]">
            404
          </span>
        </div>

        <h1 id="not-found-title" className="text-3xl font-bold text-[var(--text-light)] sm:text-4xl">
          Page Not Found
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
          We couldn't find the page you were looking for. The link may be out of date, or the page may have moved.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-dark)] transition-colors hover:bg-[var(--gold-secondary)]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to homepage
          </Link>
          <Link
            to="/#contact"
            className="inline-flex items-center gap-2 py-3 text-sm font-semibold text-[var(--gold-primary)] transition-colors hover:text-[var(--gold-secondary)]"
          >
            Contact support
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}