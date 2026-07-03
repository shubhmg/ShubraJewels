import mongoose from 'mongoose';

// One document per page view. `sessionId` is a client-generated id (localStorage)
// used to distinguish unique visitors from raw page views.
const visitSchema = new mongoose.Schema(
  {
    path: { type: String, default: '/' },
    sessionId: { type: String, index: true, default: '' },
    referrer: { type: String, default: '' },
    device: { type: String, default: '' }, // mobile | desktop | tablet
    ua: { type: String, default: '' },
    day: { type: String, index: true }, // YYYY-MM-DD for fast grouping
  },
  { timestamps: true }
);

const Visit = mongoose.model('Visit', visitSchema);
export default Visit;
