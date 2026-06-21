import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import {
  Layers, Plus, Trash2, Check, X,
  AlertTriangle, CheckCircle, Sliders, Settings, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const DistributionEntry = () => {
  const { financialYears, selectedFY } = useApp();
  const [activeTab, setActiveTab] = useState('allocations');

  // Time selections
  const [selectedMonth, setSelectedMonth] = useState('April');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Allocations state
  const [totalCollection, setTotalCollection] = useState(0);
  const [heads, setHeads] = useState([]);
  const [allocations, setAllocations] = useState({}); // { headName: amountString }
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // CRUD Distribution Heads state
  const [allHeads, setAllHeads] = useState([]);
  const [newHeadName, setNewHeadName] = useState('');
  const [editingHead, setEditingHead] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [headError, setHeadError] = useState('');
  const [headSuccess, setHeadSuccess] = useState('');

  // Fetch active/all heads
  const fetchHeads = async () => {
    try {
      const res = await client.get('/api/distribution-heads');
      if (res.data.success) {
        setAllHeads(res.data.data);
        setHeads(res.data.data.filter(h => h.isActive));
      }
    } catch (err) {
      console.error('Failed to fetch distribution heads', err);
    }
  };

  // Sync Year with Financial Year
  useEffect(() => {
    const activeFY = selectedFY || financialYears.find(fy => fy.isActive) || financialYears[0];
    if (activeFY) {
      const startYear = activeFY.startYear;
      const monthIdx = MONTHS.indexOf(selectedMonth);
      const yearVal = monthIdx >= 9 ? startYear + 1 : startYear;
      setSelectedYear(yearVal);
    }
  }, [selectedMonth, selectedFY, financialYears]);

  // Load Data for selected Month/Year
  const loadPeriodData = async () => {
    if (!selectedMonth || !selectedYear) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      // 1. Fetch collections in this period
      const collectionsRes = await client.get(`/api/collections?month=${selectedMonth}&year=${selectedYear}&limit=200`);
      let TakafulTotal = 0;
      if (collectionsRes.data.success) {
        // Enforce accounting rule: Sum strictly amount (Takaful Collection), ignore additionalAmount
        TakafulTotal = collectionsRes.data.data.reduce((sum, c) => sum + (c.amount || 0), 0);
        setTotalCollection(TakafulTotal);
      }

      // 2. Fetch existing distribution document
      const distRes = await client.get(`/api/distributions?month=${selectedMonth}&year=${selectedYear}`);
      const initialAllocations = {};
      
      // Default all active heads to "0"
      heads.forEach(h => {
        initialAllocations[h.name] = '0';
      });

      if (distRes.data.success && distRes.data.data) {
        const savedDist = distRes.data.data.distributions || [];
        savedDist.forEach(d => {
          initialAllocations[d.head] = d.amount.toString();
        });
      }

      setAllocations(initialAllocations);
    } catch (err) {
      console.error('Failed to load period data', err);
      setError('Failed to fetch collections or allocations data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeads();
  }, []);

  useEffect(() => {
    if (heads.length > 0) {
      loadPeriodData();
    }
  }, [selectedMonth, selectedYear, heads]);

  // Calculate live values
  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const remainingBalance = totalCollection - totalAllocated;

  const handleInputChange = (headName, value) => {
    setAllocations(prev => ({
      ...prev,
      [headName]: value
    }));
  };

  const handleSaveAllocations = async (e) => {
    e.preventDefault();
    if (remainingBalance < 0) {
      setError('Distributed amount cannot exceed the Total Takaful Collection.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload = Object.entries(allocations).map(([head, amount]) => ({
        head,
        amount: Number(amount) || 0
      }));

      const res = await client.post('/api/distributions', {
        month: selectedMonth,
        year: selectedYear,
        distributions: payload
      });

      if (res.data.success) {
        setSuccessMsg('Distributions saved successfully!');
        loadPeriodData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save allocations');
    } finally {
      setSaving(false);
    }
  };

  // CRUD Distribution Heads Handlers
  const handleAddHead = async (e) => {
    e.preventDefault();
    if (!newHeadName.trim()) return;
    setHeadError('');
    setHeadSuccess('');
    try {
      const res = await client.post('/api/distribution-heads', { name: newHeadName });
      if (res.data.success) {
        setHeadSuccess('Distribution head added!');
        setNewHeadName('');
        fetchHeads();
      }
    } catch (err) {
      setHeadError(err.response?.data?.message || 'Failed to add head');
    }
  };

  const handleToggleActive = async (id) => {
    try {
      const res = await client.patch(`/api/distribution-heads/${id}/toggle`);
      if (res.data.success) {
        fetchHeads();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  const handleStartEdit = (head) => {
    setEditingHead(head);
    setEditingName(head.name);
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim()) return;
    setHeadError('');
    setHeadSuccess('');
    try {
      const res = await client.put(`/api/distribution-heads/${editingHead._id}`, { name: editingName });
      if (res.data.success) {
        setHeadSuccess('Distribution head renamed!');
        setEditingHead(null);
        fetchHeads();
      }
    } catch (err) {
      setHeadError(err.response?.data?.message || 'Failed to rename head');
    }
  };

  const handleDeleteHead = async (id) => {
    if (!window.confirm('Are you sure you want to delete this distribution head? This will fail if it has non-zero records.')) return;
    setHeadError('');
    setHeadSuccess('');
    try {
      const res = await client.delete(`/api/distribution-heads/${id}`);
      if (res.data.success) {
        setHeadSuccess('Distribution head deleted!');
        fetchHeads();
      }
    } catch (err) {
      setHeadError(err.response?.data?.message || 'Failed to delete head');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Distribution <span className="gold-gradient-text">Management</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">Allocate and distribute monthly Takaful Collections into schemes and projects</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('allocations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeTab === 'allocations' ? 'text-dark-bg bg-gold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Monthly Distribution
        </button>
        <button
          onClick={() => setActiveTab('heads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
            activeTab === 'heads' ? 'text-dark-bg bg-gold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings className="w-4 h-4" /> Manage Projects/Heads
        </button>
      </div>

      {/* allocations VIEW */}
      {activeTab === 'allocations' && (
        <div className="space-y-6">
          {/* Filtering Controls */}
          <div className="glass-card p-5 rounded-2xl border border-white/10 flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Distribution Month</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-[#0c1224] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 cursor-pointer h-10 w-[160px]"
              >
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Year</label>
              <input
                type="number"
                value={selectedYear}
                disabled
                className="bg-[#0c1224]/50 border border-white/5 rounded-xl px-3 py-2 text-sm text-gray-400 focus:outline-none h-10 w-[120px] text-center"
              />
            </div>
            <div className="flex-1 text-right text-xs text-gray-500 font-medium">
              * Period linked with selected sidebar report period.
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Form inputs */}
              <div className="lg:col-span-2 space-y-4">
                <form onSubmit={handleSaveAllocations} className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
                  <h3 className="font-bold text-white text-base border-b border-white/5 pb-2.5 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-gold" /> Allocation Matrix
                  </h3>

                  {heads.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500 italic">
                      No active distribution heads configured. Go to "Manage Projects/Heads" tab to create them.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {heads.map(h => (
                        <div key={h._id} className="flex flex-col space-y-1">
                          <label className="text-xs text-gray-300 font-medium">{h.name}</label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={allocations[h.name] || '0'}
                              onChange={e => handleInputChange(h.name, e.target.value)}
                              className="w-full bg-[#0c1224] border border-white/10 rounded-xl pl-8 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gold/50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
                    </div>
                  )}

                  <div className="pt-3.5 border-t border-white/5 text-right">
                    <button
                      type="submit"
                      disabled={saving || heads.length === 0}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold text-dark-bg bg-gold hover:bg-gold-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer glow-btn"
                    >
                      {saving ? 'Saving allocations...' : 'Save Distribution'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Calculations Summary Panel */}
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
                  <h3 className="font-bold text-white text-base border-b border-white/5 pb-2.5">
                    Distribution Summary
                  </h3>

                  <div className="space-y-3.5">
                    {/* Total Takaful Collection */}
                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                      <span className="text-gray-400 font-medium">Total Takaful Collection:</span>
                      <span className="font-extrabold text-white">₹{totalCollection.toLocaleString('en-IN')}</span>
                    </div>

                    {/* Total Allocated */}
                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                      <span className="text-gray-400 font-medium">Total Distributed:</span>
                      <span className="font-extrabold text-white">₹{totalAllocated.toLocaleString('en-IN')}</span>
                    </div>

                    {/* Remaining Takaful Balance */}
                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-gray-400 font-medium">Remaining Takaful:</span>
                      <span className={`text-base font-black ${remainingBalance >= 0 ? 'text-gold' : 'text-rose-400'}`}>
                        ₹{remainingBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {remainingBalance < 0 && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Warning: Total allocated amount exceeds the month's Takaful collections.</span>
                    </div>
                  )}

                  {remainingBalance >= 0 && (
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-emerald-400 text-[11px] flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Budget balanced. Remaining collections will be logged as Takaful Balance.</span>
                    </div>
                  )}
                </div>

                <div className="glass-card rounded-2xl p-5 border border-white/5 text-xs text-gray-500 space-y-2">
                  <p className="font-bold text-gray-400 uppercase tracking-wider">Accounting Rules:</p>
                  <p>1. Distributions are sourced strictly from Takaful collections (`Global + PRO + Office`).</p>
                  <p>2. Direct / Additional Collections received through PROs are **excluded** and do not affect the distribution totals or balances.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HEADS CRUD VIEW */}
      {activeTab === 'heads' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create new head form */}
          <div className="space-y-4">
            <form onSubmit={handleAddHead} className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
              <h3 className="font-bold text-white text-base">New Distribution Head</h3>
              
              <div className="flex flex-col space-y-1">
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Head Name</label>
                <input
                  type="text"
                  placeholder="e.g. Eid Food Kit"
                  value={newHeadName}
                  onChange={e => setNewHeadName(e.target.value)}
                  className="w-full bg-[#0c1224] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-gold/50"
                />
              </div>

              {headError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {headError}
                </div>
              )}
              {headSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" /> {headSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={!newHeadName.trim()}
                className="w-full py-2 px-4 rounded-xl text-sm font-bold text-dark-bg bg-gold hover:bg-gold-accent disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Head
              </button>
            </form>
          </div>

          {/* List all configured heads */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="font-bold text-white text-base border-b border-white/5 pb-2.5">
                All Distribution Heads
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-500 uppercase text-[10px] tracking-wider font-semibold">
                      <th className="pb-2 text-left">Head Name</th>
                      <th className="pb-2 text-center">Status</th>
                      <th className="pb-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {allHeads.map(h => (
                      <tr key={h._id} className="hover:bg-white/[0.01]">
                        <td className="py-2.5 text-sm">
                          {editingHead && editingHead._id === h._id ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={e => setEditingName(e.target.value)}
                              className="bg-[#0c1224] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                            />
                          ) : (
                            <span className="text-white font-medium">{h.name}</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center">
                          <button
                            onClick={() => handleToggleActive(h._id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border cursor-pointer ${
                              h.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {h.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-2.5">
                          <div className="flex justify-center gap-2">
                            {editingHead && editingHead._id === h._id ? (
                              <>
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingHead(null)}
                                  className="p-1 rounded-lg text-gray-400 hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEdit(h)}
                                  className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 transition-colors cursor-pointer"
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => handleDeleteHead(h._id)}
                                  className="p-1 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {allHeads.length === 0 && (
                      <tr>
                        <td colSpan="3" className="py-4 text-center text-gray-500 italic">No distribution heads found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionEntry;
