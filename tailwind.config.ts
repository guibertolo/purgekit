import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00D4FF',
          hover: '#00BBEE',
          active: '#0099CC',
          muted: 'rgba(0, 212, 255, 0.1)',
        },
        secondary: {
          DEFAULT: '#7C8DB0',
          hover: '#8E9DC0',
          active: '#6A7DA0',
          muted: 'rgba(124, 141, 176, 0.1)',
        },
        accent: {
          DEFAULT: '#00FFE5',
          glow: 'rgba(0, 255, 229, 0.2)',
        },
        surface: {
          DEFAULT: '#22222E',
          hover: '#2A2A38',
        },
        border: {
          DEFAULT: '#2A2A38',
          active: 'rgba(0, 212, 255, 0.2)',
          hover: '#3A3A48',
        },
        success: {
          DEFAULT: '#00E676',
          bg: 'rgba(0, 230, 118, 0.1)',
        },
        warning: {
          DEFAULT: '#FFB300',
          bg: 'rgba(255, 179, 0, 0.1)',
        },
        danger: {
          DEFAULT: '#FF3D5A',
          bg: 'rgba(255, 61, 90, 0.1)',
        },
        info: {
          DEFAULT: '#00D4FF',
          bg: 'rgba(0, 212, 255, 0.1)',
        },
        bg: {
          0: '#07070C',
          1: '#0A0A0F',
          2: '#12121A',
          3: '#1A1A25',
        },
        text: {
          primary: '#E8EAED',
          secondary: '#9AA0B0',
          muted: '#5A6070',
          inverse: '#0A0A0F',
          link: '#00D4FF',
          code: '#00FFE5',
        },
      },
      fontFamily: {
        sans: ['Geist Sans', 'Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
