/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        nourish: {
          bg: '#111416',
          surface: '#1d2023',
          'surface-low': '#191c1f',
          'surface-high': '#272a2d',
          'surface-highest': '#323538',
          text: '#e1e2e6',
          'text-dim': '#c3c8bd',
          border: '#434840',
          primary: '#c3e2ba',
          'primary-dim': '#a8c69f',
          'on-primary': '#1d361a',
        },
      },
    },
  },
  plugins: [],
}
