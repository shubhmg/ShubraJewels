import { useEffect, useState } from 'react'
import { ResourceManager } from '../../components/admin/ResourceManager.jsx'
import { api } from '../../lib/api.js'

export function AdminGallery() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    api.get('/products?all=1', { auth: true }).then(setProducts)
  }, [])

  return (
    <ResourceManager
      title="Customer Gallery"
      subtitle="Real customers wearing the jhumkas — also your quiet Instagram wall."
      endpoint="/gallery"
      columns={['image', 'customerName', 'caption']}
      fields={[
        { key: 'image', label: 'Photo', type: 'image', required: true, full: true },
        { key: 'customerName', label: 'Customer name', placeholder: 'Priya' },
        { key: 'caption', label: 'Caption', placeholder: 'Rani Jhumka on her big day' },
        {
          key: 'productId',
          label: 'Linked product',
          type: 'select',
          options: [{ value: '', label: 'No product link' }, ...products.map((p) => ({ value: p._id, label: p.name }))],
          full: true,
        },
        { key: 'link', label: 'Instagram post URL', placeholder: 'https://www.instagram.com/p/…', full: true },
        { key: 'order', label: 'Sort order', type: 'number', default: 0 },
        { key: 'isActive', label: 'Active', type: 'toggle', default: true },
      ]}
    />
  )
}
