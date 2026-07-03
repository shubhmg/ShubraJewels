import { useEffect, useState, useCallback } from 'react'
import { api, normalizeProduct } from '../lib/api.js'

/**
 * Generic GET hook. Returns { data, loading, error, refresh }.
 * `path` may change; pass a stable string.
 */
export function useFetch(path, { transform } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(path)
      setData(transform ? transform(res) : res)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (path) refresh() }, [path, refresh])

  return { data, loading, error, refresh }
}

const asProducts = (arr) => (arr || []).map(normalizeProduct)

export const useProducts = (query = '') =>
  useFetch(`/products${query}`, { transform: asProducts })

export const useProduct = (idOrSlug) =>
  useFetch(idOrSlug ? `/products/${idOrSlug}` : null, { transform: normalizeProduct })

export const useCategories = () => useFetch('/categories')
export const useCollections = () => useFetch('/collections')
export const useBanners = () => useFetch('/banners')
export const useVideos = () => useFetch('/videos')
export const useReviews = () => useFetch('/reviews')
export const useGallery = () => useFetch('/gallery')
