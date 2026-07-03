import { ResourceManager } from '../../components/admin/ResourceManager.jsx'

export function AdminCollections() {
  return (
    <ResourceManager
      title="Royal Collections"
      subtitle="Maharani, Rajputana, Banjara, Chandni, Noor … the signature collections."
      endpoint="/collections"
      columns={['image', 'name', 'tagline']}
      wideModal
      fields={[
        { key: 'name', label: 'Name', required: true, placeholder: 'Maharani' },
        { key: 'hindiName', label: 'Hindi name', placeholder: 'महारानी' },
        { key: 'tagline', label: 'Tagline', placeholder: 'Fit for a queen' },
        { key: 'accentColor', label: 'Accent colour', type: 'color', default: '#7B1E2B' },
        { key: 'image', label: 'Cover image', type: 'image', full: true },
        { key: 'description', label: 'Description', type: 'textarea', full: true },
        { key: 'order', label: 'Sort order', type: 'number', default: 0 },
        { key: 'isActive', label: 'Active', type: 'toggle', default: true },
      ]}
    />
  )
}
