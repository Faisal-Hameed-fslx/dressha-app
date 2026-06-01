import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

type LuxuryBannerTone = 'info' | 'success' | 'error';

interface LuxuryBannerProps {
  tone?: LuxuryBannerTone;
  text: string;
  className?: string;
}

const toneIconMap: Record<LuxuryBannerTone, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  error: 'alert-circle-outline',
};

function hexToRgba(hex: string, alpha = 1) {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const LuxuryBanner = ({ tone = 'info', text, className = '' }: LuxuryBannerProps) => {
  const { theme } = useTheme();

  const toneStyles = {
    info: {
      backgroundColor: hexToRgba(theme.colors.card, 0.92),
      borderColor: hexToRgba(theme.colors.muted, 0.18),
      iconColor: theme.colors.accent,
      textColor: theme.colors.primary,
    },
    success: {
      backgroundColor: 'rgba(52, 211, 153, 0.12)',
      borderColor: 'rgba(52, 211, 153, 0.22)',
      iconColor: '#34d399',
      textColor: theme.colors.primary,
    },
    error: {
      backgroundColor: 'rgba(251, 113, 133, 0.12)',
      borderColor: 'rgba(251, 113, 133, 0.22)',
      iconColor: '#fb7185',
      textColor: theme.colors.primary,
    },
  }[tone];

  return (
    <View
      className={`flex-row items-center rounded-2xl border px-4 py-3 ${className}`}
      style={{ backgroundColor: toneStyles.backgroundColor, borderColor: toneStyles.borderColor }}
    >
      <Ionicons name={toneIconMap[tone]} size={18} color={toneStyles.iconColor} />
      <Text className="ml-3 flex-1 font-sans text-sm font-medium leading-5" style={{ color: toneStyles.textColor }}>
        {text}
      </Text>
    </View>
  );
};

export default LuxuryBanner;
