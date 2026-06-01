import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImagePick from '../components/imagePick';
import { useLanguage } from '../providers/LanguageProvider';
import { useTheme } from '../theme/ThemeProvider';

// --- Interfaces ---
interface ClothingItem {
  id: string;
  image?: string;
  emoji?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  type: 'top' | 'bottom' | 'dress' | 'skirts' | 'shoes' | 'outfit' | 'other' | 'emoji';
}

// --- Helper Functions ---
const hexToRgba = (hex: string, alpha = 1) => {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  if (Number.isNaN(bigint)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Worklet-safe clamp function
const clampNumber = (n: number, a: number, b: number) => {
  'worklet';
  return Math.max(a, Math.min(b, n));
};

const normalizeClothingType = (value: string) => {
  const raw = String(value || '').toLowerCase().trim();
  if (['top', 'tops', 'shirt', 'shirts'].includes(raw)) return 'top';
  if (['bottom', 'bottoms', 'pants', 'trouser', 'trousers'].includes(raw)) return 'bottom';
  if (['skirt', 'skirts'].includes(raw)) return 'skirts';
  if (['shoe', 'shoes', 'sneaker', 'sneakers'].includes(raw)) return 'shoes';
  if (raw === 'dress') return 'dress';
  if (['outfit', 'look', 'ensemble'].includes(raw)) return 'outfit';
  return 'other';
};

// --- DraggableClothingItem ---
const DraggableClothingItem = ({
  item,
  isSelected,
  onPositionChange,
  onSelect,
  canvasWidth,
  canvasHeight,
}: {
  item: ClothingItem;
  isSelected: boolean;
  onPositionChange: (id: string, x: number, y: number, width: number, height: number) => void;
  onSelect: (id: string) => void;
  canvasWidth: number;
  canvasHeight: number;
}) => {
  const defaultWidth = 200;
  const defaultHeight = item.type === 'shoes' ? 120 : 200;

  const itemWidth = useSharedValue(item.width || defaultWidth);
  const itemHeight = useSharedValue(item.height || defaultHeight);
  const intrinsicW = useSharedValue(0);
  const intrinsicH = useSharedValue(0);
  const translateX = useSharedValue(item.x);
  const translateY = useSharedValue(item.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startWidth = useSharedValue(item.width || defaultWidth);
  const startHeight = useSharedValue(item.height || defaultHeight);
  const zIndex = useSharedValue(item.type === 'top' || item.type === 'skirts' ? 20 : 10);
  const itemId = useSharedValue(item.id);

  // Fix: Remove dependency array or add itemId
  useEffect(() => { 
    itemId.value = item.id; 
  }, [item.id, itemId]);

  // Fix: Add all dependencies or use refs
  useEffect(() => {
    let mounted = true;
    if (item.image) {
      Image.getSize(item.image, (w, h) => {
        if (!mounted) return;
        intrinsicW.value = w;
        intrinsicH.value = h;
      }, () => {});
    }
    return () => { mounted = false; };
  }, [item.image, intrinsicW, intrinsicH]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      zIndex.value = 100;
      runOnJS(onSelect)(itemId.value);
    })
    .onUpdate((e) => {
      const newX = startX.value + e.translationX;
      const newY = startY.value + e.translationY;

      // Clamp against the actually drawn image bounds (not just the container box)
      // so visual content can reach left/right edges even with contain-fit letterboxing.
      const iw = intrinsicW.value || itemWidth.value;
      const ih = intrinsicH.value || itemHeight.value;
      const scale = Math.min(itemWidth.value / iw, itemHeight.value / ih);
      const drawnW = iw * scale;
      const drawnH = ih * scale;

      const xInset = (itemWidth.value - drawnW) / 2;
      const yInset = (itemHeight.value - drawnH) / 2;

      const minX = -xInset;
      const maxX = canvasWidth - itemWidth.value + xInset;
      const minY = -yInset;
      const maxY = canvasHeight - itemHeight.value + yInset;

      translateX.value = clampNumber(newX, minX, maxX);
      translateY.value = clampNumber(newY, minY, maxY);
    })
    .onEnd(() => {
      runOnJS(onPositionChange)(itemId.value, translateX.value, translateY.value, itemWidth.value, itemHeight.value);
      zIndex.value = item.type === 'top' || item.type === 'skirts' ? 20 : 10;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startWidth.value = itemWidth.value;
      startHeight.value = itemHeight.value;
    })
    .onUpdate((e) => {
      const newWidth = clampNumber(startWidth.value * e.scale, 80, 400);
      const newHeight = clampNumber(startHeight.value * e.scale, 60, 400);
      itemWidth.value = newWidth;
      itemHeight.value = newHeight;

      const iw = intrinsicW.value || newWidth;
      const ih = intrinsicH.value || newHeight;
      const scale = Math.min(newWidth / iw, newHeight / ih);
      const drawnW = iw * scale;
      const drawnH = ih * scale;

      const xInset = (newWidth - drawnW) / 2;
      const yInset = (newHeight - drawnH) / 2;

      const minX = -xInset;
      const maxX = canvasWidth - newWidth + xInset;
      const minY = -yInset;
      const maxY = canvasHeight - newHeight + yInset;

      translateX.value = clampNumber(translateX.value, minX, maxX);
      translateY.value = clampNumber(translateY.value, minY, maxY);
    })
    .onEnd(() => {
      runOnJS(onPositionChange)(itemId.value, translateX.value, translateY.value, itemWidth.value, itemHeight.value);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    position: 'absolute',
    zIndex: zIndex.value,
  }));

  const resizeStyle = useAnimatedStyle(() => ({
    width: itemWidth.value,
    height: itemHeight.value,
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    fontSize: Math.min(itemWidth.value, itemHeight.value) * 0.6,
    textAlign: 'center',
  }));

  const borderStyle = useAnimatedStyle(() => {
    const iw = intrinsicW.value, ih = intrinsicH.value;
    if (!iw || !ih) return { borderWidth: 0 };
    const scale = Math.min(itemWidth.value / iw, itemHeight.value / ih);
    const dw = iw * scale, dh = ih * scale;
    return {
      position: 'absolute',
      left: (itemWidth.value - dw) / 2,
      top: (itemHeight.value - dh) / 2,
      width: dw,
      height: dh,
      borderWidth: isSelected ? 4 : 0,
      borderColor: '#C6A962',
      borderRadius: 0,
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={animatedStyle}>
        <Animated.View style={[resizeStyle, { borderRadius: 8, overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center' }]}>
          {item.emoji ? (
            <Animated.Text style={emojiStyle}>{item.emoji}</Animated.Text>
          ) : (
            <>
              <Image resizeMode="contain" style={{ width: '100%', height: '100%' }} source={{ uri: item.image }} />
              <Animated.View pointerEvents="none" style={borderStyle} />
            </>
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

// --- Simple Color Picker Component (No external dependencies) ---
const SimpleColorPicker = ({ visible, onClose, onColorSelect, currentColor }: any) => {
  const { theme } = useTheme();
  const presetColors = [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#008000', '#800000',
    '#F5F5DC', '#E6E6FA', '#FFF0F5', '#F0E68C', '#E0FFFF',
    '#FFB6C1', '#FFD700', '#98FB98', '#87CEEB', '#DDA0DD',
  ];

  const [selectedColor, setSelectedColor] = useState(currentColor);

  useEffect(() => {
    if (visible) {
      setSelectedColor(currentColor);
    }
  }, [visible, currentColor]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.primary }]}>
            Choose Background Color
          </Text>
          
          <View style={styles.colorGrid}>
            {presetColors.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setSelectedColor(color)}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.selectedColorOption,
                ]}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.colorPreview}>
            <View style={[styles.colorPreviewBox, { backgroundColor: selectedColor }]} />
            <Text style={[styles.colorPreviewText, { color: theme.colors.primary }]}>
              {selectedColor}
            </Text>
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: theme.colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.applyButton, { backgroundColor: theme.colors.accent }]} 
              onPress={() => {
                onColorSelect(selectedColor);
                onClose();
              }}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- DesignScreen Component ---
const DesignScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();

  const params = (route.params as any) || {};
  const { selectedOutfitItems = [], date = 'Unknown', savedOutfits = {} } = params;
  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [showStickersPicker, setShowStickersPicker] = useState(false);
  const [showClothesPicker, setShowClothesPicker] = useState(false);
  const [stickerCategory, setStickerCategory] = useState<string>('emoji');
  const [showColorModal, setShowColorModal] = useState(false);

  const screenW = Dimensions.get('window').width;
  const [canvasWidth, setCanvasWidth] = useState(Math.min(360, Math.max(320, Math.floor(screenW - 40))));
  const canvasHeight = 520;


  const stickerCategories: { [key: string]: string[] } = {
    emoji: ['😀', '😍', '😂', '🤩', '😎', '😊', '😉', '😇', '🤗', '🤔'],
    shapes: ['🔺', '🔷', '🔶', '⬛', '⬜', '🔵', '⚪', '🔻', '🔸', '🔹'],
    hearts: ['❤️', '💛', '💚', '💙', '💜', '🧡', '🩷', '🖤', '🤍', '🤎'],
  };

  useEffect(() => {
    if (!selectedOutfitItems || selectedOutfitItems.length === 0) return;

    const items = selectedOutfitItems
      .map((item: any) => {
        if (!item || !item.id) return null;

        const x = 20;
        let y;
        const normalizedType = normalizeClothingType(item.type);

        if (normalizedType === 'top' || normalizedType === 'skirts') {
          y = 20;
        } else if (normalizedType === 'bottom') {
          y = 240;
        } else if (normalizedType === 'shoes') {
          y = 420;
        } else {
          y = 240;
        }

        return {
          ...item,
          type: normalizedType,
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: item.width || 200,
          height: item.height || (normalizedType === 'shoes' ? 120 : 200),
        } as ClothingItem;
      })
      .filter(Boolean) as ClothingItem[];

    setClothes(items);
  }, [selectedOutfitItems]);

  const handlePositionChange = useCallback((id: string, x: number, y: number, w: number, h: number) => {
    setClothes((prev) => prev.map((item) => (item.id === id ? { ...item, x, y, width: w, height: h } : item)));
  }, []);

  const handleSelectItem = useCallback((id: string) => setSelectedItemId(id), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: hexToRgba(theme.colors.primary, 0.08) }]}>
        <TouchableOpacity style={styles.pad} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.primary }]}>{date}</Text>
        <TouchableOpacity
          style={styles.pad}
            onPress={() => {
            if (clothes.length === 0) {
              alert(t('noItemsToSave'));
              return;
            }
            navigation.navigate('OutfitPage', { selectedOutfitItems: clothes, date, savedOutfits, backgroundColor, designCanvasWidth: canvasWidth, designCanvasHeight: canvasHeight });
          }}
        >
          <Ionicons name="arrow-forward" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={{ marginHorizontal: 16, marginTop: 24, marginBottom: 16 }}>
          <View style={[styles.canvasCard, { backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.primary, 0.08) }]}>
            <View
              onLayout={(e) => {
                const measuredWidth = Math.floor(e.nativeEvent.layout.width);
                if (measuredWidth > 0 && measuredWidth !== canvasWidth) {
                  setCanvasWidth(measuredWidth);
                }
              }}
              style={[
                {
                  position: 'relative',
                  width: '100%',
                  maxWidth: 360,
                  height: canvasHeight,
                  alignSelf: 'center',
                  borderRadius: 12,
                  overflow: 'hidden',
                },
                { backgroundColor },
              ]}
            >
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor }} />
              {clothes.map((item) => (
                <DraggableClothingItem
                  key={item.id}
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onPositionChange={handlePositionChange}
                  onSelect={handleSelectItem}
                  canvasWidth={canvasWidth}
                  canvasHeight={canvasHeight}
                />
              ))}
              
            </View>
            <Text style={{ marginTop: 12, textAlign: 'center', color: theme.colors.muted }}>{t('designHelpText')}</Text>
          </View>
        </View>

        <View style={[styles.controlsRow, { backgroundColor: theme.colors.card, borderTopColor: hexToRgba(theme.colors.primary, 0.08) }]}>
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: hexToRgba(theme.colors.primary, 0.08), borderColor: hexToRgba(theme.colors.primary, 0.08) }]}
            onPress={() => {
              setShowClothesPicker((s) => !s);
              setShowStickersPicker(false);
            }}
          >
            <Text style={[styles.controlText, { color: theme.colors.primary }]}>{t('addClothesLabel')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: hexToRgba(theme.colors.accent, 0.14), borderColor: hexToRgba(theme.colors.accent, 0.2) }]}
            onPress={() => {
              setShowStickersPicker((s) => !s);
              setShowClothesPicker(false);
            }}
          >
            <Text style={[styles.controlText, { color: theme.colors.primary }]}>{t('stickersLabel')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: hexToRgba(theme.colors.primary, 0.06), borderColor: hexToRgba(theme.colors.primary, 0.08) }]}
            onPress={() => {
              setShowColorModal(true);
              setShowClothesPicker(false);
              setShowStickersPicker(false);
            }}
          >
            <Text style={[styles.controlText, { color: theme.colors.primary }]}>{t('backgroundLabel')}</Text>
          </TouchableOpacity>
        </View>

        {showClothesPicker && (
          <View style={{ padding: 12, backgroundColor: theme.colors.card }}>
            <ImagePick
              onImagePicked={(uri: string) => {
                const id = `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const newItem: ClothingItem = { id, image: uri, x: 20, y: 20, type: 'outfit', width: 200, height: 200 };
                setClothes((s) => [...s, newItem]);
                setShowClothesPicker(false);
              }}
            />
          </View>
        )}

        {showStickersPicker && (
          <View style={{ padding: 12, backgroundColor: theme.colors.card }}>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {Object.keys(stickerCategories).map((cat) => (
                <TouchableOpacity key={cat} onPress={() => setStickerCategory(cat)} style={{ padding: 8, borderRadius: 8, backgroundColor: stickerCategory === cat ? hexToRgba(theme.colors.accent, 0.14) : 'transparent', marginRight: 8 }}>
                  <Text style={{ color: theme.colors.primary }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(stickerCategories[stickerCategory] || []).map((s, idx) => (
                <TouchableOpacity
                  key={`${stickerCategory}-${idx}`}
                  onPress={() => {
                    const id = `st-${Date.now()}-${idx}`;
                    const newItem: ClothingItem = { id, emoji: s, x: 40, y: 40 + idx * 20, type: 'emoji', width: 120, height: 120 };
                    setClothes((arr) => [...arr, newItem]);
                    setShowStickersPicker(false);
                  }}
                  style={{ marginRight: 12, width: 88, height: 88, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}
                >
                  <Text style={{ fontSize: 36 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <SimpleColorPicker
          visible={showColorModal}
          onClose={() => setShowColorModal(false)}
          onColorSelect={(color: string) => setBackgroundColor(color)}
          currentColor={backgroundColor}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1 },
  pad: { padding: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  canvasCard: { borderRadius: 16, padding: 16, borderWidth: 1, overflow: 'hidden' },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, padding: 12 },
  controlBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, marginHorizontal: 6 },
  controlText: { textAlign: 'center', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', borderRadius: 16, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 },
  colorOption: { width: 50, height: 50, borderRadius: 25, margin: 8, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  selectedColorOption: { borderColor: '#fff', borderWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  colorPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  colorPreviewBox: { width: 40, height: 40, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: '#ddd' },
  colorPreviewText: { fontSize: 14, fontFamily: 'monospace' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  applyButton: { backgroundColor: '#007AFF' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});

export default DesignScreen;