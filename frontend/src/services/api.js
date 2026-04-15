import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response.data ?? response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    if (error.response?.status === 403) {
      toast.error('Akses ditolak. Anda tidak memiliki hak akses.')
    }
    if (error.response?.status >= 500) {
      toast.error('Terjadi kesalahan server. Silakan coba lagi.')
    }
    return Promise.reject(error)
  }
)

export default api
