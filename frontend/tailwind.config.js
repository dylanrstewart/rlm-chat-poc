/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cyber: {
          deep: '#0a0a0f',
          surface: '#0d0d1a',
          panel: 'rgba(13, 13, 26, 0.85)',
          cyan: '#00f0ff',
          pink: '#ff2d6b',
          purple: '#b829e3',
          green: '#39ff14',
          amber: '#ffb800',
          muted: '#6b7294',
          text: '#e0e0ff',
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
