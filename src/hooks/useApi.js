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

  const fetchPath = useCallback(async () => {
    try {
      const res = await api.get(path)
      const val = transform ? transform(res) : res
      _cache.set(path, val)
      return { val }
    } catch (e) {
      return { err: e }
    }
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync whenever `path` changes. Cached path → show it instantly (keeps
  // back-nav scroll restore); uncached path → clear stale data + show loader so
  // a filter switch never flashes the previous filter's products. `alive` drops
  // out-of-order responses when filters are switched quickly.
  useEffect(() => {
    if (!path) { setData(null); setLoading(false); return }
    let alive = true
    if (_cache.has(path)) { setData(_cache.get(path)); setLoading(false) }
    else { setData(null); setLoading(true) }
    fetchPath().then(({ val, err }) => {
      if (!alive) return
      if (err) setError(err)
      else { setData(val); setError(null) }
      setLoading(false)
    })
    return () => { alive = false }
  }, [path, fetchPath])

  const refresh = useCallback(async () => {
    const { val, err } = await fetchPath()
    if (err) setError(err)
    else { setData(val); setError(null) }
    setLoading(false)
  }, [fetchPath])

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
