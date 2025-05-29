
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'text-2xl', 'text-xl', 'text-sm', 'font-bold', 'font-semibold',
    'bg-gray-800', 'text-white', 'text-zinc-100', 'text-zinc-300',
    'bg-red-600', 'bg-green-600', 'bg-blue-600',
    'hover:bg-red-700', 'hover:bg-green-700', 'hover:bg-blue-700',
    'rounded', 'rounded-lg', 'border', 'shadow', 'p-4', 'mb-4', 'max-w-xl',
    'mx-auto', 'underline', 'flex', 'justify-between', 'items-center'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
