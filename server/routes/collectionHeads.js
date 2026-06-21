const express = require('express');
const router = express.Router();
const CollectionHead = require('../models/CollectionHead');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/collection-heads — list all collection heads
router.get('/', protect, async (req, res) => {
  try {
    const { active } = req.query;
    const filter = {};
    if (active === 'true') filter.isActive = true;
    const heads = await CollectionHead.find(filter).sort({ name: 1 });
    res.json({ success: true, data: heads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/collection-heads/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const head = await CollectionHead.findById(req.params.id);
    if (!head) return res.status(404).json({ success: false, message: 'Collection head not found' });
    res.json({ success: true, data: head });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/collection-heads — create head (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const head = await CollectionHead.create({ name: name.trim() });
    res.status(201).json({ success: true, data: head });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A collection head with this name already exists' });
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/collection-heads/:id — update head (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const existing = await CollectionHead.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Collection head not found' });
    
    // If name is changing, we should warn if it is used. Or check if used.
    // If it is used, we can still update it but let's update name in Collection records as well, or prevent renaming if used, or just update the collections.
    // For simplicity, let's update the name in any collections using this head if it changes! That is extremely nice.
    const oldName = existing.name;
    const newName = name ? name.trim() : existing.name;
    
    if (name && newName !== oldName) {
      existing.name = newName;
    }
    if (isActive !== undefined) {
      existing.isActive = isActive;
    }
    
    await existing.save();
    
    if (newName !== oldName) {
      const Collection = require('../models/Collection');
      const collectionsToUpdate = await Collection.find({ "additionalCollections.head": oldName });
      for (const col of collectionsToUpdate) {
        col.additionalCollections.forEach(ac => {
          if (ac.head === oldName) ac.head = newName;
        });
        await col.save();
      }
    }
    
    res.json({ success: true, data: existing });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A collection head with this name already exists' });
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/collection-heads/:id/toggle — toggle isActive
router.patch('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const head = await CollectionHead.findById(req.params.id);
    if (!head) return res.status(404).json({ success: false, message: 'Collection head not found' });
    
    head.isActive = !head.isActive;
    await head.save();
    res.json({ success: true, data: head });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/collection-heads/:id — delete head (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const head = await CollectionHead.findById(req.params.id);
    if (!head) return res.status(404).json({ success: false, message: 'Collection head not found' });

    const Collection = require('../models/Collection');
    const count = await Collection.countDocuments({ "additionalCollections.head": head.name });
    if (count > 0) return res.status(400).json({ success: false, message: `Cannot delete: ${count} collection records are using this head` });
    
    await CollectionHead.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Collection head deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
