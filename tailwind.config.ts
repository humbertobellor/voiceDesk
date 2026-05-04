import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0F172A',
        surface: '#1E293B',
        accent: '#F97316',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'border-default': '#334155',
        destructive: '#EF4444',
        success: '#22C55E',
      },
      fontFamily: { sans: ['var(--font-inter)', 'sans-serif'] },
    },
  },
  plugins: [],
}
export default config
