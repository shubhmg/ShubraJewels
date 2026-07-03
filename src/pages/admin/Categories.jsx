import { ResourceManager } from '../../components/admin/ResourceManager.jsx'

export function AdminCategories() {
  return (
    <ResourceManager
      title="Categories"
      subtitle="Oxidised, Meenakari, Bridal, Under ₹599 … shown in the storefront category grid."
      endpoint="/categories"
      columns={['image', 'name', 'hindiName']}
      fields={[
        { key: 'name', label: 'Name', required: true, placeholder: 'Oxidised Jhumka' },
        { key: 'hindiName', label: 'Hindi name', placeholder: 'ऑक्सीडाइज़्ड झुमका' },
        { key: 'image', label: 'Image', type: 'image', full: true },
        { key: 'description', label: 'Description', type: 'textarea', full: true },
        { key: 'order', label: 'Sort order', type: 'number', default: 0 },
        { key: 'isActive', label: 'Active (visible on site)', type: 'toggle', default: true },
      ]}
    />
  )
}
