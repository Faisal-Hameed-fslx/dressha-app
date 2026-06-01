import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Animated, Dimensions, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStore from '../store/auth';
import { useTheme } from '../theme/ThemeProvider';



const { width } = Dimensions.get('window');

const slides = [
  {
    key: 'one',
    title: 'Discover styles made for you',
    text: 'AI-powered outfit suggestions, color analysis and more.',
    image: require('../assets/new-adaptive-icon.png'),
  },
  {
    key: 'two',
    title: 'Organize your wardrobe',
    text: 'Save outfits, mix & match and find new looks quickly.',
    image: require('../assets/splash.png'),
  },
  {
    key: 'three',
    title: 'Personalized Recommendations',
    text: 'Weather-aware and occasion-aware suggestions tailored to you.',
    image: require('../assets/icon.png'),
  },
];

const OnboardingScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuthStore();
  const [index, setIndex] = useState(0);
  const anim = React.useRef(new Animated.Value(0)).current;

  const goNext = () => {
    const next = Math.min(index + 1, slides.length - 1);
    setIndex(next);
    Animated.timing(anim, { toValue: next * width * -1, duration: 350, useNativeDriver: true }).start();
  };

  const finish = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', '1');
    if (isAuthenticated) navigation.replace('Tabs');
    else navigation.replace('SignIn');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.colors.background} />
      <View style={styles.sliderWrap}>
        <Animated.View style={[styles.slideRow, { transform: [{ translateX: anim }] }]}>
          {slides.map((s) => (
            <View key={s.key} style={[styles.slide, { width }]}> 
                <Image source={s.image} style={[styles.image, { borderRadius: 16 }]} />
              <Text style={[styles.title, { color: theme.colors.primary }]}>{s.title}</Text>
              <Text style={[styles.text, { color: theme.colors.accent }]}>{s.text}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: theme.colors.accent },
                i === index ? { opacity: 1, transform: [{ scale: 1.15 }] } : { opacity: 0.35 },
              ]}
            />
          ))}
        </View>
        <View style={styles.buttonsRow}>
          {index < slides.length - 1 ? (
            <TouchableOpacity style={[styles.nextButton, { backgroundColor: theme.colors.accent }]} onPress={goNext}>
              <Text style={styles.nextText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.getStarted, { backgroundColor: theme.colors.primary }]} onPress={finish}>
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  sliderWrap: { flex: 1, overflow: 'hidden' },
  slideRow: { flexDirection: 'row' },
  slide: { alignItems: 'center', paddingHorizontal: 28, justifyContent: 'center' },
  image: { width: 180, height: 180, resizeMode: 'contain', marginBottom: 22 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  text: { fontSize: 14, textAlign: 'center', paddingHorizontal: 6 },
  footer: { padding: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 6, backgroundColor: '#000' },
  buttonsRow: { alignItems: 'center' },
  nextButton: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 },
  nextText: { color: '#fff', fontWeight: '700' },
  getStarted: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 },
  getStartedText: { color: '#fff', fontWeight: '700' },
});

export default OnboardingScreen;
