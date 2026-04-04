/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // CosmosCraft Color Palette
        gold: '#d4af37',
        'dark': '#111827',
        'light': '#f3f4f6',
        // Gradients and variations
        'gold-light': '#e8c547',
        'gold-dark': '#b8941d',
        'dark-light': '#1f2937',
        'light-dark': '#d1d5db',
        // Theme-aware colors using CSS variables
        'theme-bg': 'var(--bg-primary)',
        'theme-surface': 'var(--surface-dark)',
        'theme-surface-deep': 'var(--surface-deep)',
        'theme-elevated': 'var(--surface-elevated)',
        'theme-text': 'var(--text-light)',
        'theme-text-muted': 'var(--text-muted)',
        'theme-border': 'var(--border)',
        'theme-border-strong': 'var(--border-strong)',
        'theme-overlay': 'var(--overlay-dark)',
      },
      backgroundColor: {
        'primary': '#d4af37',
        'secondary': '#111827',
        'accent': '#f3f4f6',
        'theme-bg': 'var(--bg-primary)',
        'theme-surface': 'var(--surface-dark)',
        'theme-surface-deep': 'var(--surface-deep)',
        'theme-elevated': 'var(--surface-elevated)',
      },
      textColor: {
        'primary': '#d4af37',
        'secondary': '#111827',
        'accent': '#f3f4f6',
        'theme': 'var(--text-light)',
        'theme-muted': 'var(--text-muted)',
      },
      borderColor: {
        'primary': '#d4af37',
        'secondary': '#111827',
        'accent': '#f3f4f6',
        'theme': 'var(--border)',
        'theme-strong': 'var(--border-strong)',
      },
      boxShadow: {
        'theme': '0 4px 6px -1px var(--shadow-color), 0 2px 4px -1px var(--shadow-color)',
        'theme-lg': '0 10px 15px -3px var(--shadow-color), 0 4px 6px -2px var(--shadow-color)',
        'theme-xl': '0 20px 25px -5px var(--shadow-strong), 0 10px 10px -5px var(--shadow-color)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      spacing: {
        'safe': 'max(1rem, env(safe-area-inset-left))',
      },
    },
  },
  plugins: [],
}
