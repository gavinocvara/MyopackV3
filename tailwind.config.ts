import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        helsinki: {
          DEFAULT: '#2F4A73',
          light: '#4A6B9E',
          dark: '#1E3050',
        },
        oura: {
          black: '#151619',
          white: '#FFFFFF',
          skin: '#E6DED3',
          'skin-light': '#F6F3EF',
        },
        coral: {
          DEFAULT: '#FC6558',
          light: '#FD8A7F',
        },
        enso: {
          DEFAULT: '#A2D3E8',
          light: '#C1E4F3',
        },
        balance: {
          optimal: '#10B981',
          caution: '#F59E0B',
          alert: '#EF4444',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Menlo', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config
