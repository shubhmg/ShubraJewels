import mongoose from 'mongoose';

// Homepage + gallery videos. `isHero` marks the first full-bleed homepage video.
const videoSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    caption: { type: String, default: '' },
    src: { type: String, default: '' },       // uploaded file URL or external link
    poster: { type: String, default: '' },     // thumbnail image
    isHero: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Video = mongoose.model('Video', videoSchema);
export default Video;
