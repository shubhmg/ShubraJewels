import { ResourceManager } from '../../components/admin/ResourceManager.jsx'

export function AdminBanners() {
  return (
    <ResourceManager
      title="Offer Banners"
      subtitle="Korean earrings free, Delhi free shipping … shown on the homepage."
      endpoint="/banners"
      columns={['image', 'text', 'placement']}
      wideModal
      fields={[
        { key: 'placement', label: 'Placement', type: 'select', default: 'offer',
          options: [{ value: 'offer', label: 'Homepage offer card' }, { value: 'topStrip', label: 'Top strip' }, { value: 'hero', label: 'Hero' }] },
        { key: 'text', label: 'Text', placeholder: 'Korean Earrings FREE' },
        { key: 'hindiText', label: 'Hindi text', placeholder: 'कोरियन इयररिंग्स मुफ़्त' },
        { key: 'subtext', label: 'Subtext', placeholder: 'On orders above ₹1499' },
        { key: 'bgColor', label: 'Background colour', type: 'color', default: '#7B1E2B' },
        { key: 'image', label: 'Image (optional)', type: 'image', full: true },
        { key: 'ctaLabel', label: 'Button label', placeholder: 'Shop Now' },
        { key: 'ctaLink', label: 'Button link', placeholder: '/products' },
        { key: 'order', label: 'Sort order', type: 'number', default: 0 },
        { key: 'isActive', label: 'Active', type: 'toggle', default: true },
      ]}
    />
  )
}
