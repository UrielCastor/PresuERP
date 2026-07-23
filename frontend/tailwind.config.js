/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          950: 'var(--color-primary-950)',
        },
        slate: {
          50: 'var(--background)',
          100: 'var(--surface-secondary)',
          200: 'var(--border)',
          300: 'var(--border)',
          400: 'var(--text-muted)',
          500: 'var(--text-secondary)',
          600: 'var(--text-secondary)',
          700: 'var(--text-primary)',
          800: 'var(--border)',
          900: 'var(--surface)',
          950: 'var(--background)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
