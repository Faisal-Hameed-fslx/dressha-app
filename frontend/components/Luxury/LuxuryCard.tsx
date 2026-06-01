import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// LuxuryCard
// -----------
// A simple container used widely across the app. It now reads
// `theme.colors.card` and `theme.colors.muted` for background and border
// so cards respect the selected light/dark mode without changing layout.

interface LuxuryCardProps {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

const LuxuryCard = ({ children, className = '', style }: LuxuryCardProps) => {
  const { theme } = useTheme();
  return (
    <View
      className={`rounded-2xl ${className}`}
      style={[{ backgroundColor: theme.colors.card, borderColor: theme.colors.muted, borderWidth: 1 }, style]}
    >
      {children}
    </View>
  );
};

export default LuxuryCard;
