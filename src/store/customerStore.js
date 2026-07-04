import { create } from 'zustand'
import { api, getCustomerToken, setCustomerToken } from '../lib/api.js'

export const useCustomerStore = create((set, get) => ({
  token: getCustomerToken(),
  customer: null,
  loading: false,
  error: null,

  isAuthed: () => !!getCustomerToken(),

  _finish(data) {
    setCustomerToken(data.token)
    set({ token: data.token, customer: data.customer, loading: false, error: null })
    return true
  },

  async register(payload) {
    set({ loading: true, error: null })
    try { return get()._finish(await api.post('/customer/register', payload)) }
    catch (e) { set({ error: e.message, loading: false }); return false }
  },

  async login(email, password) {
    set({ loading: true, error: null })
    try { return get()._finish(await api.post('/customer/login', { email, password })) }
    catch (e) { set({ error: e.message, loading: false }); return false }
  },

  async google(credential) {
    set({ loading: true, error: null })
    try { return get()._finish(await api.post('/customer/google', { credential })) }
    catch (e) { set({ error: e.message, loading: false }); return false }
  },

  async fetchMe() {
    if (!getCustomerToken()) return null
    try {
      const customer = await api.get('/customer/me', { custAuth: true })
      set({ customer })
      return customer
    } catch {
      setCustomerToken(''); set({ token: '', customer: null }); return null
    }
  },

  async updateMe(patch) {
    const customer = await api.patch('/customer/me', patch, { custAuth: true })
    set({ customer })
    return customer
  },

  logout() {
    setCustomerToken('')
    set({ token: '', customer: null })
  },
}))
