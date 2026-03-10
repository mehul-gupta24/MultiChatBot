/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable darker mode manually if needed, but 'media' or assumption of class on html/body is standard
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: '#f4f0ff',
          100: '#e9e1ff',
          200: '#d5c4ff',
          300: '#b797ff',
          400: '#9660ff',
          500: '#7928ff',
          600: '#6900ff',
          700: '#5600d6',
          800: '#4600b3',
          900: '#3a0094',
          950: '#230062',
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        aurora: {
          green: '#00D2FF',
          blue: '#3A7BD5',
          purple: '#8A2387',
          pink: '#E94057',
        },
        // Premium true-black mapping
        dark: {
          100: '#d1d5db',
          200: '#9ca3af',
          300: '#6b7280',
          400: '#4b5563',
          500: '#374151',
          600: '#1f2937',
          700: '#111827',
          800: '#0f172a',
          900: '#0a0f1c',
          950: '#090A0F', // Core deep space black
          980: '#05060A',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'aurora-1': 'aurora-1 15s ease infinite alternate',
        'aurora-2': 'aurora-2 20s ease infinite alternate',
        'aurora-3': 'aurora-3 18s ease infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'aurora-1': {
          '0%': { transform: 'translate(0%, 0%) scale(1)' },
          '100%': { transform: 'translate(10%, 10%) scale(1.1)' },
        },
        'aurora-2': {
          '0%': { transform: 'translate(0%, 0%) scale(1.1)' },
          '100%': { transform: 'translate(-10%, 5%) scale(1)' },
        },
        'aurora-3': {
          '0%': { transform: 'translate(0%, 0%) scale(1)' },
          '100%': { transform: 'translate(5%, -10%) scale(1.15)' },
        }
      }
    },
  },
  plugins: [],
}