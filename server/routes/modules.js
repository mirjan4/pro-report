const express = require('express');
const router = express.Router();
const Module = require('../models/Module');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/modules — list all modules
router.get('/', protect, async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};
    if (active === 'true') filter.isActive = true;
    const modules = await Module.find(filter).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: modules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/modules/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const mod = await Module.findById(req.params.id);
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });
    res.json({ success: true, data: mod });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/modules — create module (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, code, description, icon, color, sortOrder } = req.body;
    const mod = await Module.create({ name, code, description, icon, color, sortOrder, createdBy: req.user._id });
    res.status(201).json({ success: true, data: mod });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A module with this code already exists' });
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/modules/:id — update module (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, description, icon, color, isActive, sortOrder } = req.body;
    const existing = await Module.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Module not found' });
    
    if (['pro', 'ofc', 'glb'].includes(existing.code)) {
      if (isActive === false || isActive === 'false') {
        return res.status(400).json({ success: false, message: 'Core collection categories cannot be disabled' });
      }
    }

    const mod = await Module.findByIdAndUpdate(
      req.params.id,
      { name, description, icon, color, isActive, sortOrder },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: mod });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/modules/:id/toggle — toggle isActive
router.patch('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const mod = await Module.findById(req.params.id);
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });
    
    if (['pro', 'ofc', 'glb'].includes(mod.code)) {
      return res.status(400).json({ success: false, message: 'Core collection categories cannot be disabled' });
    }

    mod.isActive = !mod.isActive;
    await mod.save();
    res.json({ success: true, data: mod });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/modules/:id — delete module (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const mod = await Module.findById(req.params.id);
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

    if (['pro', 'ofc', 'glb'].includes(mod.code)) {
      return res.status(400).json({ success: false, message: 'Core collection categories cannot be deleted' });
    }

    const Collection = require('../models/Collection');
    const count = await Collection.countDocuments({ module: req.params.id });
    if (count > 0) return res.status(400).json({ success: false, message: `Cannot delete: ${count} collection entries exist for this module` });
    await Module.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Module deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
