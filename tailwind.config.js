/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0b',
        ink: '#f2f2f2',
        mute: 'rgba(242,242,242,0.55)',
        line: 'rgba(255,255,255,0.12)',
        glass: 'rgba(22,22,24,0.6)',
        err: '#ff9b92',
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'Inter', '-apple-system', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        serif: ['"Instrument Serif"', '"Times New Roman"', 'serif'],
      },
      transitionTimingFunction: { house: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
}
