import { ResourceManager } from '../../components/admin/ResourceManager.jsx'

export function AdminReviews() {
  return (
    <ResourceManager
      title="Customer Reviews"
      subtitle="Approved reviews show on the storefront. Featured ones surface first."
      endpoint="/reviews"
      columns={['image', 'name', 'text']}
      wideModal
      fields={[
        { key: 'name', label: 'Customer name', required: true, placeholder: 'Priya Sharma' },
        { key: 'location', label: 'Location', placeholder: 'Delhi' },
        { key: 'rating', label: 'Rating (1–5)', type: 'number', default: 5 },
        { key: 'text', label: 'Review', type: 'textarea', full: true },
        { key: 'image', label: 'Customer photo (optional)', type: 'image', full: true },
        { key: 'isApproved', label: 'Approved (visible on site)', type: 'toggle', default: true },
        { key: 'isFeatured', label: 'Featured', type: 'toggle', default: false },
        { key: 'order', label: 'Sort order', type: 'number', default: 0 },
      ]}
    />
  )
}
