
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './src/**/*.jsx' // Ensures JSX files are matched even under ESM or tree-shaken builds
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
