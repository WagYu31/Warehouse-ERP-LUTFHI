import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,

      setAuth: (user, token, refreshToken) => set({ user, token, refreshToken }),
      logout: () => set({ user: null, token: null, refreshToken: null }),
      updateUser: (updates) => set({ user: { ...get().user, ...updates } }),
    }),
    {
      name: 'wms-auth',
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
    }
  )
)
