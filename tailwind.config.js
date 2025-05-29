
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs',
    'font-bold', 'font-semibold', 'font-medium',
    'bg-white', 'bg-black', 'bg-gray-100', 'bg-gray-800',
    'text-white', 'text-black', 'text-gray-600', 'text-gray-800',
    'hover:bg-gray-700', 'hover:text-white',
    'rounded', 'rounded-lg', 'border', 'shadow',
    'p-2', 'p-4', 'px-4', 'py-2', 'm-2', 'mb-4',
    'flex', 'grid', 'items-center', 'justify-between',
    'w-full', 'max-w-xl', 'mx-auto', 'underline', 'space-y-3'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
