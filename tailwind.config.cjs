/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0f5ff',
          100: '#e0e9ff',
          200: '#c8d7ff',
          300: '#a6beff',
          400: '#819dff',
          500: '#5f7cff',
          600: '#435de9',
          700: '#364cc3',
          800: '#2d3f9f',
          900: '#29387e',
          950: '#1a224c'
        },
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a'
        }
      }
    }
  },
  plugins: [],
};
