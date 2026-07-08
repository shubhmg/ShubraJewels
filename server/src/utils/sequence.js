import mongoose from 'mongoose';

// A tiny atomic counter — survives order deletion so numbers never repeat or
// collide (countDocuments()+1 raced and reused numbers after Delete-all).
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// Atomically increment and return the next value for a named sequence.
export async function nextSeq(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

// Order number: SJ-<year>-<5-digit atomic sequence>. Unique by construction.
export async function nextOrderNo() {
  const seq = await nextSeq('orderNo');
  return `SJ-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
}

export default Counter;
