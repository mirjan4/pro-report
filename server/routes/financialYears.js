const express = require('express');
const router = express.Router();
const FinancialYear = require('../models/FinancialYear');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const { includeArchived } = req.query;
    const filter = includeArchived === 'true' ? {} : { isArchived: false };
    const years = await FinancialYear.find(filter).sort({ startYear: -1 });
    res.json({ success: true, data: years });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/active', protect, async (req, res) => {
  try {
    const year = await FinancialYear.findOne({ isActive: true });
    res.json({ success: true, data: year });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { year, startYear, endYear, description } = req.body;
    const fy = await FinancialYear.create({ year, startYear, endYear, description, createdBy: req.user._id });
    res.status(201).json({ success: true, data: fy });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Financial year already exists' });
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const fy = await FinancialYear.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!fy) return res.status(404).json({ success: false, message: 'Financial year not found' });
    res.json({ success: true, data: fy });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.patch('/:id/activate', protect, adminOnly, async (req, res) => {
  try {
    await FinancialYear.updateMany({}, { isActive: false });
    const fy = await FinancialYear.findByIdAndUpdate(req.params.id, { isActive: true, isArchived: false }, { new: true });
    if (!fy) return res.status(404).json({ success: false, message: 'Financial year not found' });
    res.json({ success: true, data: fy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/archive', protect, adminOnly, async (req, res) => {
  try {
    const fy = await FinancialYear.findByIdAndUpdate(req.params.id, { isArchived: true, isActive: false }, { new: true });
    if (!fy) return res.status(404).json({ success: false, message: 'Financial year not found' });
    res.json({ success: true, data: fy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await FinancialYear.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
