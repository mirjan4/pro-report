const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Pro = require('../models/Pro');
const Module = require('../models/Module');
const { protect, adminOnly } = require('../middleware/auth');

const CALENDAR_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Helper: returns true if entry month/year is >= PRO joining month/year ──
function isEntryEligible(month, year, proDoc) {
  if (!proDoc.joiningMonth || !proDoc.joiningYear) return true; // No joining date set → allow all
  const entryDate   = new Date(Date.UTC(Number(year),             CALENDAR_MONTHS.indexOf(month),              1));
  const joiningDate = new Date(Date.UTC(Number(proDoc.joiningYear), CALENDAR_MONTHS.indexOf(proDoc.joiningMonth), 1));
  return entryDate >= joiningDate;
}

// GET /api/collections
router.get('/', protect, async (req, res) => {
  try {
    const { financialYear, month, year, pro, module, page = 1, limit = 2000 } = req.query;
    const filter = {};

    // ── FY date range filter ──
    let fyDateRange = null;
    if (financialYear && financialYear !== 'all') {
      const startYear = parseInt(financialYear);
      const endYear = startYear + 1;
      const start = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0));   // April 1
      const end   = new Date(Date.UTC(endYear,   2, 31, 23, 59, 59, 999)); // March 31
      filter.date = { $gte: start, $lte: end };
      fyDateRange = { start: start.toISOString(), end: end.toISOString() };
    }

    if (month)  filter.month  = month;
    if (year)   filter.year   = Number(year);
    if (pro)    filter.pro    = pro;
    if (module) filter.module = module;

    // ── DEBUG LOGGING (dev mode) ──
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n[GET /api/collections] ─────────────────────────');
      console.log('  Query params  :', { financialYear, month, year, pro, module, page, limit });
      console.log('  MongoDB filter:', JSON.stringify(filter, null, 2));
      if (fyDateRange) console.log('  FY date range :', fyDateRange);
    }

    const total = await Collection.countDocuments(filter);
    const collections = await Collection.find(filter)
      .populate('pro', 'name area status')
      .populate('module', 'name code color icon')
      .sort({ date: 1, proName: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    // ── DEBUG LOGGING (dev mode) ──
    if (process.env.NODE_ENV !== 'production') {
      console.log(`  Total matching docs in DB : ${total}`);
      console.log(`  Docs returned (after limit): ${collections.length}`);
      if (collections.length > 0) {
        const sample = collections[0];
        console.log('  Sample doc    :', { month: sample.month, year: sample.year, date: sample.date, financialYearLabel: sample.financialYearLabel });
      }
      console.log('────────────────────────────────────────────────\n');
    }

    // Attach mock financialYear object to each collection for frontend compatibility
    const isAdmin = req.user?.role === 'admin';
    const formattedCollections = collections.map(c => {
      if (!isAdmin) {
        c.expense = 0;
      }
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
    console.error('[GET /api/collections] ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/collections — single entry
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { module, month, year, pro, amount, additionalCollections, additionalAmount, additionalHead, notes, expense } = req.body;
    const [mod, proDoc] = await Promise.all([
      Module.findById(module),
      Pro.findById(pro)
    ]);
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });
    if (!proDoc) return res.status(404).json({ success: false, message: 'PRO not found' });

    // ── Joining Month Validation ──
    if (!isEntryEligible(month, year, proDoc)) {
      return res.status(400).json({
        success: false,
        message: `This PRO joined in ${proDoc.joiningMonth} ${proDoc.joiningYear}. Entries cannot be created for earlier months.`
      });
    }

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
      expense: Number(expense) || 0,
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
    const { amount, additionalCollections, additionalAmount, additionalHead, notes, month, year, expense } = req.body;
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
    if (expense !== undefined) collection.expense = Number(expense) || 0;
    
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

        // ── Joining Month Validation ──
        if (!isEntryEligible(entry.month, entry.year, proDoc)) {
          results.failed++;
          results.errors.push({
            entry,
            error: `${proDoc.name} joined in ${proDoc.joiningMonth} ${proDoc.joiningYear}. Entry for ${entry.month} ${entry.year} is not allowed.`
          });
          continue;
        }

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
          expense: Number(entry.expense) || 0,
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
