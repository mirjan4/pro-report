const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const { protect } = require('../middleware/auth');

async function getDynamicFinancialYears() {
  const collections = await Collection.find({}, 'date').lean();
  const years = new Set();
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  years.add(currentStartYear);

  for (const col of collections) {
    if (col.date) {
      const d = new Date(col.date);
      const y = d.getFullYear();
      const m = d.getMonth();
      const startYear = m >= 3 ? y : y - 1;
      years.add(startYear);
    }
  }

  const sortedYears = Array.from(years).sort((a, b) => b - a);
  
  return sortedYears.map(startYear => {
    const endYear = startYear + 1;
    const yearStr = `${startYear}-${String(endYear).substring(2)}`;
    return {
      _id: startYear.toString(),
      year: yearStr,
      label: `FY ${yearStr}`,
      startYear,
      endYear,
      isActive: startYear === currentStartYear,
      isArchived: false,
      description: `Auto-generated period for ${yearStr}`
    };
  });
}

// GET /api/financial-years
router.get('/', protect, async (req, res) => {
  try {
    const years = await getDynamicFinancialYears();
    res.json({ success: true, data: years });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/financial-years/active
router.get('/active', protect, async (req, res) => {
  try {
    const years = await getDynamicFinancialYears();
    const active = years.find(y => y.isActive);
    res.json({ success: true, data: active });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
