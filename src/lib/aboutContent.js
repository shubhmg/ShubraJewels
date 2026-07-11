// Defaults + icon choices for the editable "Our Story" (About) page.
// Kept in sync with the `about` block in server setting.model.js.

export const ABOUT_DEFAULTS = {
  eyebrow: 'Rooted in Rajasthan',
  heading: 'Where every jhumka begins',
  image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=85',
  paragraphs: [
    '{brand} was born from a love of the jhumka — the earring that has swung from the ears of queens, dancers, and brides across India for centuries.',
    'We work directly with artisans in Rajasthan who still shape, paint, and finish each pair by hand. From oxidised silver to hand-painted meenakari, no two are exactly alike.',
  ],
  values: [
    { icon: 'HandHeart', title: 'Handcrafted', text: 'Every jhumka is made by hand by Rajasthani artisans.' },
    { icon: 'Sparkles', title: 'A Story Each', text: 'Every design carries a name and a story of its own.' },
    { icon: 'Truck', title: 'Delivered with Care', text: 'Carefully packed and shipped across India.' },
    { icon: 'ShieldCheck', title: 'Quality Promise', text: 'Skin-friendly, long-lasting finish on every pair.' },
  ],
}

// Curated icon names the admin can pick for value cards (must exist in ICON_MAP
// in About.jsx).
export const VALUE_ICON_NAMES = [
  'HandHeart', 'Sparkles', 'Truck', 'ShieldCheck', 'Gem',
  'Award', 'Heart', 'Leaf', 'Crown', 'Star', 'Flower', 'BadgeCheck',
]

// Merge stored about settings over the defaults (so partial/missing data still
// renders a complete page).
export function resolveAbout(about) {
  const a = about || {}
  return {
    eyebrow: a.eyebrow ?? ABOUT_DEFAULTS.eyebrow,
    heading: a.heading ?? ABOUT_DEFAULTS.heading,
    image: a.image || ABOUT_DEFAULTS.image,
    // Fall back to defaults only when the field was never set (undefined). An
    // explicit empty array means "the admin cleared these" — respect it, so
    // removing the last card/paragraph doesn't re-add the defaults.
    paragraphs: Array.isArray(a.paragraphs) ? a.paragraphs : ABOUT_DEFAULTS.paragraphs,
    values: Array.isArray(a.values) ? a.values : ABOUT_DEFAULTS.values,
  }
}
