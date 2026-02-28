import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,

      setTokens: (access, refresh) => {
        set({ accessToken: access, refreshToken: refresh || get().refreshToken });
        api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      },

      login: async (identity, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/api/auth/login', { email: identity, password });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
          set({ user: data.user, accessToken: data.access_token, refreshToken: data.refresh_token, isLoading: false });
          return { ok: true };
        } catch (e) {
          set({ isLoading: false });
          return { ok: false, error: e?.response?.data?.error || 'Login failed' };
        }
      },

      register: async (payload) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/api/auth/register', payload);
          api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
          set({ user: data.user, accessToken: data.access_token, refreshToken: data.refresh_token, isLoading: false });
          return { ok: true };
        } catch (e) {
          set({ isLoading: false });
          const fields = e?.response?.data?.fields;
          return { ok: false, error: e?.response?.data?.error || 'Registration failed', fields };
        }
      },

      loginAsGuest: async () => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/api/auth/guest');
          api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
          set({ user: data.user, accessToken: data.access_token, refreshToken: null, isLoading: false });
          return { ok: true };
        } catch (e) {
          set({ isLoading: false });
          return { ok: false, error: 'Guest login failed' };
        }
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null, refreshToken: null });
      },

      hydrate: () => {
        const { accessToken } = get();
        if (accessToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        }
      },
    }),
    {
      name: 'isl-auth',
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

export default useAuthStore;
