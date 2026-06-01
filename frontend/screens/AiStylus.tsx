import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LuxuryInput from '../components/Luxury/LuxuryInput';
import { useLanguage } from '../providers/LanguageProvider';
import useAuthStore from '../store/auth';
import baseUrl from '../store/run';
import { useTheme } from '../theme/ThemeProvider';

const CHAT_HISTORY_KEY = 'ai_chat_history';

const AiStylus = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: t('aiHello'),
      sender: 'ai',
    },
  ]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Load chat history from AsyncStorage on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const saved = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) {
          setMessages(JSON.parse(saved));
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      } finally {
        setIsHydrated(true);
      }
    };
    loadChatHistory();
  }, []);

  // Save chat history to AsyncStorage whenever messages change
  useEffect(() => {
    if (isHydrated) {
      AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages)).catch((err) =>
        console.warn('Failed to save chat history:', err)
      );
    }
  }, [messages, isHydrated]);

  // Scroll to bottom when messages change (avoid jumping when keyboard appears)
  useEffect(() => {
    if (scrollViewRef.current) {
      // Small delay to allow layout to settle
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Keyboard listeners – get exact height
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Helper: render inline markdown (bold/italic)
  const renderInline = (text: string, baseStyle: any, startKey = 'i') => {
    if (!text) return [];
    const nodes: React.ReactNode[] = [];
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let idx = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(
          <Text key={`${startKey}-t-${idx++}`} style={baseStyle}>
            {text.slice(lastIndex, match.index)}
          </Text>
        );
      }
      const bold = match[2];
      const italic = match[3];
      if (bold) {
        nodes.push(
          <Text key={`${startKey}-b-${idx++}`} style={[baseStyle, { fontWeight: '700' }]}>
            {bold}
          </Text>
        );
      } else if (italic) {
        nodes.push(
          <Text key={`${startKey}-i-${idx++}`} style={[baseStyle, { fontStyle: 'italic' }]}>
            {italic}
          </Text>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      nodes.push(
        <Text key={`${startKey}-t-${idx++}`} style={baseStyle}>
          {text.slice(lastIndex)}
        </Text>
      );
    }
    return nodes;
  };

  const renderMarkdown = (text: string, baseStyle: any) => {
    if (!text) return null;
    const lines = text.split(/\r?\n/);
    const out: React.ReactNode[] = [];
    lines.forEach((line, i) => {
      const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const content = headingMatch[2];
        const size = level === 1 ? 20 : level === 2 ? 18 : 16;
        out.push(
          <Text
            key={`h-${i}`}
            style={[baseStyle, { fontWeight: '700', fontSize: size, marginVertical: 4 }]}>
            {renderInline(
              content,
              { fontWeight: '700', fontSize: size, color: baseStyle.color },
              `h-${i}`
            )}
          </Text>
        );
      } else {
        out.push(
          <Text key={`p-${i}`} style={baseStyle}>
            {renderInline(line, baseStyle, `p-${i}`)}
          </Text>
        );
      }
      if (i < lines.length - 1) {
        out.push(
          <Text key={`br-${i}`} style={baseStyle}>
            {'\n'}
          </Text>
        );
      }
    });
    return out;
  };

  const suggestions = [t('suggestion1'), t('suggestion2'), t('suggestion3'), t('suggestion4'), t('suggestion5')];

  const token = useAuthStore((s: any) => s.token);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? query).trim();
    if (!text || isLoading) return;

    // Dismiss keyboard before sending to avoid layout confusion
    Keyboard.dismiss();

    const userMsg = {
      id: Date.now().toString(),
      text,
      sender: 'user' as const,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setIsLoading(true);
    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

      const res = await fetch(`${baseUrl}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to reach AI');
      }

      const aiText = (data?.reply || '').toString();
      const aiMsg = {
        id: `${Date.now().toString()}-ai`,
        text: aiText.length ? aiText : 'Sorry, I could not respond right now.',
        sender: 'ai' as const,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const aiMsg = {
        id: `${Date.now().toString()}-err`,
        text: err?.message || 'Something went wrong contacting AI.',
        sender: 'ai' as const,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    handleSend(suggestion);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <LinearGradient colors={[theme.colors.background, theme.colors.card, `${theme.colors.accent}10`]} style={StyleSheet.absoluteFill} />

      {/* Fixed Header */}
      <View className="flex-row items-center justify-between border-b p-4" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.muted }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: theme.colors.primary }}>{t('aiAssistantTitle')}</Text>
        <View className="w-6" />
      </View>

      {/* Main container with KeyboardAvoidingView to avoid layout jumps */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}>
        {/* ScrollView – keep messages and reserve space for anchored input */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4 py-3 mb-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          contentContainerStyle={{ paddingBottom: Math.max(160, keyboardHeight + 120) }}>
          {messages.map((m) => (
            <View
              key={m.id}
              className={`mb-3 flex w-full ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <View
                className={`max-w-[85%] px-4 py-3  ${
                  m.sender === 'user'
                    ? 'rounded-2xl'
                    : ' rounded-2xl border'
                }`}>
                <Text
                  style={
                    m.sender === 'user'
                      ? { color: theme.colors.primary, fontSize: 16, backgroundColor: theme.colors.accent }
                      : { color: theme.colors.primary, fontSize: 16 }
                  }>
                  {renderMarkdown(
                    m.text,
                    m.sender === 'user'
                      ? { color: theme.colors.primary, fontSize: 16 }
                      : { color: theme.colors.primary, fontSize: 16 }
                  )}
                </Text>
              </View>
            </View>
          ))}
          {isLoading && (
            <View className="mb-3 flex w-full items-start">
              <View className="max-w-[85%] rounded-2xl border px-4 py-3" style={{ borderColor: theme.colors.muted, backgroundColor: `${theme.colors.primary}0A` }}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom section (suggestions + input) - anchored above keyboard to avoid reflow */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardHeight }}>
          {/* Quick Suggestions */}
          <View className="border-t p-4" style={{ borderColor: theme.colors.muted, backgroundColor: theme.colors.card }}>
            <Text className="mb-2 text-lg font-bold" style={{ color: theme.colors.primary }}>{t('quickSuggestionsLabel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  onPress={() => handleSuggestion(suggestion)}
                  key={index}
                  className="mr-2 rounded-full px-4 py-2"
                  style={{ backgroundColor: theme.colors.accent }}>
                  <Text className="text-center text-sm font-semibold" style={{ color: theme.colors.primary }}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input row */}
          <View
            className="flex-row items-center border-t p-4"
            style={{ minHeight: 70, borderColor: theme.colors.muted, backgroundColor: theme.colors.card }}>
              <LuxuryInput
              className="flex-1"
              containerClassName="flex-1"
              style={{ minHeight: 46, maxHeight: 120 }}
              value={query}
              onChangeText={setQuery}
              placeholder={t('aiPlaceholder')}
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity
              onPress={() => handleSend()}
              className={`ml-2 h-12 w-12 items-center justify-center rounded-full ${isLoading ? 'opacity-50' : 'opacity-100'}`}
              style={{ backgroundColor: theme.colors.accent }}
              disabled={isLoading}>
              <Ionicons name="send" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AiStylus;
