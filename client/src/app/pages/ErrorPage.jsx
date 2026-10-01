import { RotateCw, TriangleAlert } from 'lucide-react'
import { useNavigate, useRouteError } from 'react-router'
import './ErrorPage.css'

export function ErrorPage() {
  const navigate = useNavigate()
  const error = useRouteError()

  const retry = () => navigate('/', { replace: true })

  return (
    <main className="route-error" aria-labelledby="route-error-title">
      <div className="route-error__content">
        <div className="route-error__illustration" aria-hidden="true">
          <div className="route-error__box-back" />
          <div className="route-error__box-front" />
          <div className="route-error__alert">
            <TriangleAlert className="route-error__alert-icon" strokeWidth={2.5} />
          </div>
        </div>

        <h1 id="route-error-title">Oops, that's our bad</h1>
        <p>
          We're not exactly sure what happened, but something went wrong.
          <br />
          If you need immediate help, <a href="/#contact">let us know</a>.
        </p>
        <button className="route-error__retry" onClick={retry} type="button">
          <RotateCw aria-hidden="true" size={15} />
          Try again
        </button>
        {import.meta.env.DEV && error instanceof Error && (
          <details className="route-error__details">
            <summary>Technical details</summary>
            <pre>{error.message}</pre>
          </details>
        )}
      </div>
    </main>
  )
}