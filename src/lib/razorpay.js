// Loads the Razorpay Standard Checkout script once.
let promise = null
export function loadRazorpay() {
  if (promise) return promise
  promise = new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
  return promise
}
