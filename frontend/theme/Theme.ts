export const luxuryTheme = {
  colors: {
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
  fonts: {
    display: 'Cormorant Garamond',
    serif: 'Cormorant Garamond',
    sans: 'Inter',
  },
  typography: {
    h1: {
      fontFamily: 'Cormorant Garamond',
      fontSize: 64,
      lineHeight: 66,
      letterSpacing: 0.08,
      fontWeight: '700',
    },
    h2: {
      fontFamily: 'Cormorant Garamond',
      fontSize: 40,
      lineHeight: 44,
      letterSpacing: 0.06,
      fontWeight: '600',
    },
    h3: {
      fontFamily: 'Cormorant Garamond',
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: 0.04,
      fontWeight: '600',
    },
    body: {
      fontFamily: 'Inter',
      fontSize: 16,
      lineHeight: 26,
      letterSpacing: 0.01,
      fontWeight: '400',
    },
    caption: {
      fontFamily: 'Inter',
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.1,
      fontWeight: '500',
      textTransform: 'uppercase',
    },
  },
  gradients: {
    editorialDark: ['#0F0F0F', '#2A2A2A'],
    warmLuxury: ['#F5F1E8', '#EAE3D2'],
    mutedGold: ['#C6A962', '#E5D08A'],
    deepAccent: ['#1C2A3A', '#0F0F0F'],
  },
} as const;

export type LuxuryTheme = typeof luxuryTheme;