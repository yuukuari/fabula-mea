/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#fefdfb',
          100: '#faf6f0',
          200: '#f5ede1',
          300: '#ecdcc7',
          400: '#dfc6a5',
          500: '#d1ad83',
        },
        ink: {
          50: '#f5f0ec',
          100: '#e0d5cc',
          200: '#c4a98f',
          300: '#8b7355',
          400: '#5c4a33',
          500: '#2d2118',
          600: '#1a1208',
        },
        bordeaux: {
          50: '#fdf2f4',
          100: '#fbe5ea',
          200: '#f5c0cc',
          300: '#ec8fa4',
          400: '#d45474',
          500: '#8b2252',
          600: '#6b1a3f',
        },
        gold: {
          50: '#fdf9ef',
          100: '#faf0d5',
          200: '#f0dba5',
          300: '#dfc270',
          400: '#c4a35a',
          500: '#a88a3a',
          600: '#7a6428',
        },
      },
      fontFamily: {
        serif: ['Crimson Text', 'Georgia', 'serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
