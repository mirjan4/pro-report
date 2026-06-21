const express = require('express');
const router = express.Router();
const DistributionHead = require('../models/DistributionHead');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/distribution-heads
router.get('/', protect, async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};
    if (active === 'true') filter.isActive = true;
    const heads = await DistributionHead.find(filter).sort({ name: 1 });
    res.json({ success: true, data: heads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/distribution-heads (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const head = await DistributionHead.create({ name: name.trim() });
    res.status(201).json({ success: true, data: head });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A distribution head with this name already exists' });
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/distribution-heads/:id (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const existing = await DistributionHead.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Distribution head not found' });

    const oldName = existing.name;
    const newName = name ? name.trim() : existing.name;

    if (name && newName !== oldName) {
      existing.name = newName;
    }
    if (isActive !== undefined) {
      existing.isActive = isActive;
    }

    await existing.save();

    // If renamed, update all distributions using this head name
    if (newName !== oldName) {
      const Distribution = require('../models/Distribution');
      await Distribution.updateMany(
        { "distributions.head": oldName },
        { $set: { "distributions.$[elem].head": newName } },
        { arrayFilters: [{ "elem.head": oldName }] }
      );
    }

    res.json({ success: true, data: existing });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A distribution head with this name already exists' });
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/distribution-heads/:id/toggle (admin only)
router.patch('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const head = await DistributionHead.findById(req.params.id);
    if (!head) return res.status(404).json({ success: false, message: 'Distribution head not found' });

    head.isActive = !head.isActive;
    await head.save();
    res.json({ success: true, data: head });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/distribution-heads/:id (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const head = await DistributionHead.findById(req.params.id);
    if (!head) return res.status(404).json({ success: false, message: 'Distribution head not found' });

    const Distribution = require('../models/Distribution');
    // Block deletion if any distribution has a non-zero allocation for this head
    const count = await Distribution.countDocuments({
      distributions: { $elemMatch: { head: head.name, amount: { $gt: 0 } } }
    });
    if (count > 0) return res.status(400).json({ success: false, message: `Cannot delete: ${count} monthly distribution record(s) have allocations for this head` });

    await DistributionHead.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Distribution head deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
