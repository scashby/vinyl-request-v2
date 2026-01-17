// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  safelist: [
    "event-content-grid",
    "event-sidebar",
    "event-card",
    "event-info-card",
    "queue-section"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        serif: ['var(--font-playfair)'],
      },
    },
  },
  plugins: [],
}
