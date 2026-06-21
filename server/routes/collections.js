const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Pro = require('../models/Pro');
const Module = require('../models/Module');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/collections
router.get('/', protect, async (req, res) => {
  try {
    const { financialYear, month, year, pro, module, page = 1, limit = 200 } = req.query;
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
    if (pro) filter.pro = pro;
    if (module) filter.module = module;
    
    const total = await Collection.countDocuments(filter);
    const collections = await Collection.find(filter)
      .populate('pro', 'name area status')
      .populate('module', 'name code color icon')
      .sort({ date: 1, proName: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // Attach mock financialYear object to each collection for frontend compatibility
    const formattedCollections = collections.map(c => {
      if (c.date) {
        const d = new Date(c.date);
        const m = d.getMonth();
        const startYear = m >= 3 ? d.getFullYear() : d.getFullYear() - 1;
        const endYear = startYear + 1;
        c.financialYear = {
          _id: startYear.toString(),
          year: `${startYear}-${String(endYear).substring(2)}`,
          label: `FY ${startYear}-${String(endYear).substring(2)}`,
          startYear,
          endYear
        };
      }
      return c;
    });

    res.json({ success: true, data: formattedCollections, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/collections — single entry
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { module, month, year, pro, amount, additionalCollections, additionalAmount, additionalHead, notes } = req.body;
    const [mod, proDoc] = await Promise.all([
      Module.findById(module),
      Pro.findById(pro)
    ]);
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });
    if (!proDoc) return res.status(404).json({ success: false, message: 'PRO not found' });

    // Check for duplicate monthly record (One month = One record per PRO)
    const existing = await Collection.findOne({ module, pro, month, year: Number(year) });
    if (existing) {
      return res.status(400).json({ success: false, message: `A collection record already exists for this PRO for ${month} ${year}.` });
    }

    let collectionsList = additionalCollections;
    if (!collectionsList || !Array.isArray(collectionsList)) {
      if (additionalHead && (Number(additionalAmount) || 0) > 0) {
        collectionsList = [{ head: additionalHead, amount: Number(additionalAmount) || 0 }];
      } else {
        collectionsList = [];
      }
    }

    const collection = await Collection.create({
      module,
      month,
      year: Number(year),
      pro,
      proName: proDoc.name,
      amount: Number(amount) || 0,
      additionalCollections: collectionsList,
      notes,
      enteredBy: req.user._id
    });
    res.status(201).json({ success: true, data: collection });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/collections/:id — update entry
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { amount, additionalCollections, additionalAmount, additionalHead, notes, month, year } = req.body;
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ success: false, message: 'Collection not found' });
    
    // Check if month or year are changing, and make sure we don't create a duplicate
    const newMonth = month || collection.month;
    const newYear = year ? Number(year) : collection.year;
    
    if (newMonth !== collection.month || newYear !== collection.year) {
      const existing = await Collection.findOne({
        _id: { $ne: collection._id },
        module: collection.module,
        pro: collection.pro,
        month: newMonth,
        year: newYear
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `A collection record already exists for this PRO for ${newMonth} ${newYear}.` });
      }
      collection.month = newMonth;
      collection.year = newYear;
    }
    
    if (amount !== undefined) collection.amount = Number(amount) || 0;
    
    if (additionalCollections !== undefined && Array.isArray(additionalCollections)) {
      collection.additionalCollections = additionalCollections;
    } else if (additionalAmount !== undefined) {
      const addAmt = Number(additionalAmount) || 0;
      if (addAmt > 0) {
        const head = additionalHead !== undefined ? additionalHead : (collection.additionalHead || 'Other');
        collection.additionalCollections = [{ head, amount: addAmt }];
      } else {
        collection.additionalCollections = [];
      }
    } else if (additionalHead !== undefined) {
      if (collection.additionalAmount > 0) {
        collection.additionalCollections = [{ head: additionalHead, amount: collection.additionalAmount }];
      }
    }
    
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
        const proDoc = await Pro.findById(entry.pro);
        if (!proDoc) throw new Error(`PRO not found for ID: ${entry.pro}`);

        const filter = {
          module: entry.module || moduleId,
          pro: entry.pro,
          month: entry.month,
          year: Number(entry.year)
        };
        
        const existing = await Collection.findOne(filter);
        if (existing && skipDuplicates) {
          results.skipped++;
          continue;
        }
        
        let collectionsList = entry.additionalCollections;
        if (!collectionsList || !Array.isArray(collectionsList)) {
          if (entry.additionalHead && (Number(entry.additionalAmount) || 0) > 0) {
            collectionsList = [{ head: entry.additionalHead, amount: Number(entry.additionalAmount) || 0 }];
          } else if ((Number(entry.additionalAmount) || 0) > 0) {
            collectionsList = [{ head: 'Other', amount: Number(entry.additionalAmount) || 0 }];
          } else {
            collectionsList = [];
          }
        }

        const update = {
          proName: proDoc.name,
          amount: Number(entry.amount) || 0,
          additionalCollections: collectionsList,
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
