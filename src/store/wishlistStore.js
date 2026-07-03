import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useWishlistStore = create(persist(
  (set, get) => ({
    items: [],
    toggle: (product) => set(s => {
      const has = s.items.some(i => i.id === product.id)
      return { items: has ? s.items.filter(i => i.id !== product.id) : [...s.items, product] }
    }),
    has: (id) => get().items.some(i => i.id === id),
  }),
  { name: 'sj-wishlist' }
))
