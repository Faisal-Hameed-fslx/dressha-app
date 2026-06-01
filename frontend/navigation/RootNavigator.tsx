import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AddOutfitPage from '../screens/AddOutfitPage';
import AIOutfitMaker from '../screens/AIOutfitMaker';
import AiStylus from '../screens/AiStylus';
import ColorAnalyzer from '../screens/ColorAnalyzer';
import EditProfile from '../screens/EditProfile';
import NotificationPreferences from '../screens/NotificationPreferences';
import OnboardingScreen from '../screens/OnboardingScreen';
import OutfitDetailScreen from '../screens/OutfitDetailScreen';
import OutfitPage from '../screens/OutfitPage';
import PublicUserProfileScreen from '../screens/PublicUserProfileScreen';
import SavedOutfitScreen from '../screens/SavedOutfitScreen';
import SettingPage from '../screens/SettingPage';
import SignIn from '../screens/SignIn';
import SignUp from '../screens/SignUp';
import TakePhoto from '../screens/TakePhoto';
import WeatherSuggestion from '../screens/WeatherSugggestion';
import useAuthStore from '../store/auth';
import TabNavigator from './TabNavigator';
import DesignScreen from '../screens/DesignScreen';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const { isAuthenticated, initalizeAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize auth
        await initalizeAuth();
        
        // Check if user has seen onboarding
        const seen = await AsyncStorage.getItem('hasSeenOnboarding');
        setShowOnboarding(!seen);
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [initalizeAuth]);

  // Don't render anything until we're ready (Expo native splash will show)
  if (isLoading) {
    return null;
  }

  // Show onboarding if not seen yet
  if (showOnboarding) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignIn" component={SignIn} />
        <Stack.Screen name="SignUp" component={SignUp} />
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="AddOutfit" component={AddOutfitPage} />
        <Stack.Screen name="Design" component={DesignScreen} />
        <Stack.Screen name="OutfitPage" component={OutfitPage} />
        <Stack.Screen name="PublicPage" component={OutfitDetailScreen} />
        <Stack.Screen name="PublicProfilePage" component={PublicUserProfileScreen} />
        <Stack.Screen name="AIChat" component={AiStylus} />
        <Stack.Screen name="AIOutfitMaker" component={AIOutfitMaker} />
        <Stack.Screen name="colorAnalyzer" component={ColorAnalyzer} />
        <Stack.Screen name="WeatherSuggestion" component={WeatherSuggestion} />
        <Stack.Screen name="NotificationPreferences" component={NotificationPreferences} />
        <Stack.Screen name="EditProfile" component={EditProfile} />
        <Stack.Screen name="TakePhoto" component={TakePhoto} />
        <Stack.Screen name="SavedOutfitScreen" component={SavedOutfitScreen} />
        <Stack.Screen name="SettingPage" component={SettingPage} />
      </Stack.Navigator>
    );
  }

  // Show auth or main app based on authentication
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="AddOutfit" component={AddOutfitPage} />
          <Stack.Screen name="Design" component={DesignScreen} />
          <Stack.Screen name="OutfitPage" component={OutfitPage} />
          <Stack.Screen name="PublicPage" component={OutfitDetailScreen} />
          <Stack.Screen name="PublicProfilePage" component={PublicUserProfileScreen} />
          <Stack.Screen name="AIChat" component={AiStylus} />
          <Stack.Screen name="AIOutfitMaker" component={AIOutfitMaker} />
          <Stack.Screen name="colorAnalyzer" component={ColorAnalyzer} />
          <Stack.Screen name="WeatherSuggestion" component={WeatherSuggestion} />
          <Stack.Screen name="NotificationPreferences" component={NotificationPreferences} />
          <Stack.Screen name="EditProfile" component={EditProfile} />
          <Stack.Screen name="TakePhoto" component={TakePhoto} />
          <Stack.Screen name="SavedOutfitScreen" component={SavedOutfitScreen} />
          <Stack.Screen name="SettingPage" component={SettingPage} />
        </>
      ) : (
        <>
          <Stack.Screen name="SignIn" component={SignIn} />
          <Stack.Screen name="SignUp" component={SignUp} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;