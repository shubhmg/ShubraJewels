import { useSettings, whatsappLink } from '../../lib/SettingsProvider.jsx'

// Opens WhatsApp with a pre-filled order message. Hidden if no number is set.
export function WhatsAppButton({ product, message, className = '', label = 'Order on WhatsApp', size = 'md' }) {
  const settings = useSettings()

  const text =
    message ||
    (product
      ? `${settings.whatsappMessage || 'Hello! I would like to order:'} ${product.name}${
          product.hindiName ? ` (${product.hindiName})` : ''
        } — ₹${product.price?.toLocaleString('en-IN')}`
      : settings.whatsappMessage)

  const link = whatsappLink(settings, text)
  if (!link) return null

  const pad = size === 'sm' ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm'

  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={`btn-whatsapp ${pad} ${className}`}>
      <WaIcon />
      {label}
    </a>
  )
}

function WaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.8c2.16 0 4.19.84 5.72 2.37a8.06 8.06 0 0 1 2.37 5.72c0 4.48-3.65 8.12-8.13 8.12a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.06.8.82-2.98-.2-.31a8.05 8.05 0 0 1-1.24-4.32c0-4.48 3.65-8.12 8.13-8.12Zm4.6 10.36c-.25-.13-1.47-.72-1.7-.81-.23-.08-.4-.13-.56.13-.17.25-.65.8-.79.97-.15.17-.29.19-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42l-.48-.01c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.07 0 1.22.9 2.4 1.02 2.56.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  )
}
