const mongoose = require('mongoose');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const collectionSchema = new mongoose.Schema({
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  financialYear: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialYear', required: true },
  financialYearLabel: { type: String },
  month: { type: String, required: true, enum: MONTHS },
  monthIndex: { type: Number },
  pro: { type: mongoose.Schema.Types.ObjectId, ref: 'Pro', required: true },
  proName: { type: String },
  amount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, default: 0 },
  notes: { type: String },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

collectionSchema.pre('save', function(next) {
  this.totalAmount = this.amount || 0;
  this.monthIndex = MONTHS.indexOf(this.month);
  next();
});

// Unique per module+year+month+pro combination
collectionSchema.index({ module: 1, financialYear: 1, month: 1, pro: 1 }, { unique: true });
collectionSchema.index({ module: 1, financialYear: 1 });
collectionSchema.index({ module: 1, pro: 1 });
collectionSchema.index({ financialYear: 1 });
collectionSchema.index({ pro: 1 });

module.exports = mongoose.model('Collection', collectionSchema);
