/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          900: '#0A0E1A',
          800: '#0B1120',
          700: '#131829',
        }
      },
    },
  },
  plugins: [],
}
