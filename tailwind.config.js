
import glob from 'glob';
import path from 'path';

export default {
  content: [
    './index.html',
    ...glob.sync(path.join(__dirname, 'src/**/*.{js,jsx,ts,tsx}'))
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
