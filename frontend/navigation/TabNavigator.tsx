import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useMemo } from 'react'; // Added useMemo to cache styles safely
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import HomePage from '../screens/HomePage';
import MyFeedScreen from '../screens/MyFeedScreen';
import ProfilePage from '../screens/ProfilePage';
import PublicFeedScreen from '../screens/PublicFeedScreen';
import TakePhoto from '../screens/TakePhoto';
import { useTheme } from '../theme/ThemeProvider';

const Tab = createBottomTabNavigator();

// HELPER FUNCTION: Placed safely outside component scope
function hexToRgba(hex: string, alpha = 1) {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  if (isNaN(bigint)) return `rgba(0, 0, 0, ${alpha})`;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const TabIcon = ({
  icon,
  focused,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) => {
  const { theme } = useTheme();

  // Safely memoize styles so they don't force unauthorized re-renders during mount
  const dynamicPillStyle = useMemo(() => ({
    backgroundColor: focused ? hexToRgba(theme.colors.accent, 0.12) : 'transparent',
    borderColor: focused ? hexToRgba(theme.colors.accent, 0.22) : 'transparent',
    borderWidth: focused ? 1 : 0,
  }), [focused, theme.colors.accent]);

  return (
    <View style={styles.center}>
      <View style={[styles.pill, dynamicPillStyle]}>
        <Ionicons name={icon} size={24} color={focused ? theme.colors.accent : theme.colors.muted} />
      </View>
    </View>
  );
};

const TabNavigator = () => {
  const { theme } = useTheme();

  // Safely memoize tab configuration to prevent rendering-stage side-effects
  const screenOptions = useMemo(() => ({
    headerShown: false,
    // tabBarShowLabel: false,
    tabBarActiveTintColor: theme.colors.accent,
    tabBarInactiveTintColor: theme.colors.muted,
    tabBarStyle: {
      position: 'absolute' as const,
      bottom: 12,
      backgroundColor: theme.colors.card,
      height: 82,
      borderTopWidth: 0,
      elevation: 16,
      shadowColor: '#000000',
      shadowOpacity: 0.22,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 20,
      borderWidth: 1,
      borderColor: hexToRgba(theme.colors.primary, 0.08),
      borderRadius: 24,
      paddingTop: 17,
      marginHorizontal: 12,
      paddingHorizontal: 6,
    },
    tabBarItemStyle: {
      height: 56,
      justifyContent: 'center',
      flex: 1,
    },
  }), [theme]);

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Home"
        component={HomePage}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="home-outline" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="PublicFeed"
        component={PublicFeedScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="earth-outline" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Add"
        component={TakePhoto}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <View
              className="mb-1 items-center justify-center"
              style={{
                width: 60,
                height: 60,
                borderRadius: 50,
                backgroundColor: focused ? theme.colors.accent : theme.colors.card,
                borderColor: focused ? theme.colors.accent : hexToRgba(theme.colors.primary, 0.12),
                borderWidth: 1,
                shadowColor: focused ? theme.colors.accent : theme.colors.primary,
                shadowOpacity: focused ? 0.32 : 0.14,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 3,
              }}
            >
              <Ionicons name="add" size={36} color={focused ? theme.colors.background : theme.colors.accent} />
            </View>
          ),
          tabBarButton: (props: BottomTabBarButtonProps) => (
            <TouchableOpacity
              {...props}
              className="items-center justify-center"
              style={{ flex: 1 }}
            />
          ),
        }}
      />

      <Tab.Screen
        name="MyFeed"
        component={MyFeedScreen}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="layers-outline" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfilePage}
        options={{
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon icon="person-outline" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
});

export default TabNavigator;
