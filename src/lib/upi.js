import QRCode from 'qrcode'

// Build a UPI deep-link / QR payload. Opening this on a phone launches the UPI
// app chooser (GPay/PhonePe/Paytm) with the amount + note pre-filled.
//   pa = payee VPA · pn = payee name · am = amount · tn = note (order no) · cu = INR
export function buildUpiUri({ vpa, payeeName, amount, note }) {
  const p = new URLSearchParams()
  p.set('pa', vpa)
  if (payeeName) p.set('pn', payeeName)
  if (amount != null) p.set('am', Number(amount).toFixed(2))
  p.set('cu', 'INR')
  if (note) p.set('tn', note)
  // URLSearchParams encodes spaces as '+'; UPI apps prefer %20.
  return `upi://pay?${p.toString().replace(/\+/g, '%20')}`
}

// Render the UPI URI to a PNG data URL for an <img>. Returns '' on failure.
export async function upiQrDataUrl(uri) {
  try {
    return await QRCode.toDataURL(uri, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
  } catch {
    return ''
  }
}
