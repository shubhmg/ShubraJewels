import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(persist(
  (set, get) => ({
    dark: false,
    toggle: () => {
      const next = !get().dark
      set({ dark: next })
      document.documentElement.classList.toggle('dark', next)
    },
    init: () => {
      const { dark } = get()
      document.documentElement.classList.toggle('dark', dark)
    },
  }),
  { name: 'sj-theme' }
))
