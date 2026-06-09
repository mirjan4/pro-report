const express = require('express');
const router = express.Router();
const Pro = require('../models/Pro');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/pros — filter by module and/or status
router.get('/', protect, async (req, res) => {
  try {
    const { status, search, module, page = 1, limit = 200 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (module) filter.module = module;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { area: { $regex: search, $options: 'i' } }
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

      try {
        const newPro = await Pro.create({
          name: p.name,
          designation: p.designation || 'PRO Officer',
          area: p.area,
          mobile: p.mobile || '',
          email: p.email || '',
          status: p.status || 'active',
          notes: p.notes || '',
          module: p.module,
          createdBy: req.user._id
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
    const pro = await Pro.create({ ...req.body, createdBy: req.user._id });
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
    const pro = await Pro.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
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
    // Delete all collection records associated with these PROs
    await Collection.deleteMany({ pro: { $in: ids } });

    // Delete the PROs
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
    // Delete all collection records associated with this PRO
    await Collection.deleteMany({ pro: req.params.id });

    // Delete the PRO
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
