// import { StyleSheet, } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
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
import SplashScreen from '../screens/SplashScreen';
import TakePhoto from '../screens/TakePhoto';
import WeatherSuggestion from '../screens/WeatherSugggestion';
import useAuthStore from '../store/auth';
import TabNavigator from './TabNavigator';
import DesignScreen from '../screens/DesignScreen';

type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Tabs: undefined;
  AddOutfit: undefined;
  Design: undefined;
  OutfitPage: undefined;
  PublicPage: undefined;
  PublicProfilePage: undefined;
  AIChat: undefined;
  AIOutfitMaker: undefined;
  AIVirtualTryOn: undefined;
  WeatherSuggestion: undefined;
  NotificationPreferences: undefined;
  EditProfile: undefined;
  TakePhoto: undefined;
  SavedOutfitScreen: undefined;
  SignIn: undefined;
  SignUp: undefined;
  SettingPage: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();


const RootNavigator = () => {
  const {isAuthenticated, initalizeAuth} = useAuthStore();
  useEffect(()=> {initalizeAuth()}, [initalizeAuth])
return (
  <Stack.Navigator
    initialRouteName={'Splash'}
    screenOptions={{ headerShown: false, animation: 'fade' }}
  >
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    {isAuthenticated ? (
      <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
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

      </Stack.Group>
    ) : (
      <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
        <Stack.Screen name="SignIn" component={SignIn} />
        <Stack.Screen name="SignUp" component={SignUp} />
      </Stack.Group>
    )}
  </Stack.Navigator>
)
}

export default RootNavigator

// const styles = StyleSheet.create({})