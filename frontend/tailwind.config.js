/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#1a1a0e',
          surface: '#1e1e12',
          border: '#5a5a2e',
          amber: '#d4a017',
          'amber-bright': '#ffb800',
          'amber-dim': '#8a6a10',
          'amber-faint': 'rgba(212, 160, 23, 0.15)',
          dark: '#0f0f08',
        },
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
