/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Primary Palette ──────────────────────────
        navy: {
          50:  '#EEF2F8',
          100: '#D5E0EE',
          200: '#ADC1DE',
          300: '#7A9AC5',
          400: '#4B74AC',
          500: '#1E3A5F',
          600: '#172D4A',
          700: '#112135',
          800: '#0C1624',
          900: '#070D14',
          950: '#040810',
        },
        // ── Accent Gold ──────────────────────────────
        gold: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        // ── Semantic Colors ──────────────────────────
        success: {
          light: '#D1FAE5',
          DEFAULT: '#10B981',
          dark: '#065F46',
        },
        warning: {
          light: '#FEF3C7',
          DEFAULT: '#F59E0B',
          dark: '#B45309',
        },
        danger: {
          light: '#FEE2E2',
          DEFAULT: '#EF4444',
          dark: '#991B1B',
        },
        info: {
          light: '#DBEAFE',
          DEFAULT: '#3B82F6',
          dark: '#1E40AF',
        },
        // ── Surface / Background ─────────────────────
        surface: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          dark: {
            base:    '#0A0F1E',
            card:    '#0F1629',
            elevated:'#151E38',
            border:  '#1E2D50',
          }
        },
      },
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-gold':  '0 0 20px 4px rgba(245,158,11,0.25)',
        'glow-navy':  '0 0 20px 4px rgba(30,58,95,0.40)',
        'glow-blue':  '0 0 20px 4px rgba(59,130,246,0.30)',
        'premium':    '0 8px 32px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.16)',
        'card':       '0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.20), 0 4px 12px rgba(0,0,0,0.12)',
        'inset-gold': 'inset 0 1px 0 rgba(245,158,11,0.3)',
        'glass':      '0 8px 32px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'gradient-premium':        'linear-gradient(135deg, #1E3A5F 0%, #0A0F1E 50%, #1a1040 100%)',
        'gradient-gold':           'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        'gradient-glass':          'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
        'gradient-card-dark':      'linear-gradient(145deg, rgba(21,30,56,0.95) 0%, rgba(15,22,41,0.95) 100%)',
        'gradient-sidebar':        'linear-gradient(180deg, #0F1629 0%, #0A0F1E 100%)',
        'shimmer':                 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)',
      },
      animation: {
        'fade-in':        'fadeIn 0.4s ease-out both',
        'fade-up':        'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-down':      'fadeDown 0.4s ease-out both',
        'slide-in-left':  'slideInLeft 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in':       'scaleIn 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'shimmer':        'shimmer 2s linear infinite',
        'pulse-gold':     'pulseGold 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':          'float 3s ease-in-out infinite',
        'glow':           'glow 2s ease-in-out infinite',
        'spin-slow':      'spin 3s linear infinite',
        'bounce-subtle':  'bounceSubtle 1s ease-in-out infinite',
        'count-up':       'countUp 0.8s cubic-bezier(0.22,1,0.36,1) both',
        'progress':       'progress 1s cubic-bezier(0.22,1,0.36,1) both',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeDown: {
          '0%':   { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-468px 0' },
          '100%': { backgroundPosition: '468px 0' },
        },
        pulseGold: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(245,158,11,0.4)' },
          '50%':     { boxShadow: '0 0 0 8px rgba(245,158,11,0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-8px)' },
        },
        glow: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.7' },
        },
        bounceSubtle: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-4px)' },
        },
        countUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        progress: {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--progress-width, 100%)' },
        },
      },
      transitionTimingFunction: {
        'spring':       'cubic-bezier(0.22, 1, 0.36, 1)',
        'smooth':       'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-in':    'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'expo-out':     'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
}
