/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,ts,tsx}', 
    './components/**/*.{js,ts,tsx}',
    './screens/**/*.{js,ts,tsx}',
    './navigation/**/*.{js,ts,tsx}',
    './hooks/**/*.{js,ts,tsx}',
    './services/**/*.{js,ts,tsx}',
    './theme/**/*.{js,ts,tsx}'
  ],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        luxury: {
          black: '#0F0F0F',
          charcoal: '#1A1A1A',
          ivory: '#F5F1E8',
          champagne: '#EAE3D2',
          gold: '#C6A962',
          roseGold: '#B76E79',
          platinum: '#D9D9D9',
          coolGrey: '#8A8A8A',
          warmTaupe: '#A89F91',
          lightGrey: '#E5E5E5',
          navy: '#1C2A3A',
          emerald: '#0F3D2E',
          burgundy: '#4A1E2A',
          goldSoft: '#E5D08A',
        },
        scandi: {
          'bg': '#F4F4F4',
          'primary': '#1E1E1E',
          'accent': '#FF8A65',
          'muted': '#9E9E9E',
          'card': '#FFFFFF',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'System', 'sans-serif'],
      },
      letterSpacing: {
        luxury: '0.08em',
        luxe: '0.12em',
      },
    },
  },
  plugins: [],
};
