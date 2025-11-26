/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        kmGray: '#E5E5E5',
        kmDark: '#333333',
        kmGreen: '#21A35B',
        kmRed: '#E5383B'
      }
    }
  },
  plugins: []
};
