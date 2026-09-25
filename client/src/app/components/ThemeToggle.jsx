import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme()

  if (!mounted) {
    return <div className="h-8 w-8" />
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="mobile-theme-toggle inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-elevated)] hover:text-[var(--gold-primary)]"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
