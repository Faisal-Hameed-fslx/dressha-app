import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Modal from "react-native-modal";
import { SafeAreaView } from "react-native-safe-area-context";
import LuxuryBanner from "../components/Luxury/LuxuryBanner";
import LuxuryButton from "../components/Luxury/LuxuryButton";
import LuxuryCard from "../components/Luxury/LuxuryCard";
import LuxuryInput from "../components/Luxury/LuxuryInput";
import { useLanguage } from '../providers/LanguageProvider';
import localHost from "../store/run";
import { useTheme } from '../theme/ThemeProvider';

const AIOutfitMaker = () => {
  const [occasion, setOccasion] = useState("none");
  const [query, setQuery] = useState("");
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [outfits, setOutfits] = useState([]);
  const [error, setError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

  const occasions = [
    { labelKey: 'occasionSelect', value: "none" },
    { labelKey: 'occasionCasual', value: "casual" },
    { labelKey: 'occasionParty', value: "party" },
    { labelKey: 'occasionWork', value: "work" },
    { labelKey: 'occasionFormal', value: "formal" },
    { labelKey: 'occasionInterview', value: "interview" },
  ];

  const handleSearch = async () => {
    if (!query.trim() && !additionalPrompt.trim() && occasion === "none") {
      setError("Please enter a query, select an occasion, or add extra details.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let searchQuery = query.trim() || additionalPrompt.trim();
      // ✅ Only prepend occasion if it's NOT "none"
      if (occasion !== "none") {
        searchQuery = `${occasion}, ${searchQuery}`;
      }

      const response = await axios.get(
        `${localHost}/smart-search?query=${encodeURIComponent(searchQuery)}`
      );
      setOutfits(response.data);
    } catch (error) {
      console.error("Search Error:", error);
      setError("An error occurred while searching. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectOccasion = (value: any) => {
    setOccasion(value);
    setModalVisible(false); // ✅ Close modal after selection
  };

  return (
  <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
    <LinearGradient colors={[theme.colors.background, theme.colors.card, `${theme.colors.accent}14`]} className="absolute inset-0" />

    {/* Header */}
    <View className="flex-row items-center justify-between px-5 py-4" style={{ backgroundColor: theme.colors.card }}>
      <TouchableOpacity className="p-3" onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.accent} />
      </TouchableOpacity>
      <Text className="text-lg font-semibold" style={{ color: theme.colors.primary }}>{t('outfitSuggestionTitle')}</Text>
      <View className="w-10" />
    </View>
    <View className="mb-2 border-b" style={{ borderColor: theme.colors.muted }} />

    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Stylist Section */}
      <LuxuryCard className="mx-5 p-6 rounded-3xl">
        <View className="items-center">
          <Image
            source={{
              uri: "https://images.pexels.com/photos/19501169/pexels-photo-19501169.jpeg",
            }}
            className="w-28 h-28 rounded-full"
          />
          <View className="absolute -top-4 -mr-40 rounded-full px-3 py-1" style={{ backgroundColor: `${theme.colors.accent}18` }}>
            <Text className="text-xs font-semibold" style={{ color: theme.colors.primary }}>{t('aiStylistIntro')}</Text>
          </View>
          <Text className="mt-4 text-2xl font-bold text-luxury-ivory">Eli</Text>
          <Text className="my-1 text-sm" style={{ color: theme.colors.muted }}>Minimal • Timeless</Text>
          {/* <LuxuryButton className="mt-4" variant="ghost" label="Change Stylist" onPress={() => {}} /> */}
        </View>
      </LuxuryCard>

      {/* Outfit Request */}
      <LuxuryCard className="mx-5 mt-3 px-6 pt-2 rounded-3xl">
        <Text className="text-lg font-semibold" style={{ color: theme.colors.primary }}>{t('outfitRequestTitle')}</Text>

        {/* Occasion Picker */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="mt-2 flex-row items-center border-b pb-2"
          style={{ borderColor: theme.colors.muted }}
        >
          <Ionicons name="briefcase-outline" size={22} color={theme.colors.accent} />
          <Text className="flex-1 ml-3 text-base" style={{ color: theme.colors.primary }}>
            {t((occasions.find((o) => o.value === occasion) as any)?.labelKey) || t('occasionSelect')}
          </Text>
          <Ionicons name="chevron-down" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        {/* Main Query Input */}
        <View className="mb-2 flex-row items-center border-b" style={{ borderColor: theme.colors.muted }}>
          <Ionicons name="shirt-outline" size={24} color={theme.colors.accent} />
          <LuxuryInput className="ml-3 flex-1" containerClassName="ml-3 flex-1 my-2" placeholder={t('aiOutfitPlaceholder')} value={query} onChangeText={setQuery} />
        </View>

        {/* Additional Prompt */}
        <View>
          <Text className="mb-2 text-base font-semibold" style={{ color: theme.colors.primary }}>{t('additionalPromptLabel')}</Text>
          <LuxuryInput containerClassName="mb-1" placeholder={t('additionalPromptPlaceholder')} value={additionalPrompt} onChangeText={setAdditionalPrompt} multiline numberOfLines={4} />
          <Text className="mb-3 text-xs" style={{ color: theme.colors.muted }}>{t('maxCharsLabel')}</Text>
        </View>

        {/* Search Preview */}
          {(query || additionalPrompt || occasion !== "none") && (
          <Text className="px-4 text-center" style={{ color: theme.colors.muted }}>
            {t('searchingFor')} {`${occasion !== "none" ? t((occasions.find((o) => o.value === occasion) as any)?.labelKey) || "" : ""} ${query} ${additionalPrompt}`.trim()}
          </Text>
        )}

        {error && <LuxuryBanner tone="error" text={error} className="mt-4 px-4" />}

        <LuxuryButton label={loading ? t('searching') : t('generateOutfitsButton')} variant="dark" onPress={handleSearch} className="mt-3 mb-8 mx-4" loading={loading} />

        {loading && <Text className="mt-6 text-center" style={{ color: theme.colors.muted }}>{t('searchingForOutfits')}</Text>}

        {!loading && outfits.length > 0 && (
          <View className="mt-6 px-4">
            <Text className="mb-3 text-lg font-semibold" style={{ color: theme.colors.primary }}>{t('suggestedOutfits')}</Text>
            {outfits.map((outfit: any) => (
              <LuxuryCard key={outfit._id} className="mb-6 p-4 rounded-2xl">
                <View className="flex items-center">
                  <Image
                    resizeMode="contain"
                    style={{ aspectRatio: 0.75 }}
                    className="w-3/4 h-72"
                    source={{ uri: outfit?.image }}
                  />
                </View>
                <View className="mt-4">
                  <Text className="text-sm font-medium" style={{ color: theme.colors.accent }}>{t('itemsLabel')}</Text>
                  <Text className="mt-1 text-base" style={{ color: theme.colors.primary }}>
                    {Array.isArray(outfit.items) && outfit.items.length > 0
                      ? outfit.items.join(", ")
                      : t('noItemsListed')}
                  </Text>
                </View>
                <View className="mt-3">
                  <Text className="text-sm font-medium" style={{ color: theme.colors.accent }}>{t('detailsLabel')}</Text>
                  <Text className="text-sm" style={{ color: theme.colors.muted }}>
                   {t('styleLabel')}: {outfit.style}{'\n'}{t('occasionLabel')}: {outfit.occasion}{'\n'}{t('scoreLabel')}: {outfit.score ? (outfit.score * 100).toFixed(1) : "0"}%
                  </Text>
                </View>
              </LuxuryCard>
            ))}
          </View>
        )}

        {!loading && outfits.length === 0 && (query || additionalPrompt || occasion !== "none") && (
          <Text className="mt-6 text-center" style={{ color: theme.colors.muted }}>
            {t('noOutfitsFound')}
          </Text>
        )}
      </LuxuryCard>
    </ScrollView>

    {/* Occasion Modal */}
    <Modal
      isVisible={modalVisible}
      onBackdropPress={() => setModalVisible(false)}
      style={{ justifyContent: "flex-end", margin: 0 }}
      backdropColor="black"
      backdropOpacity={0.5}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <View className="rounded-t-3xl p-5 max-h-[50%]" style={{ backgroundColor: theme.colors.card }}>
          <View className="items-center mb-4">
          <View className="w-12 h-1 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
          <Text className="mt-3 text-lg font-semibold" style={{ color: theme.colors.primary }}>{t('occasionSelect')}</Text>
        </View>
        {occasions.map((item) => (
          <TouchableOpacity
            key={item.value}
            className="py-3 border-b"
            style={{ borderColor: theme.colors.muted }}
            onPress={() => selectOccasion(item.value)}
          >
            <Text className="text-base text-center" style={{ color: theme.colors.primary }}>{t((item as any).labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  </SafeAreaView>
);
};

export default AIOutfitMaker;