import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// LuxuryButton
// -------------
// Theme-aware replacement for the previous Tailwind-only button styles.
// This component reads colors from `useTheme()` and applies them via
// inline `style` so theme changes propagate immediately. The `variant`
// prop still controls intent (gold, dark, burgundy, ghost) but the
// actual colors are taken from the active theme tokens.

type LuxuryButtonVariant = 'gold' | 'dark' | 'burgundy' | 'ghost';

interface LuxuryButtonProps {
  label: string;
  onPress: () => void;
  variant?: LuxuryButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

function hexToRgba(hex: string, alpha = 1) {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const LuxuryButton = ({
  label,
  onPress,
  variant = 'dark',
  disabled = false,
  loading = false,
  className = '',
}: LuxuryButtonProps) => {
  const { theme } = useTheme();

  const styles = React.useMemo(() => {
    switch (variant) {
      case 'gold':
        return {
          backgroundColor: theme.colors.accent,
          borderColor: hexToRgba(theme.colors.accent, 0.18),
          labelColor: theme.colors.primary,
        };
      case 'burgundy':
        return {
          backgroundColor: hexToRgba(theme.colors.accent, 0.9),
          borderColor: hexToRgba(theme.colors.accent, 0.12),
          labelColor: theme.colors.background,
        };
      case 'ghost':
        return {
          backgroundColor: hexToRgba(theme.colors.primary, 0.06),
          borderColor: hexToRgba(theme.colors.primary, 0.06),
          labelColor: theme.colors.primary,
        };
      case 'dark':
      default:
        return {
          backgroundColor: theme.colors.card,
          borderColor: hexToRgba(theme.colors.muted, 0.12),
          labelColor: theme.colors.primary,
        };
    }
  }, [variant, theme]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-2xl border px-4 py-3 items-center justify-center ${className}`}
      style={{
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'gold' ? theme.colors.primary : theme.colors.background} />
      ) : (
        <View className="flex-row items-center justify-center">
          <Text style={{ color: styles.labelColor, fontSize: 14, fontWeight: '700' }}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default LuxuryButton;
