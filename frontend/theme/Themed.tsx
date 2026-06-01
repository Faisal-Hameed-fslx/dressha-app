import React from 'react';
import { PressableProps, PressableStateCallbackType, Pressable as RNPressable, SafeAreaView as RNSafeAreaView, Text as RNText, View as RNView, StyleProp, TextProps, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

// Themed wrappers
// ---------------
// Small helper components that consume `useTheme()` and apply the current
// theme's colors to common primitives. Use these for top-level containers
// so background and text colors follow the selected theme without changing
// each screen's internal layout classes.
//
// Examples:
//  - <ThemedSafeAreaView> for top-level screens
//  - <ThemedText variant="muted"> for secondary text

export const ThemedSafeAreaView: React.FC<React.PropsWithChildren<ViewProps>> = ({ children, style, ...rest }) => {
  const { theme } = useTheme();
  return (
    <RNSafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }, style]} {...rest}>
      {children}
    </RNSafeAreaView>
  );
};

export const ThemedView: React.FC<React.PropsWithChildren<ViewProps>> = ({ children, style, ...rest }) => {
  const { theme } = useTheme();
  return (
    <RNView style={[{ backgroundColor: theme.colors.background }, style]} {...rest}>
      {children}
    </RNView>
  );
};

export const ThemedText: React.FC<TextProps & { variant?: 'primary' | 'muted' | 'accent' }> = ({ children, style, variant = 'primary', ...rest }) => {
  const { theme } = useTheme();
  const color = variant === 'primary' ? theme.colors.primary : variant === 'accent' ? theme.colors.accent : theme.colors.muted;
  return (
    <RNText style={[{ color }, style]} {...rest}>
      {children}
    </RNText>
  );
};

export const ThemedPressable: React.FC<React.PropsWithChildren<PressableProps>> = ({ children, style, ...rest }) => {
  return (
    <RNPressable
      style={({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [{ opacity: pressed ? 0.85 : 1 }, typeof style === 'function' ? style({ pressed }) : style]}
      {...rest}
    >
      {children}
    </RNPressable>
  );
};

export default ThemedView;
