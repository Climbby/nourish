/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0f1410',
        paper: '#f4f6f1',
        leaf: '#2f5d3a',
        moss: '#5a8f68',
        chalk: '#e8eee4',
        mute: '#5c6b5f',
      },
    },
  },
  plugins: [],
}
