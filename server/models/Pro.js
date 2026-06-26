const mongoose = require('mongoose');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const proSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  designation:     { type: String, trim: true, default: 'PRO Officer' },
  area:            { type: String, trim: true },
  mobile:          { type: String, trim: true },
  email:           { type: String, trim: true, lowercase: true },
  status:          { type: String, enum: ['active', 'inactive'], default: 'active' },
  joinedDate:      { type: Date, default: Date.now },

  // ── Joining Month Validation ──
  joiningMonth:    { type: String, enum: [...MONTHS, null], default: null },
  joiningYear:     { type: Number, default: null },

  notes:           { type: String },
  module:          { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

proSchema.index({ name: 'text', area: 'text' });
proSchema.index({ module: 1, status: 1 });

module.exports = mongoose.model('Pro', proSchema);
