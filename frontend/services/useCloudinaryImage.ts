import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import en from '../lang/en';
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from './cloudinaryApi';

/**
 * Custom hook for managing Cloudinary image uploads
 * Handles image selection, upload, and deletion
 */
export const useCloudinaryImage = (folder: string = 'general') => {
  const [image, setImage] = useState<{ uri: string; publicId?: string; url?: string } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);




  /**
   * Pick image from device
   */
  const pickImage = useCallback(async () => {
    try {
      setError(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setImage({ uri: result.assets[0].uri });
        return result.assets[0];
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pick image';
      setError(errorMessage);
      console.error('Image picker error:', err);
    }
  }, []);

  /**
   * Take photo with camera
   */
  const takePhoto = useCallback(async () => {
    try {
      setError(null);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setImage({ uri: result.assets[0].uri });
        return result.assets[0];
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to take photo';
      setError(errorMessage);
      console.error('Camera error:', err);
    }
  }, []);

  /**
   * Upload image to Cloudinary
   */
  const uploadImage = useCallback(
    async (
      imageUri?: string,
      metadata?: {
        relatedTo: string;
        relatedId?: string;
        itemType?: 'top' | 'bottom' | 'dress' | 'skirts' | 'shoes' | 'other';
        gender?: 'male' | 'female' | 'unisex';
      },
      removeBackground: boolean = false
    ) => {
      const uriToUpload = imageUri || image?.uri;
      if (!uriToUpload) {
        setError(en.noImageSelectedBody);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const filename = uriToUpload.split('/').pop() || 'image.jpg';
        const mimeType = uriToUpload.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

        console.log('📸 Image URI:', uriToUpload);
        console.log('📝 Filename:', filename);

        const file = {
          uri: uriToUpload,
          name: filename,
          type: mimeType,
        };

        console.log('📤 Starting upload...');
        // Upload to backend
        const uploadResult = await uploadImageToCloudinary(file, folder, metadata, removeBackground);

        console.log('📊 Upload result:', uploadResult);

        if (uploadResult.success && uploadResult.publicId) {
          setImage({
            uri: uriToUpload,
            publicId: uploadResult.publicId,
            url: uploadResult.url,
          });

          return uploadResult;
        } else {
          throw new Error(uploadResult.error || 'Upload failed');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
        setError(errorMessage);
        console.error('Upload error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [image?.uri, folder]
  );

  /**
   * Delete uploaded image
   */
  const deleteImage = useCallback(async () => {
    if (!image?.publicId) {
      setError(en.deleteImageFailed);
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await deleteImageFromCloudinary(image.publicId);
      if (success) {
        setImage(null);
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete image';
      setError(errorMessage);
      console.error('Delete error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [image?.publicId]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset image state
   */
  const resetImage = useCallback(() => {
    setImage(null);
    setError(null);
  }, []);

  return {
    image,
    isLoading,
    error,
    pickImage,
    takePhoto,
    uploadImage,
    deleteImage,
    clearError,
    resetImage,
    setImage,
  };
};

/**
 * Custom hook for managing multiple images
 */
export const useCloudinaryImages = (folder: string = 'general') => {
  const [images, setImages] = useState<
    { uri: string; publicId: string; url: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addImage = useCallback(
    async (
      imageUri: string,
      metadata?: {
        relatedTo?: string;
        relatedId?: string;
        itemType?: 'top' | 'bottom' | 'dress' | 'skirts' | 'shoes' | 'other';
        gender?: 'male' | 'female' | 'unisex';
      },
      removeBackground: boolean = false
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const filename = imageUri.split('/').pop() || 'image.jpg';
        const mimeType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const file = {
          uri: imageUri,
          name: filename,
          type: mimeType,
        };

        const uploadResult = await uploadImageToCloudinary(file, folder, metadata, removeBackground);

        if (uploadResult.success && uploadResult.publicId) {
          setImages((prev) => [
            ...prev,
            {
              uri: imageUri,
              publicId: uploadResult.publicId,
              url: uploadResult.url,
            },
          ]);
          return uploadResult.publicId;
        } else {
          throw new Error(uploadResult.error || 'Upload failed');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add image';
        setError(errorMessage);
        console.error('Add image error:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [folder]
  );

  const removeImage = useCallback(async (publicId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await deleteImageFromCloudinary(publicId);
      if (success) {
        setImages((prev) => prev.filter((img) => img.publicId !== publicId));
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove image';
      setError(errorMessage);
      console.error('Remove image error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    images,
    isLoading,
    error,
    addImage,
    removeImage,
    clearError,
    setImages,
  };
};

export default useCloudinaryImage;
