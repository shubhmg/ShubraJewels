import { create } from 'zustand'
import { api, getToken, setToken } from '../lib/api.js'

export const useAuthStore = create((set) => ({
  token: getToken(),
  admin: null,
  loading: false,
  error: null,

  isAuthed: () => !!getToken(),

  async login(email, password) {
    set({ loading: true, error: null })
    try {
      const data = await api.post('/auth/login', { email, password })
      setToken(data.token)
      set({ token: data.token, admin: data.admin, loading: false })
      return true
    } catch (e) {
      set({ error: e.message, loading: false })
      return false
    }
  },

  async fetchMe() {
    if (!getToken()) return null
    try {
      const admin = await api.get('/auth/me', { auth: true })
      set({ admin })
      return admin
    } catch {
      setToken('')
      set({ token: '', admin: null })
      return null
    }
  },

  logout() {
    setToken('')
    set({ token: '', admin: null })
  },
}))
