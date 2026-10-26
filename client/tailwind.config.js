/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Cinza chumbo: as camadas de fundo do "Dark Mode".
        ink: {
          950: '#08080b',
          900: '#0d0e13',
          850: '#12141b',
          800: '#171922',
          750: '#1d202a',
          700: '#242833',
          600: '#323744',
          500: '#454b5c',
        },
        // Roxo arcano: a cor de sotaque principal.
        arcane: {
          50: '#f4f0ff',
          200: '#d8c9ff',
          300: '#c1a8ff',
          400: '#a487ff',
          500: '#8b5cf6',
          600: '#7239e8',
          700: '#5b28bf',
        },
        // Ciano neon: detalhes, crítico e estados "ligados".
        neon: {
          300: '#7ff0ff',
          400: '#38e0f5',
          500: '#12c4de',
        },
        ember: '#f97362',
        gold: '#e0b95c',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(139,92,246,.35), 0 8px 30px -12px rgba(139,92,246,.55)',
        panel: '0 12px 40px -24px rgba(0,0,0,.9)',
      },
      backgroundImage: {
        'arcane-radial':
          'radial-gradient(70% 60% at 50% 0%, rgba(139,92,246,.16) 0%, rgba(13,14,19,0) 70%)',
        'panel-sheen': 'linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0) 60%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(139,92,246,.45)' },
          '50%': { boxShadow: '0 0 0 6px rgba(139,92,246,0)' },
        },
        'roll-in': {
          '0%': { opacity: '0', transform: 'translateX(14px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .22s ease-out both',
        'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite',
        'roll-in': 'roll-in .2s ease-out both',
      },
    },
  },
  plugins: [],
};
