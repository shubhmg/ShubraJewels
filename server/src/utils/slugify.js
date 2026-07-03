// Simple slug generator: lowercases, strips non-alphanumerics, collapses to hyphens.
export default function slugify(str = '') {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
