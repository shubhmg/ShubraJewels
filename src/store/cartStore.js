import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useCartStore = create(persist(
  (set) => ({
    items: [],
    isOpen: false,

    openCart:  () => set({ isOpen: true }),
    closeCart: () => set({ isOpen: false }),
    toggleCart:() => set(s => ({ isOpen: !s.isOpen })),

    addItem: (product, size, qty = 1) => set(s => {
      const key = `${product.id}-${size}`
      const existing = s.items.find(i => i.key === key)
      if (existing) {
        return { items: s.items.map(i => i.key === key ? { ...i, qty: i.qty + qty } : i) }
      }
      return { items: [...s.items, { ...product, key, size, qty }] }
    }),

    removeItem: (key) => set(s => ({ items: s.items.filter(i => i.key !== key) })),

    updateQty: (key, qty) => set(s => ({
      items: qty < 1
        ? s.items.filter(i => i.key !== key)
        : s.items.map(i => i.key === key ? { ...i, qty } : i)
    })),

    clearCart: () => set({ items: [] }),
  }),
  {
    name: 'sj-cart',
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ items: s.items }),
  }
))

// Totals as plain selectors (components can also compute inline).
export const cartCount = (items) => items.reduce((a, i) => a + i.qty, 0)
export const cartTotal = (items) => items.reduce((a, i) => a + i.price * i.qty, 0)
