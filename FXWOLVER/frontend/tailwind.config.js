/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'tx-bg':     '#0d1117',
        'tx-panel':  '#161b22',
        'tx-border': '#21262d',
        'tx-text':   '#e6edf3',
        'tx-muted':  '#8b949e',
        'tx-green':  '#26a69a',
        'tx-red':    '#ef5350',
        'tx-blue':   '#388bfd',
        'tx-yellow': '#f0c040',
        'tx-accent': '#1f6feb',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
