import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import { Users, Plus, Edit, Trash2, ShieldAlert, Sparkles, Check, X, Search, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const parseBulkText = (text, defaultModuleId) => {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  const parsed = [];
  
  let startIndex = 0;
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('name') || firstLine.includes('designation') || firstLine.includes('mobile') || firstLine.includes('email')) {
      startIndex = 1;
    }
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth();
  const defaultStartYear = currentMonthIdx >= 3 ? currentYear : currentYear - 1;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    let parts = [];
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else {
      parts = [line];
    }
    
    const name = parts[0]?.trim() || '';
    const designation = parts[1]?.trim() || 'PRO Officer';
    const mobile = parts[2]?.trim() || '';
    const email = parts[3]?.trim() || '';
    
    if (name) {
      parsed.push({
        name,
        designation: designation || 'PRO Officer',
        mobile: mobile || '',
        email: email || '',
        status: 'active',
        module: defaultModuleId,
        notes: '',
        joiningMonth: 'April',
        joiningYear: defaultStartYear
      });
    }
  }
  return parsed;
};

const ProManagement = () => {
  const { user, refreshMetadata, modules, selectedModule, setPros: setContextPros } = useApp();
  const [pros, setPros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPro, setEditingPro] = useState(null);

  const filteredPros = pros.filter(
    p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.designation && p.designation.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const [selectedProIds, setSelectedProIds] = useState([]);

  // Reset selections when filters change
  useEffect(() => {
    setSelectedProIds([]);
  }, [selectedModule, searchTerm]);

  const handleToggleSelect = (id) => {
    setSelectedProIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProIds.length === filteredPros.length && filteredPros.length > 0) {
      setSelectedProIds([]);
    } else {
      setSelectedProIds(filteredPros.map(p => p._id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProIds.length === 0) return;
    const count = selectedProIds.length;
    if (!window.confirm(`Are you sure you want to delete the ${count} selected PRO officer(s)? This will also delete all their associated collection entries and CANNOT be undone.`)) {
      return;
    }
    
    try {
      const res = await client.delete('/api/pros/bulk', { data: { ids: selectedProIds } });
      if (res.data.success) {
        setPros(pros.filter(p => !selectedProIds.includes(p._id)));
        setSelectedProIds([]);
        refreshMetadata();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to bulk delete PRO officers');
    }
  };

  // Form states
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [joiningMonth, setJoiningMonth] = useState('April');
  const [joiningYear, setJoiningYear] = useState('');
  const [error, setError] = useState('');

  // Bulk entry states
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState(1); // 1: Paste, 2: Preview/Edit, 3: Results
  const [bulkRawText, setBulkRawText] = useState('');
  const [bulkParsedPros, setBulkParsedPros] = useState([]);
  const [bulkDefaultModuleId, setBulkDefaultModuleId] = useState('');
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkSuccessCount, setBulkSuccessCount] = useState(0);

  const openBulkModal = () => {
    setBulkStep(1);
    setBulkRawText('');
    setBulkParsedPros([]);
    const firstRealModule = modules.find(m => m.code !== 'all');
    setBulkDefaultModuleId((selectedModule && selectedModule.code !== 'all') ? selectedModule._id : (firstRealModule?._id || ''));
    setBulkErrors([]);
    setBulkSuccessCount(0);
    setBulkModalOpen(true);
  };

  const handleParseBulk = () => {
    if (!bulkRawText.trim()) {
      setBulkErrors(['Please paste some data to import']);
      return;
    }
    setBulkErrors([]);
    const parsed = parseBulkText(bulkRawText, bulkDefaultModuleId);
    if (parsed.length === 0) {
      setBulkErrors(['Could not parse any valid rows. Please check formatting.']);
      return;
    }
    setBulkParsedPros(parsed);
    setBulkStep(2);
  };

  const handleBulkFieldChange = (index, field, value) => {
    const updated = [...bulkParsedPros];
    updated[index][field] = value;
    setBulkParsedPros(updated);
  };

  const handleBulkDeleteRow = (index) => {
    setBulkParsedPros(bulkParsedPros.filter((_, i) => i !== index));
  };

  const handleBulkAddRow = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIdx = today.getMonth();
    const defaultStartYear = currentMonthIdx >= 3 ? currentYear : currentYear - 1;
    setBulkParsedPros([
      ...bulkParsedPros,
      {
        name: '',
        designation: 'PRO Officer',
        mobile: '',
        email: '',
        status: 'active',
        module: bulkDefaultModuleId,
        notes: '',
        joiningMonth: 'April',
        joiningYear: defaultStartYear
      }
    ]);
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    const invalidRows = [];
    bulkParsedPros.forEach((pro, index) => {
      if (!pro.name.trim()) {
        invalidRows.push(`Row ${index + 1}: Name is required.`);
      }
      if (!pro.module) {
        invalidRows.push(`Row ${index + 1}: Module is required.`);
      }
      if (!pro.joiningMonth) {
        invalidRows.push(`Row ${index + 1}: Joining Month is required.`);
      }
      if (!pro.joiningYear) {
        invalidRows.push(`Row ${index + 1}: Joining Year is required.`);
      }
    });

    if (invalidRows.length > 0) {
      setBulkErrors(invalidRows);
      return;
    }

    setBulkErrors([]);
    try {
      const res = await client.post('/api/pros/bulk', { pros: bulkParsedPros });
      if (res.data.success) {
        setBulkSuccessCount(res.data.data.length);
        if (res.data.errors && res.data.errors.length > 0) {
          setBulkErrors(res.data.errors);
        } else {
          setBulkErrors([]);
        }
        setPros([...pros, ...res.data.data]);
        setBulkStep(3);
        refreshMetadata();
      }
    } catch (err) {
      setBulkErrors([err.response?.data?.message || 'Something went wrong during bulk registration']);
    }
  };

  const fetchPros = async () => {
    setLoading(true);
    try {
      const params = selectedModule && selectedModule.code !== 'all' ? `?module=${selectedModule._id}` : '';
      const res = await client.get(`/api/pros${params}`);
      if (res.data.success) setPros(res.data.data);
    } catch (err) {
      console.error('Failed to fetch PROs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPros(); }, [selectedModule]);

  const openAddModal = () => {
    setEditingPro(null);
    setName('');
    setDesignation('PRO Officer');
    setMobile('');
    setEmail('');
    setStatus('active');
    setNotes('');
    const defaultModule = modules.find(m => m.code !== 'all')?._id || '';
    setModuleId(selectedModule && selectedModule.code !== 'all' ? selectedModule._id : defaultModule);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIdx = today.getMonth();
    const defaultStartYear = currentMonthIdx >= 3 ? currentYear : currentYear - 1;
    setJoiningMonth('April');
    setJoiningYear(defaultStartYear.toString());
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (pro) => {
    setEditingPro(pro);
    setName(pro.name);
    setDesignation(pro.designation || 'PRO Officer');
    setMobile(pro.mobile || '');
    setEmail(pro.email || '');
    setStatus(pro.status || 'active');
    setNotes(pro.notes || '');
    const defaultModule = modules.find(m => m.code !== 'all')?._id || '';
    setModuleId(pro.module?._id || pro.module || (selectedModule && selectedModule.code !== 'all' ? selectedModule._id : defaultModule));
    setJoiningMonth(pro.joiningMonth || 'April');
    setJoiningYear(pro.joiningYear ? pro.joiningYear.toString() : '');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) { setError('Name is a required field'); return; }
    if (!moduleId) { setError('Please select a module for this PRO officer'); return; }
    if (!joiningMonth) { setError('Joining Month is a required field'); return; }
    if (!joiningYear) { setError('Joining Year is a required field'); return; }
    setError('');
    const proData = {
      name,
      designation,
      mobile,
      email,
      status,
      notes,
      module: moduleId,
      joiningMonth,
      joiningYear: Number(joiningYear)
    };
    try {
      if (editingPro) {
        const res = await client.put(`/api/pros/${editingPro._id}`, proData);
        if (res.data.success) setPros(pros.map(p => p._id === editingPro._id ? res.data.data : p));
      } else {
        const res = await client.post('/api/pros', proData);
        if (res.data.success) setPros([...pros, res.data.data]);
      }
      setModalOpen(false);
      refreshMetadata();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this PRO? This cannot be undone.')) return;
    try {
      const res = await client.delete(`/api/pros/${id}`);
      if (res.data.success) {
        setPros(pros.filter(p => p._id !== id));
        refreshMetadata();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete PRO');
    }
  };

  const toggleStatus = async (pro) => {
    try {
      const res = await client.patch(`/api/pros/${pro._id}/toggle-status`);
      if (res.data.success) {
        setPros(pros.map(p => p._id === pro._id ? res.data.data : p));
        refreshMetadata();
      }
    } catch (err) {
      alert('Failed to change status');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-white">
            PRO <span className="gold-gradient-text">Management</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Register, edit, delete, and configure settings for PRO officers
          </p>
        </div>
        {user?.role === 'admin' && (
          <div className="flex space-x-3">
            <button
              onClick={openBulkModal}
              className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-gold border border-gold/30 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer"
            >
              <Users className="w-4 h-4 text-gold" />
              <span>Bulk Register</span>
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center space-x-2 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 glow-btn"
            >
              <Plus className="w-4 h-4" />
              <span>Add PRO Officer</span>
            </button>
          </div>
        )}
      </div>

      {/* Directory Controls */}
      <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-80">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PROs by name or designation..."
              className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gold transition-colors duration-200"
            />
          </div>
          {user?.role === 'admin' && filteredPros.length > 0 && (
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedProIds.length === filteredPros.length && filteredPros.length > 0}
                onChange={() => {}}
                className="w-3.5 h-3.5 rounded border-white/20 text-gold focus:ring-0 accent-gold cursor-pointer"
              />
              <span>{selectedProIds.length === filteredPros.length ? 'Deselect All' : 'Select All'}</span>
            </button>
          )}
        </div>
        <div className="text-gray-500 flex items-center space-x-2">
          <Users className="w-5 h-5 text-gold/60" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {filteredPros.length} Active Officers
          </span>
        </div>
      </div>

      {/* Grid of PROs */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPros.map((pro) => (
            <div key={pro._id} className={`glass-card rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${selectedProIds.includes(pro._id) ? 'ring-2 ring-gold/45 border-gold/30 bg-gold/[0.02]' : ''}`}>
              {/* Top Details */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {user?.role === 'admin' && (
                      <input
                        type="checkbox"
                        checked={selectedProIds.includes(pro._id)}
                        onChange={() => handleToggleSelect(pro._id)}
                        className="mt-1.5 w-4 h-4 rounded border-white/20 text-gold focus:ring-0 accent-gold cursor-pointer shrink-0"
                      />
                    )}
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight">{pro.name}</h3>
                      <p className="text-xs text-gold font-medium mt-1">{pro.designation || 'PRO Officer'}</p>
                      {pro.module && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                          style={{ color: pro.module?.color || '#d4af37', background: (pro.module?.color || '#d4af37') + '22', border: `1px solid ${(pro.module?.color || '#d4af37')}44` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: pro.module?.color || '#d4af37' }} />
                          {pro.module?.name || 'Module'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    onClick={() => user?.role === 'admin' && toggleStatus(pro)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase cursor-pointer ${
                      pro.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
                    }`}
                  >
                    {pro.status}
                  </span>
                </div>

                <div className="space-y-3 mt-3 pt-3 border-t border-white/5 text-sm text-gray-300">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Joined</span>
                    <span className="font-medium text-white mt-0.5">
                      {pro.joiningMonth && pro.joiningYear ? `${pro.joiningMonth} ${pro.joiningYear}` : 'Not Available'}
                    </span>
                  </div>
                  {pro.mobile && (
                    <div className="flex flex-col">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Mobile</span>
                      <span className="font-medium text-white mt-0.5">{pro.mobile}</span>
                    </div>
                  )}
                  {pro.email && (
                    <div className="flex flex-col">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Email</span>
                      <span className="font-medium text-white mt-0.5 truncate w-full">{pro.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                <Link
                  to={`/pro/${pro._id}`}
                  className="flex items-center space-x-1.5 text-xs text-gold hover:text-white font-semibold transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Analytics</span>
                </Link>
                {user?.role === 'admin' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(pro)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors border border-white/5"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(pro._id)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="w-full max-w-lg glass-card rounded-2xl p-6 border border-white/15 animate-zoomIn max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-gold" />
                {editingPro ? 'Edit PRO Officer' : 'Add New PRO Officer'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl mb-4">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ahmed Al-Rashidi"
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior PRO"
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Mobile Number</label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. 050-1234567"
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. ahmed@domain.com"
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Collection Module *</label>
                <select value={moduleId} onChange={e => setModuleId(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold">
                  <option value="">Select Module</option>
                  {modules.filter(m => m.code !== 'all').map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Joining Month *</label>
                  <select
                    value={joiningMonth}
                    onChange={(e) => setJoiningMonth(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                  >
                    <option value="">Select Month</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Joining Year *</label>
                  <input
                    type="number"
                    value={joiningYear}
                    onChange={(e) => setJoiningYear(e.target.value)}
                    placeholder="e.g. 2026"
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional profile information..."
                  rows="3"
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg font-bold rounded-xl text-sm transition-all"
                >
                  {editingPro ? 'Save Changes' : 'Register Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Registration Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="w-full max-w-4xl glass-card rounded-2xl p-6 border border-white/15 animate-zoomIn max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center">
                <Users className="w-5 h-5 mr-2 text-gold" />
                Bulk Officer Registration
              </h3>
              <button onClick={() => setBulkModalOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error alerts */}
            {bulkErrors.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl mb-4 max-h-32 overflow-y-auto no-scrollbar shrink-0">
                <div className="flex items-center space-x-2 mb-1">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span className="font-bold">Errors / Warnings:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {bulkErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                </ul>
              </div>
            )}

            {/* Step 1: Paste Text */}
            {bulkStep === 1 && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                  <div>
                    <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">
                      Default Module for Batch
                    </label>
                    <select
                      value={bulkDefaultModuleId}
                      onChange={(e) => setBulkDefaultModuleId(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                    >
                      <option value="">Select Module</option>
                      {modules.filter(m => m.code !== 'all').map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-400 flex flex-col justify-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="font-bold text-white mb-0.5">Instructions:</span>
                    Paste data directly from Excel or write comma/tab separated text.
                    Columns: <code className="text-gold">Name | Designation | Mobile | Email</code>. Header row is optional and auto-skipped.
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5 shrink-0">
                    Paste Excel/CSV Data
                  </label>
                  <textarea
                    value={bulkRawText}
                    onChange={(e) => setBulkRawText(e.target.value)}
                    placeholder="e.g.&#10;Ahmed Al-Rashidi&#9;Senior PRO&#9;050-1234567&#9;ahmed@domain.com&#10;John Smith&#9;PRO Officer&#9;052-7654321&#9;john@domain.com"
                    className="w-full flex-1 bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold font-mono resize-none min-h-[150px]"
                  />
                </div>

                <div className="flex space-x-3 pt-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBulkModalOpen(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleParseBulk}
                    className="flex-1 py-3 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg font-bold rounded-xl text-sm transition-all"
                  >
                    Parse & Preview
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Interactive Grid */}
            {bulkStep === 2 && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center shrink-0">
                  <span className="text-sm text-gray-400">
                    Review and edit the parsed officers below before saving.
                  </span>
                  <button
                    onClick={handleBulkAddRow}
                    className="text-xs font-bold text-gold hover:text-white bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="flex-1 overflow-auto border border-white/10 rounded-xl no-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-white/5 text-gray-400 text-xs font-bold uppercase border-b border-white/10 sticky top-0 z-10">
                        <th className="p-3">Name *</th>
                        <th className="p-3">Designation</th>
                        <th className="p-3">Mobile</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Module *</th>
                        <th className="p-3">Joining Month *</th>
                        <th className="p-3">Joining Year *</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {bulkParsedPros.map((pro, index) => (
                        <tr key={index} className="hover:bg-white/5 transition-colors">
                          <td className="p-2">
                            <input
                              type="text"
                              value={pro.name}
                              onChange={(e) => handleBulkFieldChange(index, 'name', e.target.value)}
                              placeholder="Name"
                              className={`w-full bg-[#0a0f1d] border ${!pro.name.trim() ? 'border-rose-500/50' : 'border-white/10'} rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={pro.designation}
                              onChange={(e) => handleBulkFieldChange(index, 'designation', e.target.value)}
                              placeholder="Designation"
                              className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={pro.mobile}
                              onChange={(e) => handleBulkFieldChange(index, 'mobile', e.target.value)}
                              placeholder="Mobile"
                              className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={pro.email}
                              onChange={(e) => handleBulkFieldChange(index, 'email', e.target.value)}
                              placeholder="Email"
                              className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={pro.module}
                              onChange={(e) => handleBulkFieldChange(index, 'module', e.target.value)}
                              className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
                            >
                              <option value="">Select Module</option>
                              {modules.filter(m => m.code !== 'all').map((m) => (
                                <option key={m._id} value={m._id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={pro.joiningMonth || 'April'}
                              onChange={(e) => handleBulkFieldChange(index, 'joiningMonth', e.target.value)}
                              className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
                            >
                              {MONTHS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={pro.joiningYear || ''}
                              onChange={(e) => handleBulkFieldChange(index, 'joiningYear', Number(e.target.value))}
                              placeholder="Year"
                              className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleBulkDeleteRow(index)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex space-x-3 pt-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBulkStep(1)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 transition-all cursor-pointer"
                  >
                    Back to paste
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    className="flex-1 py-3 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Register ({bulkParsedPros.length}) Officers
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Results */}
            {bulkStep === 3 && (
              <div className="space-y-6 flex-1 flex flex-col justify-center items-center text-center p-6 shrink-0">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-2 animate-bounce">
                  <Check className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-white">Bulk Registration Complete!</h4>
                  <p className="text-gray-400 text-sm mt-2 max-w-md">
                    Successfully registered <span className="font-bold text-gold">{bulkSuccessCount}</span> new PRO officers.
                  </p>
                </div>

                {bulkErrors.length > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-xl text-left max-w-lg w-full max-h-40 overflow-y-auto no-scrollbar">
                    <div className="font-bold mb-2 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      Some rows failed to import:
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {bulkErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setBulkModalOpen(false);
                    fetchPros();
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg font-bold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Done & Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Floating Bulk Actions Bar */}
      {selectedProIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0c1224]/90 backdrop-blur-md border border-rose-500/30 rounded-2xl py-4 px-6 flex items-center justify-between gap-6 z-40 shadow-2xl shadow-rose-950/20 max-w-lg w-[90vw] animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">{selectedProIds.length} PRO(s) Selected</p>
              <p className="text-gray-400 text-[11px] leading-tight mt-0.5">Bulk delete will also clear all associated collections.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setSelectedProIds([])}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProManagement;
