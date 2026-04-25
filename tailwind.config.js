/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
        fontFamily: {
            sans: ['Inter', 'sans-serif'],
        },
        boxShadow: {
            'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
        }
    },
  },
  plugins: [],
}
