const mongoose = require('mongoose');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];
const MONTHS_CALENDAR_MAP = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const collectionSchema = new mongoose.Schema({
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  month: { type: String, required: true },
  monthIndex: { type: Number },
  year: { type: Number, required: true },
  financialYearLabel: { type: String },
  date: { type: Date },
  pro: { type: mongoose.Schema.Types.ObjectId, ref: 'Pro', required: true },
  proName: { type: String },
  amount: { type: Number, default: 0, min: 0 },
  additionalAmount: { type: Number, default: 0, min: 0 },
  additionalHead: { type: String },
  additionalCollections: [{
    head: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 }
  }],
  totalAmount: { type: Number, default: 0 },
  notes: { type: String },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

collectionSchema.pre('save', function(next) {
  if (this.additionalCollections && this.additionalCollections.length > 0) {
    this.additionalAmount = this.additionalCollections.reduce((sum, item) => sum + (item.amount || 0), 0);
    this.additionalHead = this.additionalCollections.map(c => c.head).join(', ');
  } else {
    this.additionalAmount = 0;
    this.additionalHead = undefined;
  }
  
  this.totalAmount = (this.amount || 0) + (this.additionalAmount || 0);
  
  if (this.month && this.year) {
    const mIdx = MONTHS.indexOf(this.month);
    this.monthIndex = mIdx;
    
    // Automatically calculate financial year label
    let startYear;
    if (mIdx >= 0 && mIdx <= 8) { // April to December
      startYear = this.year;
    } else { // January to March
      startYear = this.year - 1;
    }
    const endYear = startYear + 1;
    this.financialYearLabel = `FY ${startYear}-${String(endYear).substring(2)}`;
    
    // Calculate a UTC date representing the first of the month for querying ranges
    const calendarMonthIdx = MONTHS_CALENDAR_MAP.indexOf(this.month);
    this.date = new Date(Date.UTC(this.year, calendarMonthIdx, 1));
  } else if (this.date) {
    // Fallback for date-only imports
    const d = new Date(this.date);
    const mName = MONTHS_CALENDAR_MAP[d.getMonth()];
    this.month = mName;
    this.monthIndex = MONTHS.indexOf(mName);
    this.year = d.getFullYear();
    
    const y = d.getFullYear();
    const m = d.getMonth();
    const startYear = m >= 3 ? y : y - 1;
    const endYear = startYear + 1;
    this.financialYearLabel = `FY ${startYear}-${String(endYear).substring(2)}`;
  }
  
  next();
});

// Search indexes
collectionSchema.index({ module: 1, year: 1, month: 1, pro: 1 });
collectionSchema.index({ module: 1, pro: 1, month: 1, year: 1 });
collectionSchema.index({ module: 1, date: 1, pro: 1 });
collectionSchema.index({ module: 1, pro: 1 });
collectionSchema.index({ date: 1 });
collectionSchema.index({ pro: 1 });

module.exports = mongoose.model('Collection', collectionSchema);
