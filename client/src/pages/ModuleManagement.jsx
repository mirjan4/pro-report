import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import {
  Package, Plus, Edit, Trash2, ToggleLeft, ToggleRight,
  Check, X, AlertTriangle, Layers, Users, Globe, Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ICON_OPTIONS = [
  { value: 'users', label: 'Users', icon: Users },
  { value: 'globe', label: 'Globe', icon: Globe },
  { value: 'building', label: 'Building', icon: Building },
  { value: 'layers', label: 'Layers', icon: Layers },
  { value: 'package', label: 'Package', icon: Package },
];

const COLOR_PRESETS = [
  '#d4af37', '#60a5fa', '#34d399', '#f97316', '#a78bfa',
  '#f472b6', '#e11d48', '#0ea5e9', '#10b981', '#8b5cf6'
];

const IconComp = ({ icon, className }) => {
  const found = ICON_OPTIONS.find(i => i.value === icon);
  const Comp = found?.icon || Package;
  return <Comp className={className} />;
};

const ModuleManagement = () => {
  const { modules, setModules, selectedModule, setSelectedModule } = useApp();
  const [localModules, setLocalModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('layers');
  const [color, setColor] = useState('#d4af37');
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchModules = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/modules');
      if (res.data.success) {
        setLocalModules(res.data.data);
        setModules(res.data.data.filter(m => m.isActive));
      }
    } catch (err) {
      console.error('Failed to fetch modules', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchModules(); }, []);

  const openAddForm = () => {
    setEditingModule(null);
    setName(''); setCode(''); setDescription('');
    setIcon('layers'); setColor('#d4af37'); setSortOrder(localModules.length);
    setError(''); setSuccessMsg('');
    setFormOpen(true);
  };

  const openEditForm = (mod) => {
    setEditingModule(mod);
    setName(mod.name); setCode(mod.code); setDescription(mod.description || '');
    setIcon(mod.icon || 'layers'); setColor(mod.color || '#d4af37');
    setSortOrder(mod.sortOrder || 0);
    setError(''); setSuccessMsg('');
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) { setError('Name and Code are required'); return; }
    setError(''); setSuccessMsg('');

    const payload = { name: name.trim(), code: code.trim().toLowerCase(), description, icon, color, sortOrder: Number(sortOrder) };

    try {
      if (editingModule) {
        const res = await client.put(`/api/modules/${editingModule._id}`, payload);
        if (res.data.success) {
          setSuccessMsg('Module updated!');
          fetchModules();
          setTimeout(() => setFormOpen(false), 600);
        }
      } else {
        const res = await client.post('/api/modules', payload);
        if (res.data.success) {
          setSuccessMsg('Module created!');
          fetchModules();
          setTimeout(() => setFormOpen(false), 600);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save module');
    }
  };

  const handleToggle = async (mod) => {
    try {
      const res = await client.patch(`/api/modules/${mod._id}/toggle`);
      if (res.data.success) {
        fetchModules();
        if (selectedModule?._id === mod._id) setSelectedModule(res.data.data);
      }
    } catch (err) {
      alert('Failed to toggle module status');
    }
  };

  const handleDelete = async (mod) => {
    try {
      await client.delete(`/api/modules/${mod._id}`);
      fetchModules();
      setDeleteConfirm(null);
      if (selectedModule?._id === mod._id) setSelectedModule(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete module');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Module <span className="gold-gradient-text">Management</span></h1>
          <p className="text-gray-400 text-sm mt-1">Create and manage independent collection modules</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg px-4 py-2.5 rounded-xl text-sm font-bold transition-all glow-btn"
        >
          <Plus className="w-4 h-4" /> New Module
        </button>
      </div>

      {/* Info Banner */}
      <div className="glass-card p-4 border border-blue-500/20 bg-blue-500/5 text-blue-300 text-sm flex items-start gap-3">
        <Package className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-400" />
        <div>
          <p className="font-semibold text-blue-200 mb-1">About Collection Modules</p>
          <p className="text-xs text-gray-400">Each module is an independent system with its own PRO officers, records, analytics, and reports. Switch the active module from the sidebar to work within different collection spaces.</p>
        </div>
      </div>

      {/* Modules Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold" />
        </div>
      ) : localModules.length === 0 ? (
        <div className="glass-card text-center py-16">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No modules yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localModules.map((mod) => (
            <motion.div
              key={mod._id}
              layout
              className={`glass-card p-5 space-y-4 border transition-all duration-300 ${
                !mod.isActive ? 'opacity-50' : ''
              } ${selectedModule?._id === mod._id ? 'ring-2' : 'border-white/5'}`}
              style={selectedModule?._id === mod._id ? { ringColor: mod.color, borderColor: mod.color + '66' } : {}}
            >
              {/* Module Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: mod.color + '22', border: `1px solid ${mod.color}44` }}>
                    <IconComp icon={mod.icon} className="w-5 h-5" style={{ color: mod.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{mod.name}</h3>
                    <code className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{mod.code}</code>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {selectedModule?._id === mod._id && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: mod.color, background: mod.color + '22' }}>Active</span>
                  )}
                </div>
              </div>

              {/* Description */}
              {mod.description && <p className="text-xs text-gray-400">{mod.description}</p>}

              {/* Color Bar */}
              <div className="h-1 rounded-full w-full opacity-60" style={{ background: `linear-gradient(90deg, ${mod.color}, transparent)` }} />

              {/* Status + Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => handleToggle(mod)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    mod.isActive ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-gray-500 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {mod.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {mod.isActive ? 'Active' : 'Inactive'}
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelectedModule(mod)}
                    className="p-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors font-medium"
                    title="Set as active module">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEditForm(mod)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteConfirm(mod)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Scalability Note */}
      <div className="glass-card p-5 border border-white/5">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-gold" /> Architecture Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-400">
          {[
            { title: 'Independent Data', desc: 'Each module has its own MongoDB collection records, scoped by module ID' },
            { title: 'Independent Officers', desc: 'PRO officers are linked to a specific module — no cross-contamination' },
            { title: 'Independent Analytics', desc: 'Dashboard KPIs, rankings, reports, and charts are all filtered by the active module' },
          ].map(item => (
            <div key={item.title} className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <p className="font-bold text-gray-200 mb-1">{item.title}</p>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="font-bold text-lg">Delete Module?</h3>
              </div>
              <p className="text-sm text-gray-400">
                Are you sure you want to delete <strong className="text-white">{deleteConfirm.name}</strong>? This action cannot be undone. Modules with existing collection entries cannot be deleted.
              </p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-rose-500 hover:bg-rose-600 text-white transition-colors">
                  Delete
                </button>
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Form Modal */}
      <AnimatePresence>
        {formOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setFormOpen(false); }}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-md p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{editingModule ? 'Edit Module' : 'New Module'}</h2>
                <button onClick={() => setFormOpen(false)} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Module Name *</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PRO Collection"
                      className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Code *</label>
                    <input value={code} onChange={e => setCode(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                      placeholder="e.g. pro" disabled={!!editingModule}
                      className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50 disabled:opacity-50" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Description</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..."
                    className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Icon Picker */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Icon</label>
                    <div className="flex gap-2">
                      {ICON_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setIcon(opt.value)}
                          className={`p-2 rounded-lg border transition-all ${icon === opt.value ? 'border-gold bg-gold/10' : 'border-white/10 hover:border-white/20'}`}>
                          <opt.icon className={`w-4 h-4 ${icon === opt.value ? 'text-gold' : 'text-gray-400'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Sort Order</label>
                    <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} min={0}
                      className="w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50" />
                  </div>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer p-0.5" />
                    <div className="flex gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button key={c} type="button" onClick={() => setColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 px-3 py-1.5 rounded-lg text-sm font-semibold w-fit" style={{ color, background: color + '22', border: `1px solid ${color}44` }}>
                    Preview: {name || 'Module Name'}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" /> {successMsg}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit"
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-dark-bg bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold transition-all">
                    {editingModule ? 'Update Module' : 'Create Module'}
                  </button>
                  <button type="button" onClick={() => setFormOpen(false)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModuleManagement;
