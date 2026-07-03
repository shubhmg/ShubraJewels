import { ResourceManager } from '../../components/admin/ResourceManager.jsx'

export function AdminVideos() {
  return (
    <ResourceManager
      title="Videos"
      subtitle="The hero video plays first on the homepage. Others appear in the video section."
      endpoint="/videos"
      columns={['poster', 'title', 'caption']}
      wideModal
      fields={[
        { key: 'title', label: 'Title', placeholder: 'हर झुमका एक कहानी' },
        { key: 'caption', label: 'Caption', placeholder: 'The making of a jhumka' },
        { key: 'src', label: 'Video file', type: 'video', full: true },
        { key: 'poster', label: 'Poster / thumbnail image', type: 'image', full: true },
        { key: 'isHero', label: 'Hero video (plays first on homepage)', type: 'toggle', default: false },
        { key: 'order', label: 'Sort order', type: 'number', default: 0 },
        { key: 'isActive', label: 'Active', type: 'toggle', default: true },
      ]}
    />
  )
}
