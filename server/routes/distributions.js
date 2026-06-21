const express = require('express');
const router = express.Router();
const Distribution = require('../models/Distribution');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/distributions
router.get('/', protect, async (req, res) => {
  try {
    const { month, year, financialYear } = req.query;
    const filter = {};
    
    if (financialYear && financialYear !== 'all') {
      const startYear = parseInt(financialYear);
      const endYear = startYear + 1;
      const start = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)); // April 1
      const end = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)); // March 31
      filter.date = { $gte: start, $lte: end };
    }
    
    if (month) filter.month = month;
    if (year) filter.year = Number(year);
    
    if (month && year) {
      // Find single monthly record
      const doc = await Distribution.findOne({ month, year: Number(year) }).lean();
      return res.json({ success: true, data: doc });
    }
    
    const docs = await Distribution.find(filter).sort({ date: 1 }).lean();
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/distributions (admin only) - Create or Update allocations
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { month, year, distributions } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and Year are required' });
    }
    if (!distributions || !Array.isArray(distributions)) {
      return res.status(400).json({ success: false, message: 'distributions array is required' });
    }

    // Clean distributions list (ensure numbers are parsed and head is present)
    const cleanedDistributions = distributions
      .map(d => ({ head: d.head, amount: Number(d.amount) || 0 }))
      .filter(d => d.head && d.amount >= 0);

    let doc = await Distribution.findOne({ month, year: Number(year) });
    if (doc) {
      doc.distributions = cleanedDistributions;
      doc.enteredBy = req.user._id;
      await doc.save();
    } else {
      doc = await Distribution.create({
        month,
        year: Number(year),
        distributions: cleanedDistributions,
        enteredBy: req.user._id
      });
    }

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
