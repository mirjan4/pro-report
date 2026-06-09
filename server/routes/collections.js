const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Pro = require('../models/Pro');
const FinancialYear = require('../models/FinancialYear');
const Module = require('../models/Module');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/collections
router.get('/', protect, async (req, res) => {
  try {
    const { financialYear, month, pro, module, page = 1, limit = 200 } = req.query;
    const filter = {};
    if (financialYear) filter.financialYear = financialYear;
    if (month) filter.month = month;
    if (pro) filter.pro = pro;
    if (module) filter.module = module;
    const total = await Collection.countDocuments(filter);
    const collections = await Collection.find(filter)
      .populate('pro', 'name area status')
      .populate('financialYear', 'year label')
      .populate('module', 'name code color icon')
      .sort({ monthIndex: 1, proName: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, data: collections, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/collections — single entry
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { module, financialYear, month, pro, amount, notes } = req.body;
    const [mod, fy, proDoc] = await Promise.all([
      Module.findById(module),
      FinancialYear.findById(financialYear),
      Pro.findById(pro)
    ]);
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });
    if (!fy) return res.status(404).json({ success: false, message: 'Financial year not found' });
    if (!proDoc) return res.status(404).json({ success: false, message: 'PRO not found' });

    const collection = await Collection.create({
      module, financialYear, financialYearLabel: fy.label,
      month, pro, proName: proDoc.name,
      amount: Number(amount) || 0,
      notes, enteredBy: req.user._id
    });
    res.status(201).json({ success: true, data: collection });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'Entry already exists for this PRO/month/year/module combination' });
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/collections/:id — update entry
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { amount, notes } = req.body;
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ success: false, message: 'Collection not found' });
    collection.amount = Number(amount) || 0;
    if (notes !== undefined) collection.notes = notes;
    await collection.save();
    res.json({ success: true, data: collection });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/collections/bulk — bulk delete collections (admin only)
router.delete('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of collection IDs' });
    }
    const result = await Collection.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `Successfully deleted ${result.deletedCount} collection entry/entries.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/collections/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Collection.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/collections/bulk — bulk import
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { entries, moduleId, skipDuplicates = true } = req.body;
    const results = { inserted: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

    for (const entry of entries) {
      try {
        const [fy, proDoc] = await Promise.all([
          FinancialYear.findById(entry.financialYear),
          Pro.findById(entry.pro)
        ]);
        const filter = {
          module: entry.module || moduleId,
          financialYear: entry.financialYear,
          month: entry.month,
          pro: entry.pro
        };
        const existing = await Collection.findOne(filter);
        if (existing && skipDuplicates) {
          results.skipped++;
          continue;
        }
        const update = {
          financialYearLabel: fy?.label,
          proName: proDoc?.name,
          amount: Number(entry.amount) || 0,
          notes: entry.notes || '',
          enteredBy: req.user._id
        };
        if (existing) {
          Object.assign(existing, update);
          await existing.save();
          results.updated++;
        } else {
          await Collection.create({ ...filter, ...update });
          results.inserted++;
        }
      } catch (e) {
        results.failed++;
        results.errors.push({ entry, error: e.message });
      }
    }
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
