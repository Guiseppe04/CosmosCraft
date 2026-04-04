import { Sun, Moon } from 'lucide-react'
import { motion } from 'motion/react'
import { useTheme } from '../context/ThemeContext.jsx'

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme()

  if (!mounted) {
    return (
      <button
        type="button"
        className="relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
        aria-label="Toggle theme"
      >
        <span className="w-5 h-5 block" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--surface-elevated)] transition-all duration-200"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === 'dark' ? 0 : 180 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {theme === 'dark' ? (
          <Moon className="w-5 h-5" />
        ) : (
          <Sun className="w-5 h-5" />
        )}
      </motion.div>
      <span className="sr-only">
        {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      </span>
    </button>
  )
}