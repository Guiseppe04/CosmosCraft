/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CosmosCraft Color Palette
        gold: '#d4af37',
        'dark': '#231f20',
        'light': '#eff1f3',
        // Gradients and variations
        'gold-light': '#e8c547',
        'gold-dark': '#b8941d',
        'dark-light': '#3d3a3b',
        'light-dark': '#d4d7dc',
      },
      backgroundColor: {
        'primary': '#d4af37',
        'secondary': '#231f20',
        'accent': '#eff1f3',
      },
      textColor: {
        'primary': '#d4af37',
        'secondary': '#231f20',
        'accent': '#eff1f3',
      },
      borderColor: {
        'primary': '#d4af37',
        'secondary': '#231f20',
        'accent': '#eff1f3',
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
