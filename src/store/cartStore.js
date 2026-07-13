import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Available-stock ceiling for a cart line. stockQty ≤ 0 (or missing) means the
// product doesn't track a finite count, so no client cap — the server still
// validates every order against live stock via resolveItems().
const clampCap = (stockQty) => (stockQty > 0 ? stockQty : Infinity)

export const useCartStore = create(persist(
  (set) => ({
    items: [],
    isOpen: false,

    openCart:  () => set({ isOpen: true }),
    closeCart: () => set({ isOpen: false }),
    toggleCart:() => set(s => ({ isOpen: !s.isOpen })),

    addItem: (product, size, qty = 1) => set(s => {
      const key = `${product.id}-${size}`
      const cap = clampCap(product.stockQty)
      const existing = s.items.find(i => i.key === key)
      if (existing) {
        // Re-adding: refresh the stock snapshot and clamp the combined qty.
        return { items: s.items.map(i => i.key === key
          ? { ...i, stockQty: product.stockQty, qty: Math.min(i.qty + qty, cap) }
          : i) }
      }
      return { items: [...s.items, { ...product, key, size, qty: Math.min(qty, cap) }] }
    }),

    removeItem: (key) => set(s => ({ items: s.items.filter(i => i.key !== key) })),

    updateQty: (key, qty) => set(s => ({
      items: qty < 1
        ? s.items.filter(i => i.key !== key)
        : s.items.map(i => i.key === key ? { ...i, qty: Math.min(qty, clampCap(i.stockQty)) } : i)
    })),

    // Reconcile the bag against a server availability report:
    // issues = [{ productId, available, ... }]. Sold-out lines (available ≤ 0)
    // are dropped; short lines are clamped to what's left. Returns nothing.
    applyAvailability: (issues) => set(s => {
      const byId = new Map((issues || []).map(i => [String(i.productId), i]))
      const items = s.items.flatMap(it => {
        const iss = byId.get(String(it.id ?? it._id))
        if (!iss) return [it]
        if (!(iss.available > 0)) return []
        return [{ ...it, stockQty: iss.available, qty: Math.min(it.qty, iss.available) }]
      })
      return { items }
    }),

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
