const express = require('express');
const router = express.Router();
const Pro = require('../models/Pro');
const { protect, adminOnly } = require('../middleware/auth');

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];
const CALENDAR_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Helper: get calendar year for a fiscal month within a given FY ──
function getMonthCalendarYear(month, fyStartYear) {
  const idx = MONTHS.indexOf(month);
  return (idx >= 0 && idx <= 8) ? fyStartYear : fyStartYear + 1; // April-Dec → startYear, Jan-Mar → startYear+1
}

// ── Helper: check if a month+year combination is >= joining month+year ──
function isMonthEligible(month, calYear, joiningMonth, joiningYear) {
  if (!joiningMonth || !joiningYear) return true;
  const entryDate   = new Date(Date.UTC(calYear,    CALENDAR_MONTHS.indexOf(month),        1));
  const joiningDate = new Date(Date.UTC(joiningYear, CALENDAR_MONTHS.indexOf(joiningMonth), 1));
  return entryDate >= joiningDate;
}

// GET /api/pros — filter by module and/or status
router.get('/', protect, async (req, res) => {
  try {
    const { status, search, module, page = 1, limit = 200 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (module) filter.module = module;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { designation: { $regex: search, $options: 'i' } }
    ];
    const total = await Pro.countDocuments(filter);
    const pros = await Pro.find(filter)
      .populate('module', 'name code color icon')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, data: pros, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/pros/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const pro = await Pro.findById(req.params.id).populate('module', 'name code color icon');
    if (!pro) return res.status(404).json({ success: false, message: 'PRO not found' });
    res.json({ success: true, data: pro });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/pros/migrate-joining-dates
// Auto-populate joiningMonth/joiningYear for existing PROs (Option A: from earliest collection)
router.post('/migrate-joining-dates', protect, adminOnly, async (req, res) => {
  try {
    const Collection = require('../models/Collection');
    const pros = await Pro.find({ $or: [{ joiningMonth: null }, { joiningMonth: { $exists: false } }] });

    let updated = 0;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const defaultStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

    for (const pro of pros) {
      // Find earliest collection for this PRO
      const earliest = await Collection.findOne({ pro: pro._id })
        .sort({ date: 1 })
        .select('month year date')
        .lean();

      if (earliest && earliest.month && earliest.year) {
        pro.joiningMonth = earliest.month;
        pro.joiningYear  = earliest.year;
      } else {
        // No collections — default to April of current FY
        pro.joiningMonth = 'April';
        pro.joiningYear  = defaultStartYear;
      }
      await pro.save();
      updated++;
    }

    res.json({ success: true, message: `Migrated ${updated} PRO officers with joining month data.`, updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/pros/bulk — create multiple PROs (admin only)
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { pros } = req.body;
    if (!pros || !Array.isArray(pros) || pros.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of PROs' });
    }

    const createdPros = [];
    const errors = [];

    for (let i = 0; i < pros.length; i++) {
      const p = pros[i];
      if (!p.name) {
        errors.push(`Row ${i + 1}: Name is required`);
        continue;
      }
      if (!p.module) {
        errors.push(`Row ${i + 1} (${p.name}): Module is required`);
        continue;
      }
      if (!p.joiningMonth || !p.joiningYear) {
        errors.push(`Row ${i + 1} (${p.name}): Joining Month and Year are required`);
        continue;
      }
      if (!MONTHS.includes(p.joiningMonth)) {
        errors.push(`Row ${i + 1} (${p.name}): Invalid joining month "${p.joiningMonth}"`);
        continue;
      }

      try {
        const newPro = await Pro.create({
          name:         p.name,
          designation:  p.designation || 'PRO Officer',
          area:         p.area,
          mobile:       p.mobile || '',
          email:        p.email || '',
          status:       p.status || 'active',
          notes:        p.notes || '',
          module:       p.module,
          joiningMonth: p.joiningMonth,
          joiningYear:  Number(p.joiningYear),
          createdBy:    req.user._id
        });
        createdPros.push(newPro);
      } catch (err) {
        if (err.code === 11000) {
          errors.push(`Row ${i + 1} (${p.name}): PRO already exists`);
        } else {
          errors.push(`Row ${i + 1} (${p.name}): ${err.message}`);
        }
      }
    }

    const populated = await Pro.populate(createdPros, { path: 'module', select: 'name code color icon' });

    res.status(201).json({
      success: true,
      data: populated,
      errors: errors.length > 0 ? errors : null,
      message: `Successfully registered ${populated.length} of ${pros.length} officers.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/pros — create PRO (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { joiningMonth, joiningYear } = req.body;

    if (!joiningMonth || !joiningYear) {
      return res.status(400).json({ success: false, message: 'Joining Month and Joining Year are required.' });
    }
    if (!MONTHS.includes(joiningMonth)) {
      return res.status(400).json({ success: false, message: `Invalid joining month: "${joiningMonth}"` });
    }

    const pro = await Pro.create({ ...req.body, joiningYear: Number(joiningYear), createdBy: req.user._id });
    const populated = await Pro.findById(pro._id).populate('module', 'name code color icon');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'PRO already exists' });
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/pros/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.joiningYear) updates.joiningYear = Number(updates.joiningYear);
    if (updates.joiningMonth && !MONTHS.includes(updates.joiningMonth)) {
      return res.status(400).json({ success: false, message: `Invalid joining month: "${updates.joiningMonth}"` });
    }
    const pro = await Pro.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('module', 'name code color icon');
    if (!pro) return res.status(404).json({ success: false, message: 'PRO not found' });
    res.json({ success: true, data: pro });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/pros/bulk — delete multiple PROs (admin only)
router.delete('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of PRO IDs' });
    }

    const Collection = require('../models/Collection');
    await Collection.deleteMany({ pro: { $in: ids } });
    const result = await Pro.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} PRO officer(s) and their associated collections.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/pros/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const Collection = require('../models/Collection');
    await Collection.deleteMany({ pro: req.params.id });
    const pro = await Pro.findByIdAndDelete(req.params.id);
    if (!pro) return res.status(404).json({ success: false, message: 'PRO not found' });
    res.json({ success: true, message: 'PRO deleted and associated collections cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/pros/:id/toggle-status
router.patch('/:id/toggle-status', protect, adminOnly, async (req, res) => {
  try {
    const pro = await Pro.findById(req.params.id);
    if (!pro) return res.status(404).json({ success: false, message: 'PRO not found' });
    pro.status = pro.status === 'active' ? 'inactive' : 'active';
    await pro.save();
    res.json({ success: true, data: pro });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
