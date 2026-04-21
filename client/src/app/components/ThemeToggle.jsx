import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme()

  if (!mounted) {
    return <div className="h-8 w-[62px] rounded-full border border-[var(--border)] bg-[var(--surface-dark)]" />
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-dark)] px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors duration-200 hover:border-[var(--gold-primary)]"
    >
      <span
        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
          isDark ? 'bg-[var(--gold-primary)]/85' : 'bg-[var(--surface-elevated)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isDark ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}
