import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// LuxuryInput
// -----------
// Theme-aware input field. Uses `theme.colors` for label, placeholder,
// background and border so form controls match the active theme.

interface LuxuryInputProps extends TextInputProps {
  label?: string;
  containerClassName?: string;
}

const LuxuryInput = ({
  label,
  containerClassName = '',
  placeholderTextColor,
  ...textInputProps
}: LuxuryInputProps) => {
  const { theme } = useTheme();
  const placeholder = placeholderTextColor || theme.colors.muted;

  return (
    <View className={containerClassName}>
      {label ? (
        <Text style={{ marginBottom: 6, fontSize: 12, fontWeight: '600', color: theme.colors.muted }}>{label}</Text>
      ) : null}
      <TextInput
        {...textInputProps}
        placeholderTextColor={placeholder}
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.muted,
          backgroundColor: theme.colors.card === '#FFFFFF' ? '#FFFFFF' : theme.colors.card,
          padding: 12,
          color: theme.colors.primary,
        }}
      />
    </View>
  );
};

export default LuxuryInput;
