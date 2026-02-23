/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9ecff',
          200: '#bcdeff',
          300: '#8ecaff',
          400: '#59abff',
          500: '#3388ff',
          600: '#1b68f5',
          700: '#1452e1',
          800: '#1742b6',
          900: '#193b8f',
          950: '#142557',
        },
      },
    },
  },
  plugins: [],
};
