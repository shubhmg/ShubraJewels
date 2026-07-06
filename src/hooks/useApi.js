import { useEffect, useState, useCallback } from 'react'
import { api, normalizeProduct } from '../lib/api.js'

// Module-level cache. On back-navigation a page re-renders instantly at full
// height from cache (then revalidates in the background) — without this the
// page mounts empty/short and browser scroll-restoration lands on the footer.
const _cache = new Map()

/**
 * Generic GET hook. Returns { data, loading, error, refresh }.
 * `path` may change; pass a stable string.
 */
export function useFetch(path, { transform } = {}) {
  const [data, setData] = useState(() => (path && _cache.has(path) ? _cache.get(path) : null))
  const [loading, setLoading] = useState(() => !(path && _cache.has(path)))
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!_cache.has(path)) setLoading(true) // only show a loader when nothing is cached yet
    try {
      const res = await api.get(path)
      const val = transform ? transform(res) : res
      _cache.set(path, val)
      setData(val)
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
