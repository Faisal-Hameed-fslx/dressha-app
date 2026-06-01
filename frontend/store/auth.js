import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { create } from 'zustand';
import localHost from './run';

const baseUrl = localHost;

const useAuthStore = create((set) => ({
  token: null,
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,

  setError: (message) => set({ error: message }),
  clearError: () => set({ error: null }),

  initalizeAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        set({ token, isAuthenticated: true });
        await useAuthStore.getState().fetchUser();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
  },

  checkUsernameAvailability: async (username) => {
    try {
      const response = await axios.get(
        `${baseUrl}/check-username?username=${encodeURIComponent(username)}`
      );
      return response.data.available;
    } catch (error) {
      console.error('Availability check failed:', error);
      return false;
    }
  },

  signup: async (email, password, username, gender, profilePictureUri) => {
    set({ loading: true, error: null });

    try {
      const formData = new FormData();

      formData.append('email', email);
      formData.append('password', password);
      formData.append('username', username);
      formData.append('gender', gender);

     if (profilePictureUri) {
  formData.append('profilePicture', profilePictureUri);
}

      const response = await axios.post(`${baseUrl}/signup`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { token, user } = response.data;

      await AsyncStorage.setItem('token', token);

      set({
        token,
        user,
        isAuthenticated: true,
        loading: false,
      });
    } catch (error) {
      console.error('Signup error:', error.response?.data || error.message);

      set({
        error: error.response?.data?.error || 'Signup failed',
        loading: false,
      });
    }
  },

  // FIXED: return response.data so callers (EditProfile) can use the updated user
  updateProfile: async (formData) => {
    try {
      const token = await AsyncStorage.getItem('token');

      const response = await axios.patch(`${baseUrl}/me`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      set({ user: response.data });
      return response.data;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${baseUrl}/login`, {
        email,
        password,
      });
      const { token } = response.data;
      await AsyncStorage.setItem('token', token);
      set({ token, isAuthenticated: true, loading: false });
      await useAuthStore.getState().fetchUser();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  loginWithGoogle: async (idToken) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${baseUrl}/auth/google`, {
        idToken,
      });

      const { token, user } = response.data;

      await AsyncStorage.setItem('token', token);

      set({
        token,
        user,
        isAuthenticated: true,
        loading: false,
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Google login failed';
      set({ error: errorMessage, loading: false });
      throw new Error(errorMessage);
    }
  },

  // Accept server-issued token/user from PKCE/code flow and persist locally
  setAuthFromServer: async (data) => {
    try {
      const { token, user } = data || {};
      if (!token) throw new Error('Missing token from server');
      await AsyncStorage.setItem('token', token);
      set({ token, user, isAuthenticated: true, loading: false, error: null });
    } catch (err) {
      console.error('setAuthFromServer error', err);
      throw err;
    }
  },


  logout: async () => {
    await AsyncStorage.removeItem('token');
    set({ token: null, isAuthenticated: false, user: null });
  },

  fetchUser: async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) return;

      const response = await axios.get(`${baseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      set({ user: response.data, error: null });
    } catch (error) {
      console.error('Failed to fetch user:', error);

      set({
        user: null,
        error: error.response?.data?.error || 'Failed to fetch user',
      });
    }
  },
}));

export default useAuthStore;