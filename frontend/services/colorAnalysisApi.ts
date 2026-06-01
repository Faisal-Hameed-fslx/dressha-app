

import axios from 'axios';
import localHost from '../store/run';
 // Replace with actual backend URL or use environment variable

interface BackendColorAnalysisRequest {
  imageUri?: string;
  dominantColor: string;
  colorFamily: string;
  averageColor: string;
  dominantColors: string[];
  topLabels: { label: string; score: number }[];
}

interface StyleJudgeResponse {
  summary: string;
  bestFor: string[];
  avoid: string[];
  styleNotes: string[];
  trendTakeaway: string;
  confidence: string;
  model: string;
}

interface LiveTrendResponse {
  title: string;
  snippet: string;
  relevanceScore: number;
}

interface BackendColorAnalysisResponse {
  styleJudge: StyleJudgeResponse;
  liveTrends: LiveTrendResponse[];
  recommendations: {
    palette: string[];
    styleAdvice: string[];
    seasonalTags: string[];
  };
  accessibility: {
    wcagLevel: string;
    contrastWithWhite: number;
    contrastWithBlack: number;
  };
}

/**
 * Send local color analysis to backend for style guidance and trend matching
 * @param token - Auth token
 * @param localAnalysis - Device-side color analysis results
 * @returns Backend-enriched analysis with style guidance and trends
 */
export async function getBackendColorAnalysis(
  token: string,
  localAnalysis: BackendColorAnalysisRequest,
): Promise<BackendColorAnalysisResponse> {
  try {
    const response = await axios.post<BackendColorAnalysisResponse>(
      `${localHost}/api/analysis/color-guidance`,
      localAnalysis,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    return response.data;
  } catch (error: any) {
    console.error(
      'Backend color analysis failed',
      error?.response?.status,
      error?.response?.data || error?.message
    );

    // Log detailed error info for debugging safely outside the console.error arguments
    if (error?.response) {
      // Server responded with error
      console.error(`[${error.response.status}] ${localHost}/api/analysis/color-guidance`, error.response.data);
    } else if (error?.request) {
      // Request made but no response
      console.error(`Network error connecting to ${localHost}`, error.message);
    } else {
      // Other errors
      console.error('Error in color analysis request:', error.message);
    }

    // Return fallback/default response if backend fails
    return {
      styleJudge: {
        summary: 'Backend analysis unavailable. Using local device-only analysis.',
        bestFor: [],
        avoid: [],
        styleNotes: ['Connect to backend for enhanced style guidance'],
        trendTakeaway: 'Check your internet connection for live trend context.',
        confidence: 'Local only',
        model: 'offline-mode',
      },
      liveTrends: [],
      recommendations: {
        palette: [],
        styleAdvice: ['Use the recommended palette above for styling decisions'],
        seasonalTags: [],
      },
      accessibility: {
        wcagLevel: 'Unknown',
        contrastWithWhite: 0,
        contrastWithBlack: 0,
      },
    };
  }
}

/**
 * Get complementary outfit suggestions based on dominant color
 */
export async function getOutfitSuggestions(
  token: string,
  dominantColor: string,
  colorFamily: string,
): Promise<{ category: string; suggestions: string[] }[]> {
  try {
    const response = await axios.post(
      `${localHost}/api/analysis/outfit-suggestions`,
      { dominantColor, colorFamily },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      },
    );

    return response.data?.suggestions || [];
  } catch (error: any) {
    console.warn('Outfit suggestions failed', error?.message);
    return [];
  }
}

/**
 * Get live fashion trends related to the detected color
 */
export async function getLiveFashionTrends(
  token: string,
  colorFamily: string,
): Promise<LiveTrendResponse[]> {
  try {
    const response = await axios.get<{ trends: LiveTrendResponse[] }>(
      `${localHost}/api/trends/fashion-color-trends`,
      {
        params: { colorFamily },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 8000,
      },
    );

    return response.data?.trends || [];
  } catch (error: any) {
    console.warn('Live trends fetch failed', error?.message);
    return [];
  }
}

/**
 * Save color analysis to user history for personalization
 */
export async function saveColorAnalysis(
  token: string,
  analysis: {
    dominantColor: string;
    colorFamily: string;
    topLabels: { label: string; score: number }[];
    timestamp: number;
  },
): Promise<boolean> {
  try {
    await axios.post(
      `${localHost}/api/user/color-history`,
      analysis,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      },
    );

    return true;
  } catch (error: any) {
    console.warn('Save color analysis failed', error?.message);
    return false;
  }
}
