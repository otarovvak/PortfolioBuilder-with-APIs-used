const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const postSchema = new mongoose.Schema({
  userId: { type: ObjectId, required: true }, // Changed to ObjectId type
  images: [{ type: String, required: true }],
  names: [{ type: String, required: true }],
  descriptions: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);
