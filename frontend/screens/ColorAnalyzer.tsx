import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../providers/LanguageProvider';
import { getBackendColorAnalysis } from '../services/colorAnalysisApi';
import { analyzeColorOnDevice, unloadMobileModels, warmupMobileModels } from '../services/mobileModelRuntime';
import useAuthStore from '../store/auth';
import { useTheme } from '../theme/ThemeProvider';

type PaletteItem = { label?: string; score?: number };
type LiveTrendItem = { title?: string; snippet?: string };
type StyleJudge = {
  summary?: string;
  bestFor?: string[];
  avoid?: string[];
  styleNotes?: string[];
  trendTakeaway?: string;
  confidence?: string;
  model?: string;
  raw?: string;
};

const normalizeHexColor = (value: unknown) => {
  if (typeof value !== 'string') return '#000000';
  const trimmed = value.trim();
  if (!trimmed) return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const short = trimmed.slice(1);
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`;
  }
  return '#000000';
};

const colorLabel = (value: unknown) => normalizeHexColor(value).toUpperCase();

const ColorAnalyzer = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const token = useAuthStore.getState().token;
  const isAndroid = Platform.OS === 'android';

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const prepareModels = async () => {
        if (!isAndroid) {
          setModelReady(false);
          setModelError('Color Analyzer is available on Android only.');
          return;
        }

        if (!token) {
          setModelReady(false);
          setModelError(null);
          return;
        }

        try {
          setModelLoading(true);
          setModelError(null);
          const warmed = await warmupMobileModels(token);
          if (active) {
            setModelReady(warmed);
          }
        } catch (error: any) {
          console.error('Failed to warm up mobile models', error?.response?.data || error?.message || error);
          if (active) {
            setModelReady(false);
            setModelError(error?.response?.data?.error || error?.message || 'Unable to load on-device model');
          }
        } finally {
          if (active) {
            setModelLoading(false);
          }
        }
      };

      prepareModels();

      return () => {
        active = false;
        unloadMobileModels().catch((error) => {
          console.warn('Failed to unload color analysis model', error);
        });
      };
    }, [isAndroid, token]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        unloadMobileModels().catch((error) => {
          console.warn('Failed to unload color analysis model on background', error);
        });
        setModelReady(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permissionRequiredTitle'), t('permissionRequiredBody'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
        setAnalysis(null);
      }
    } catch (error) {
      console.error('Pick image failed', error);
      Alert.alert(t('errorTitle'), t('pickImageError'));
    }
  };

  const analyzeImage = async () => {
    if (!isAndroid) {
      Alert.alert(t('errorTitle'), t('androidOnlyNote'));
      return;
    }

    if (!imageUri) {
      Alert.alert(t('noPhotoAlertTitle'), t('noPhotoAlertBody'));
      return;
    }

    if (!token) {
      Alert.alert(t('loginRequiredTitle'), t('loginRequiredBody'));
      return;
    }

    try {
      setAnalyzing(true);

      // Step 1: Device-side inference
      let localResult: any = null;
      try {
        if (!modelReady) {
          await warmupMobileModels(token);
        }
        localResult = await analyzeColorOnDevice(imageUri, token);
      } catch (err: any) {
        console.error('Local analyze failed', err);
        Alert.alert(t('analysisFailedTitle'), err?.message || t('analysisFailedBody'));
        return;
      }

      // Step 2: Fetch backend enrichment (style guidance, trends, recommendations)
      setBackendLoading(true);
      try {
        const backendResult = await getBackendColorAnalysis(token, {
          dominantColor: localResult.averageColor,
          colorFamily: localResult.colorFamily,
          averageColor: localResult.averageColor,
          dominantColors: localResult.dominantColors,
          topLabels: localResult.topLabels || [],
        });

        // Combine local + backend results
        setAnalysis({
          ...localResult,
          styleJudge: backendResult.styleJudge,
          liveTrends: backendResult.liveTrends,
          recommendations: backendResult.recommendations,
          accessibility: backendResult.accessibility,
        });
      } catch (err: any) {
        console.warn('Backend enrichment failed, showing local results only', err?.message);
        // Show local results even if backend fails
        setAnalysis(localResult);
      }
    } finally {
      setAnalyzing(false);
      setBackendLoading(false);
    }
  };

  const topLabels: PaletteItem[] = useMemo(() => analysis?.topLabels || [], [analysis]);
  const bestLabel: PaletteItem | null = useMemo(() => {
    if (!topLabels.length) return null;
    return topLabels.reduce((best, item) => {
      const bestScore = typeof best.score === 'number' ? best.score : -1;
      const itemScore = typeof item.score === 'number' ? item.score : -1;
      return itemScore > bestScore ? item : best;
    }, topLabels[0] as PaletteItem);
  }, [topLabels]);
  const dominantColors: string[] = useMemo(() => (analysis?.dominantColors || []).map(normalizeHexColor), [analysis]);
  const recommendationPalette: string[] = useMemo(() => (analysis?.recommendations?.palette || []).map(normalizeHexColor), [analysis]);
  const advice: string[] = useMemo(() => analysis?.recommendations?.styleAdvice || [], [analysis]);
  const liveTrends: LiveTrendItem[] = useMemo(() => analysis?.liveTrends || [], [analysis]);
  const styleJudge: StyleJudge | null = useMemo(() => analysis?.styleJudge || null, [analysis]);
  const busy = analyzing || backendLoading;
  const premiumColors = {
    background: theme.name === 'scandi-dark' ? '#0F1115' : '#F4EFE7',
    surface: theme.name === 'scandi-dark' ? '#181B21' : '#FFF9F2',
    surfaceSoft: theme.name === 'scandi-dark' ? '#1F242C' : '#F8F2E8',
    border: theme.name === 'scandi-dark' ? 'rgba(255,255,255,0.08)' : 'rgba(24, 18, 10, 0.08)',
    text: theme.name === 'scandi-dark' ? '#F4EFE7' : '#221B16',
    subtext: theme.name === 'scandi-dark' ? '#A9B1BD' : '#776B60',
    accent: '#C89B52',
    accentSoft: 'rgba(200, 155, 82, 0.12)',
    accentSoftStrong: 'rgba(200, 155, 82, 0.18)',
  };

  const renderSectionHeader = (title: string, subtitle?: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{title.toUpperCase()}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: premiumColors.background }]}>
      <View style={[styles.backgroundGlow, { backgroundColor: premiumColors.accent }]} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { borderColor: premiumColors.border, backgroundColor: premiumColors.surface }]}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: premiumColors.accentSoft }]}>
              <Ionicons name="arrow-back" size={22} color={premiumColors.accent} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { color: premiumColors.text }]}>{t('analyzerTitle')}</Text>
              <Text style={[styles.pageSubtitle, { color: premiumColors.subtext }]}>{t('uploadInstructions')}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: isAndroid ? premiumColors.accentSoft : premiumColors.accentSoftStrong }]}>
              <Text style={[styles.statusPillText, { color: premiumColors.accent }]}>
                {isAndroid ? (modelReady ? 'Ready' : modelLoading ? 'Loading' : 'Android') : 'iOS'}
              </Text>
            </View>
          </View>

          {!isAndroid ? (
            <View style={[styles.noticeBanner, { backgroundColor: premiumColors.accentSoft }]}>
              <Ionicons name="warning-outline" size={16} color={premiumColors.accent} />
              <Text style={[styles.noticeText, { color: premiumColors.text }]}>{t('androidOnlyNote')}</Text>
            </View>
          ) : null}

          {modelError ? <Text style={[styles.helperText, { color: premiumColors.subtext }]}>{modelError}</Text> : null}
        </View>

        <View style={[styles.imagePanel, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.emptyImage, { backgroundColor: premiumColors.surfaceSoft, borderColor: premiumColors.border }]}>
              <View style={[styles.emptyImageOrb, { backgroundColor: premiumColors.accentSoft }]}>
                <Ionicons name="image-outline" size={30} color={premiumColors.accent} />
              </View>
              <Text style={[styles.emptyImageTitle, { color: premiumColors.text }]}>{t('noPhotoSelected')}</Text>
              <Text style={[styles.emptyImageSubtitle, { color: premiumColors.subtext }]}>{t('uploadInstructions')}</Text>
            </View>
          )}
        </View>

        <View style={[styles.actionPanel, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
          <TouchableOpacity onPress={pickImage} style={[styles.secondaryButton, { borderColor: premiumColors.border, backgroundColor: premiumColors.surfaceSoft }]}>
            <Ionicons name="cloud-upload-outline" size={18} color={premiumColors.text} />
            <Text style={[styles.secondaryButtonText, { color: premiumColors.text }]}>{imageUri ? t('replacePhoto') : t('uploadPhoto')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={analyzeImage}
            style={[styles.primaryButton, { backgroundColor: premiumColors.accent, opacity: busy || !isAndroid ? 0.75 : 1 }]}
            disabled={busy || !isAndroid}
          >
            {busy ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={[styles.primaryButtonText, { color: '#FFFFFF', marginLeft: 10 }]}>
                  {analyzing ? t('analyzing') : t('enriching')}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.primaryButtonText, { color: '#FFFFFF', marginLeft: 10 }]}>{t('analyzePhoto')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {analysis ? (
          <View style={{ gap: 14 }}>
            <View style={[styles.resultCard, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
              {renderSectionHeader(t('detectedColorFamily'), 'Core output from the local model')}
              <View style={styles.metricRow}>
                <View style={[styles.metricBadge, { backgroundColor: premiumColors.accentSoft }]}>
                  <Text style={[styles.metricBadgeLabel, { color: premiumColors.subtext }]}>Family</Text>
                  <Text style={[styles.metricBadgeValue, { color: premiumColors.text }]}>{analysis.colorFamily}</Text>
                </View>
                <View style={[styles.metricBadge, { backgroundColor: premiumColors.surfaceSoft }]}>
                  <Text style={[styles.metricBadgeLabel, { color: premiumColors.subtext }]}>Detected skin color</Text>
                  <View style={styles.skinColorRow}>
                    <View style={[styles.skinSwatch, { backgroundColor: normalizeHexColor(analysis.averageColor) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.metricBadgeValue, { color: premiumColors.text }]}>{colorLabel(analysis.averageColor)}</Text>
                      <Text style={[styles.metricBadgeSubtext, { color: premiumColors.subtext }]}>Foreground-focused color after portrait matting</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={[styles.runtimeNote, { backgroundColor: premiumColors.surfaceSoft, borderColor: premiumColors.border }]}>
                <Ionicons name="hardware-chip-outline" size={15} color={premiumColors.accent} />
                <Text style={[styles.runtimeNoteText, { color: premiumColors.subtext }]}>
                  Approx RAM: ~{analysis.estimatedRamMb || 64} MB on Android, using {analysis.accelerator || 'nnapi-first'}.
                </Text>
              </View>
            </View>

            <View style={[styles.resultCard, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
              {renderSectionHeader(t('topVisionTags'), 'Highest-confidence model result only')}
              {bestLabel ? (
                <View style={[styles.bestMatchCard, { backgroundColor: premiumColors.accentSoft, borderColor: premiumColors.border }]}>
                  <View style={[styles.bestMatchIcon, { backgroundColor: premiumColors.accent }]}>
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bestMatchTitle, { color: premiumColors.text }]}>{bestLabel.label || t('trendResultPlaceholder')}</Text>
                    <Text style={[styles.bestMatchSubtitle, { color: premiumColors.subtext }]}>
                      {typeof bestLabel.score === 'number' ? `Confidence ${(bestLabel.score * 100).toFixed(0)}%` : 'Confidence not available'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.bodyText, { color: premiumColors.subtext }]}>{t('trendResultPlaceholder')}</Text>
              )}
            </View>

            <View style={[styles.resultCard, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
              {renderSectionHeader(t('dominantColors'), 'Top extracted palette from your image')}
              <View style={styles.paletteRow}>
                {dominantColors.map((color) => (
                  <View key={color} style={styles.swatchBlock}>
                    <View style={[styles.swatch, { backgroundColor: color }]} />
                    <View style={[styles.hexBadge, { backgroundColor: premiumColors.surfaceSoft, borderColor: premiumColors.border }]}>
                      <Text style={[styles.hexBadgeText, { color: premiumColors.text }]}>{colorLabel(color)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.resultCard, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
              {renderSectionHeader(t('recommendedPalette'), 'Suggested companion tones')}
              <View style={styles.paletteRow}>
                {recommendationPalette.map((color) => (
                  <View key={color} style={styles.swatchBlock}>
                    <View style={[styles.swatch, { backgroundColor: color, width: 52, height: 52 }]} />
                    <View style={[styles.hexBadge, { backgroundColor: premiumColors.surfaceSoft, borderColor: premiumColors.border }]}>
                      <Text style={[styles.hexBadgeText, { color: premiumColors.text }]}>{colorLabel(color)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {liveTrends.length > 0 ? (
              <View style={[styles.resultCard, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
                {renderSectionHeader(t('liveTrendContext'), 'Styled like a brief insight feed')}
                <View style={{ gap: 10 }}>
                  {liveTrends.map((item, index) => (
                    <View key={`${item.title || 'trend'}-${index}`} style={[styles.trendCard, { backgroundColor: premiumColors.surfaceSoft, borderColor: premiumColors.border }]}>
                      <Text style={[styles.trendTitle, { color: premiumColors.text }]}>{item.title || t('trendResultPlaceholder')}</Text>
                      <Text style={[styles.trendBody, { color: premiumColors.subtext }]}>{item.snippet || t('trendResultPlaceholder')}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {styleJudge ? (
              <View style={[styles.resultCard, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
                {renderSectionHeader(
                  styleJudge.model ? (styleJudge.model.includes('offline') ? t('localAnalysis') : t('aiStyleGuidance')) : t('styleAnalysisLabel'),
                  'Human-friendly styling notes and context',
                )}
                <Text style={[styles.bodyText, { color: premiumColors.subtext }]}>{styleJudge.summary || t('styleAnalysisSummaryPlaceholder')}</Text>

                {!!styleJudge.trendTakeaway && (
                  <View style={styles.inlineBlock}>
                    <Text style={[styles.inlineLabel, { color: premiumColors.text }]}>{t('trendTakeawayLabel')}</Text>
                    <Text style={[styles.bodyText, { color: premiumColors.subtext }]}>{styleJudge.trendTakeaway}</Text>
                  </View>
                )}

                {!!styleJudge.confidence && (
                  <View style={styles.inlineBlock}>
                    <Text style={[styles.inlineLabel, { color: premiumColors.text }]}>{t('confidenceLabel')}</Text>
                    <Text style={[styles.bodyText, { color: premiumColors.subtext }]}>{styleJudge.confidence}</Text>
                  </View>
                )}

                {!!styleJudge.bestFor?.length && (
                  <View style={styles.inlineBlock}>
                    <Text style={[styles.inlineLabel, { color: premiumColors.text }]}>{t('bestForLabel')}</Text>
                    {styleJudge.bestFor.map((item, index) => (
                      <Text key={`best-${index}-${item}`} style={[styles.bulletText, { color: premiumColors.subtext }]}>• {item}</Text>
                    ))}
                  </View>
                )}

                {!!styleJudge.avoid?.length && (
                  <View style={styles.inlineBlock}>
                    <Text style={[styles.inlineLabel, { color: premiumColors.text }]}>{t('avoidLabel')}</Text>
                    {styleJudge.avoid.map((item, index) => (
                      <Text key={`avoid-${index}-${item}`} style={[styles.bulletText, { color: premiumColors.subtext }]}>• {item}</Text>
                    ))}
                  </View>
                )}

                {!!styleJudge.styleNotes?.length && (
                  <View style={styles.inlineBlock}>
                    <Text style={[styles.inlineLabel, { color: premiumColors.text }]}>{t('styleNotesLabel')}</Text>
                    {styleJudge.styleNotes.map((item, index) => (
                      <Text key={`note-${index}-${item}`} style={[styles.bulletText, { color: premiumColors.subtext }]}>• {item}</Text>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            <View style={[styles.resultCard, { backgroundColor: premiumColors.surface, borderColor: premiumColors.border }]}>
              {renderSectionHeader(t('styleGuidanceLabel'), 'Actionable styling advice from the analyzer')}
              {advice.length > 0 ? (
                advice.map((item, index) => (
                  <View key={`${index}-${item}`} style={styles.adviceRow}>
                    <View style={[styles.adviceDot, { backgroundColor: premiumColors.accent }]} />
                    <Text style={[styles.adviceText, { color: premiumColors.subtext }]}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.bodyText, { color: premiumColors.subtext }]}>{t('coreAnalysisNote')}</Text>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = {
  screen: {
    flex: 1,
  },
  backgroundGlow: {
    position: 'absolute' as const,
    top: -90,
    right: -100,
    width: 220,
    height: 220,
    borderRadius: 999,
    opacity: 0.08,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 14,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  noticeBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
  },
  imagePanel: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  heroImage: {
    width: '100%',
    height: 420,
    borderRadius: 18,
    backgroundColor: '#111',
  },
  emptyImage: {
    width: '100%',
    minHeight: 320,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyImageOrb: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyImageTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  emptyImageSubtitle: {
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  actionPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row' as const,
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionHeader: {
    gap: 4,
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
    opacity: 0.75,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  metricBadge: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  metricBadgeLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  metricBadgeValue: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  metricBadgeSubtext: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  skinColorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  skinSwatch: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  runtimeNote: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  runtimeNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600' as const,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  bestMatchCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  bestMatchIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  bestMatchTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: -0.1,
  },
  bestMatchSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  paletteRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  swatchBlock: {
    width: 72,
    alignItems: 'center' as const,
    gap: 6,
  },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  swatchLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  hexBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 64,
  },
  hexBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
  },
  trendCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  trendTitle: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  trendBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 20,
  },
  inlineBlock: {
    marginTop: 12,
  },
  inlineLabel: {
    fontSize: 13,
    fontWeight: '800' as const,
    marginBottom: 6,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 5,
  },
  adviceRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    marginBottom: 10,
  },
  adviceDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },
  adviceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
} as const;

export default ColorAnalyzer;