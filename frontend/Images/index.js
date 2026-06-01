import axios from 'axios';
import localHost from '../store/run';

const BACKEND_URL = localHost;

const mapServerItemTypeToCanvasType = (rawType) => {
  const t = String(rawType || '').toLowerCase();
  if (['top', 'tops', 'shirt', 'dress'].includes(t)) return 'shirt';
  if (['bottom', 'pants'].includes(t)) return 'pants';
  if (['skirts', 'skirt'].includes(t)) return 'skirts';
  if (['shoes', 'shoe'].includes(t)) return 'shoes';
  return 'tops';
};

/**
 * Fetch all user uploaded outfits
 */
export const fetchUserOutfits = async (token) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/images/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.images?.map((img, idx) => ({
      id: img.publicId || img._id || `outfit-${idx}`,
      image: img.url,
      type: mapServerItemTypeToCanvasType(img.itemType),
      gender: img.gender || 'unisex',
      itemType: img.itemType || 'other',
      publicId: img.publicId,
      uploadedAt: img.uploadedAt,
    })) || [];
  } catch (error) {
    console.error('Error fetching outfits:', error);
    return [];
  }
};

/**
 * Fetch images by category
 */
export const fetchImagesByCategory = async (category, token) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/images/category/${category}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.images?.map((img, idx) => ({
      id: img.publicId || img._id || `${category}-${idx}`,
      image: img.url,
      type: category,
      gender: img.gender || 'unisex',
      publicId: img.publicId,
      uploadedAt: img.uploadedAt,
    })) || [];
  } catch (error) {
    console.error(`Error fetching ${category} images:`, error);
    return [];
  }
};

/**
 * Fetch outfits (pants) - from uploaded images
 */
export const fetchPants = async (token) => {
  return await fetchImagesByCategory('outfit', token);
};

export const pants = [];

/**
 * Fetch tops - from uploaded images
 */
export const fetchTops = async (token) => {
  return await fetchImagesByCategory('outfit', token);
};

export const tops = [];

/**
 * Fetch skirts - from uploaded images
 */
export const fetchSkirts = async (token) => {
  return await fetchImagesByCategory('outfit', token);
};

export const skirts = [];

/**
 * Fetch mens pants - from uploaded images
 */
export const fetchMpants = async (token) => {
  return await fetchImagesByCategory('outfit', token);
};

export const mpants = [];

/**
 * Fetch mens shirts - from uploaded images
 */
export const fetchMshirts = async (token) => {
  return await fetchImagesByCategory('outfit', token);
};

export const mshirts = [];

/**
 * Fetch shoes - from uploaded images
 */
export const fetchShoes = async (token) => {
  return await fetchImagesByCategory('outfit', token);
};

export const shoes = [];


/**
 * Features - Static data (AI features)
 */
export const features = [
  {
    titleKey: 'featureAISuggestionsTitle',
    image: 'https://i.pinimg.com/736x/2e/3d/d1/2e3dd14ac81b207ee6d86bc99ef576eb.jpg',
    screen: 'AIChat',
    descKey: 'featureAISuggestionsDesc',
  },
  {
    titleKey: 'featureAIOutfitMakerTitle',
    image: 'https://i.pinimg.com/736x/50/83/0e/50830e372ee844c1f429b8ef89e26fd1.jpg',
    screen: 'AIOutfitMaker',
    descKey: 'featureAIOutfitMakerDesc',
  },
  {
    titleKey: 'featureColorAnalyzerTitle',
    image: 'https://i.pinimg.com/736x/c2/78/95/c2789530a2dc8c9dbfd4aa5e2e70d608.jpg',
    screen: 'colorAnalyzer',
    descKey: 'featureColorAnalyzerDesc',
  },
  {
    titleKey: 'featureWeatherTitle',
    image: 'https://i.pinimg.com/736x/84/bf/ce/84bfce1e46977d50631c4ef2f72f83b1.jpg',
    screen: 'WeatherSuggestion',
    descKey: 'featureWeatherDesc',
  },
];


/**
 * Fetch popular items from uploaded images
 */
export const fetchPopularItems = async (token) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/images/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.images?.slice(0, 3).map((img) => ({
      id: img._id,
      username: img.uploadedBy?.username || 'Unknown User',
      profile: 'https://randomuser.me/api/portraits/women/1.jpg',
      image: img.url,
      itemName: img.fileName?.split('.')[0] || 'Item',
      publicId: img.publicId,
    })) || [];
  } catch (error) {
    console.error('Error fetching popular items:', error);
    return [];
  }
};

export const popularItems = [];

/**
 * Fetch user stories from uploaded images
 */
export const fetchStories = async (token) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/images/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const stories = [
      {
        username: "Your OOTD",
        avatar: "https://picsum.photos/100/100?random=8",
        isOwn: true,
        viewed: false,
      },
    ];

    if (response.data.images?.length > 0) {
      response.data.images.slice(0, 3).forEach((img) => {
        stories.push({
          username: img.uploadedBy?.username || 'User',
          avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
          isOwn: false,
          viewed: false,
          imageId: img._id,
          image: img.url,
        });
      });
    }

    return stories;
  } catch (error) {
    console.error('Error fetching stories:', error);
    return [
      {
        username: "Your OOTD",
        avatar: "https://picsum.photos/100/100?random=8",
        isOwn: true,
        viewed: false,
      },
    ];
  }
};

export const initialStories = [];