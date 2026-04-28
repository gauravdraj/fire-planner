/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Indigo is the only accent; all other UI color should stay neutral or status-specific.
  theme: {
    extend: {},
  },
  plugins: [],
};
