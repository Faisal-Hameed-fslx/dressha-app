import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosInstance, create } from 'axios';
import localHost from '../store/run';

const BACKEND_BASE_URL =localHost; // Replace with actual backend URL or use environment variable

const apiClient: AxiosInstance = create({
  baseURL: BACKEND_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await (AsyncStorage as any).getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const uploadImageToCloudinary = async (
  file: any,
  folder: string,
  metadata?: {
    relatedTo?: string;
    relatedId?: string;
    itemType?: string;
    gender?: string;
  }
  , removeBackground?: boolean
): Promise<{
  success: boolean;
  publicId: string;
  url: string;
  error?: string;
}> => {
  try {
    let formData: FormData;
    if (file && typeof file.append === 'function') {
      formData = file as FormData;
    } else {
      formData = new FormData();

      // React Native multipart upload works reliably when sending the native file descriptor
      // { uri, name, type } directly instead of converting to Blob.
      formData.append('file', file as any);

      if (metadata?.relatedTo) formData.append('relatedTo', metadata.relatedTo);
      if (metadata?.relatedId) formData.append('relatedId', metadata.relatedId);
      if (metadata?.itemType) formData.append('itemType', metadata.itemType);
      if (metadata?.gender) formData.append('gender', metadata.gender);
      if (removeBackground) formData.append('removeBackground', 'true');
    }

    try {
      formData.append('folder', folder);
    } catch {}

    const token = await (AsyncStorage as any).getItem('token');
    const uploadUrl = `${BACKEND_BASE_URL}/api/images/upload`;
    console.log('Uploading to backend URL:', uploadUrl);
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });

    const responseText = await response.text();
    let responseData: any = null;

    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = null;
    }

    if (!response.ok) {
      return {
        success: false,
        publicId: '',
        url: '',
        error:
          responseData?.error ||
          (responseText.startsWith('<') ? 'Server returned HTML instead of JSON' : responseText) ||
          `Server error: ${response.status}`,
      };
    }

    if (!responseData) {
      return {
        success: false,
        publicId: '',
        url: '',
        error:
          responseText.startsWith('<')
            ? 'Server returned HTML instead of JSON'
            : 'Upload succeeded but response was not valid JSON',
      };
    }

    return responseData;
  } catch (error) {
    try {
      const healthRes = await fetch(BACKEND_BASE_URL + '/api/health');
      console.error('Backend health:', healthRes.status);
    } catch {}
    return { success: false, publicId: '', url: '', error: error instanceof Error ? error.message : 'Failed to upload image' };
  }
};

export const deleteImageFromCloudinary = async (publicId: string): Promise<boolean> => {
  try {
    const response = await apiClient.delete(`/api/images/${encodeURIComponent(publicId)}`);
    return response.data.success || false;
  } catch (error) {
    console.error('Image deletion error:', error);
    return false;
  }
};

export const getUserImages = async (): Promise<any[]> => {
  try {
    const response = await apiClient.get('/api/images/user');
    return response.data.images || [];
  } catch (error) {
    console.error('User images fetch error:', error);
    return [];
  }
};

export default apiClient;
