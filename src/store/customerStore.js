import { create } from 'zustand'
import { api, getCustomerToken, setCustomerToken } from '../lib/api.js'
import { useCartStore } from './cartStore.js'

// Merge the server-saved cart into the local bag after sign-in.
async function mergeServerCart(serverCart) {
  if (!serverCart?.length) return
  try {
    // Server cart stores { productId, qty }; fetch product details to rebuild items.
    const items = await Promise.all(
      serverCart.map(async (c) => {
        try {
          const p = await api.get(`/products/${c.productId}`)
          return { ...p, id: p._id, key: `${p._id}-One Size`, size: 'One Size', qty: c.qty }
        } catch { return null }
      })
    )
    const cart = useCartStore.getState()
    items.filter(Boolean).forEach((it) => {
      const existing = cart.items.find((x) => x.key === it.key)
      if (!existing) cart.addItem({ ...it, id: it.id }, 'One Size', it.qty)
    })
  } catch { /* ignore */ }
}

export const useCustomerStore = create((set, get) => ({
  token: getCustomerToken(),
  customer: null,
  loading: false,
  error: null,

  isAuthed: () => !!getCustomerToken(),

  async _finish(data) {
    setCustomerToken(data.token)
    set({ token: data.token, customer: data.customer, loading: false, error: null })
    await mergeServerCart(data.customer?.cart)
    get().syncCart()
    return true
  },

  async register(payload) {
    set({ loading: true, error: null })
    try { return await get()._finish(await api.post('/customer/register', payload)) }
    catch (e) { set({ error: e.message, loading: false }); return false }
  },

  async login(email, password) {
    set({ loading: true, error: null })
    try { return await get()._finish(await api.post('/customer/login', { email, password })) }
    catch (e) { set({ error: e.message, loading: false }); return false }
  },

  async google(credential) {
    set({ loading: true, error: null })
    try { return await get()._finish(await api.post('/customer/google', { credential })) }
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

  // Persist the current bag to the server (bag follows the customer across devices).
  syncCart() {
    if (!getCustomerToken()) return
    const cart = useCartStore.getState().items.map((i) => ({ productId: i.id || i._id, qty: i.qty }))
      .filter((c) => /^[0-9a-f]{24}$/i.test(String(c.productId)))
    api.put('/customer/cart', { cart }, { custAuth: true }).catch(() => {})
  },

  logout() {
    setCustomerToken('')
    set({ token: '', customer: null })
  },
}))
