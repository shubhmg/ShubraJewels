// Editable site-wide copy (navigation, footer, page headings, buttons).
// Kept in sync with the `content` block in server setting.model.js. Everything
// falls back to these defaults, so the site renders unchanged until edited.

export const CONTENT_DEFAULTS = {
  nav: [
    { label: 'Collections', to: '/collections' },
    { label: 'Jhumkas', to: '/products' },
    { label: 'Our Story', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ],
  footer: {
    companyHeading: 'Company',
    reachHeading: 'Reach Us',
    copyright: '', // empty = "© <year> <brand>. <slogan>"
    links: [
      { label: 'Collections', to: '/collections' },
      { label: 'Our Story', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Wishlist', to: '/wishlist' },
    ],
  },
  home: {
    ctaViewAll: 'View All Jhumkas',
    ctaStory: 'Discover the Story',
    ctaSeeAll: 'See All',
  },
  product: {
    packagingNote: 'Gift-ready packaging',
    addToBag: 'Add to Bag',
    soldOut: 'Sold Out',
  },
  // Legal / policy pages. Body supports "## Heading", "- bullet", and blank-line
  // paragraphs. Placeholders {brand} {email} {phone} {whatsapp} {city} auto-fill
  // from Settings at render time. Fully admin-editable under Settings → Legal Pages.
  policies: {
    privacy: {
      title: 'Privacy Policy',
      body: `We respect your privacy and are committed to protecting the personal information you share with {brand}.

## Information we collect
When you place an order or contact us, we may collect your name, phone number, email address, shipping address and order details. We do not store your card or UPI details — payments are handled securely by our payment partner.

## How we use your information
- To process, pack and deliver your orders
- To share order updates and answer your questions
- To improve our products and the store experience

## Sharing
We share your details only with the partners needed to fulfil your order, such as our courier and payment gateway. We never sell your personal information to anyone.

## Cookies & analytics
Our website may use cookies and basic analytics to understand how visitors use the store so we can improve it.

## Your rights
You may ask us to access, correct or delete the personal information we hold about you at any time by writing to {email}.

## Contact
For any privacy questions, reach us at {email}.`,
    },
    terms: {
      title: 'Terms & Conditions',
      body: `By using {brand} and placing an order, you agree to the terms below.

## Products
We make every effort to display our jhumkas and jewellery as accurately as possible. Slight variation in colour, finish or size may occur, as our pieces are handcrafted and screen colours can differ.

## Pricing & payment
All prices are listed in Indian Rupees (INR) and include applicable taxes unless stated otherwise. We reserve the right to correct pricing errors. Orders are confirmed only after successful payment or verification.

## Orders
We reserve the right to accept or decline any order. If we are unable to fulfil an order, we will inform you and refund any amount paid.

## Intellectual property
All content on this website — images, text and designs — belongs to {brand} and may not be copied or reused without permission.

## Limitation of liability
{brand} is not liable for any indirect or incidental loss arising from the use of our products or website beyond the value of the product purchased.

## Contact
Questions about these terms? Write to {email}.`,
    },
    refund: {
      title: 'Refund & Return Policy',
      body: `We want you to love your jhumkas. If something isn't right, here's how returns and refunds work.

## Returns
You may request a return within 7 days of delivery if the item is damaged, defective or not what you ordered. The item must be unused and in its original packaging.

## How to request a return
Email us at {email} with your order number and a photo of the item, and we'll guide you through the next steps.

## Refunds
Once we receive and inspect the returned item, we'll process your refund to the original payment method within 5–7 business days. Shipping charges are non-refundable unless the return is due to our error.

## Exchanges
We're happy to exchange an item for a different piece of equal value, subject to availability.

## Non-returnable items
For hygiene reasons, earrings can only be returned if they arrive damaged or defective. Sale items may not be eligible for return unless faulty.

## Contact
For any return or refund help, reach us at {email}.`,
    },
    shipping: {
      title: 'Shipping Policy',
      body: `Here's how we pack and deliver your order.

## Where we ship
We deliver across India. Free shipping is available in {city}.

## Processing time
Orders are packed and dispatched within 1–3 business days. You'll receive tracking details once your order ships.

## Delivery time
Most orders arrive within 4–8 business days depending on your location. Remote areas may take a little longer.

## Shipping charges
Shipping charges, if any, are shown at checkout before you pay. Free-shipping offers are applied automatically when your order qualifies.

## Delays
Occasionally deliveries may be delayed due to weather, festivals or courier issues. We'll always help you track your parcel — just reach out.

## Contact
Questions about your delivery? Email us at {email}.`,
    },
  },
  pages: {
    about: { eyebrow: 'Our Story' },
    products: {
      eyebrow: 'Browse the collection',
      titleAll: 'All Jhumkas', hindiAll: 'सभी झुमके',
      titleUnder599: 'Under ₹599', hindiUnder599: '₹599 से कम',
    },
    collections: {
      hindi: 'राजसी संग्रह', heading: 'The Royal Collections',
      naEyebrow: 'Just In', naHindi: 'नए झुमके', naTitle: 'New Arrivals',
    },
    contact: {
      eyebrow: 'Get in touch', hindi: 'हमसे जुड़ें', heading: "We'd Love to Hear From You",
      waHeading: 'Message us on WhatsApp', waSubtext: 'The fastest way to order or ask a question.',
    },
  },
}

// Merge stored content over the defaults so partial/missing data still renders.
export function resolveContent(content) {
  const c = content || {}
  const p = c.pages || {}
  const merge = (key) => ({ ...CONTENT_DEFAULTS.pages[key], ...(p[key] || {}) })
  const pol = c.policies || {}
  const mergePolicy = (key) => ({ ...CONTENT_DEFAULTS.policies[key], ...(pol[key] || {}) })
  return {
    policies: {
      privacy: mergePolicy('privacy'),
      terms: mergePolicy('terms'),
      refund: mergePolicy('refund'),
      shipping: mergePolicy('shipping'),
    },
    nav: c.nav?.length ? c.nav : CONTENT_DEFAULTS.nav,
    footer: {
      ...CONTENT_DEFAULTS.footer,
      ...(c.footer || {}),
      links: c.footer?.links?.length ? c.footer.links : CONTENT_DEFAULTS.footer.links,
    },
    home: { ...CONTENT_DEFAULTS.home, ...(c.home || {}) },
    product: { ...CONTENT_DEFAULTS.product, ...(c.product || {}) },
    pages: {
      about: merge('about'),
      products: merge('products'),
      collections: merge('collections'),
      contact: merge('contact'),
    },
  }
}
