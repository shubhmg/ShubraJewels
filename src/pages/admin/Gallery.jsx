import { ResourceManager } from '../../components/admin/ResourceManager.jsx'

export function AdminGallery() {
  return (
    <ResourceManager
      title="Customer Gallery"
      subtitle="Real customers wearing the jhumkas — shown in the #ShubraGirls wall."
      endpoint="/gallery"
      columns={['image', 'customerName', 'caption']}
      fields={[
        { key: 'image', label: 'Photo', type: 'image', required: true, full: true },
        { key: 'customerName', label: 'Customer name', placeholder: 'Priya' },
        { key: 'caption', label: 'Caption', placeholder: 'Rani Jhumka on her big day' },
        { key: 'order', label: 'Sort order', type: 'number', default: 0 },
        { key: 'isActive', label: 'Active', type: 'toggle', default: true },
      ]}
    />
  )
}
