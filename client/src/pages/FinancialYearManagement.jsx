import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import { Calendar, Plus, Edit, Archive, CheckCircle, ShieldAlert, Sparkles, X, Activity, RotateCcw } from 'lucide-react';

const FinancialYearManagement = () => {
  const { refreshMetadata } = useApp();
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState(null);

  // Form states
  const [yearString, setYearString] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const fetchYears = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/financial-years?includeArchived=true');
      if (res.data.success) {
        setYears(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch financial years', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const openAddModal = () => {
    setEditingYear(null);
    setYearString('');
    setStartYear('');
    setEndYear('');
    setDescription('');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (fy) => {
    setEditingYear(fy);
    setYearString(fy.year);
    setStartYear(fy.startYear.toString());
    setEndYear(fy.endYear.toString());
    setDescription(fy.description || '');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!yearString || !startYear || !endYear) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');

    const fyData = {
      year: yearString,
      startYear: Number(startYear),
      endYear: Number(endYear),
      description
    };

    try {
      if (editingYear) {
        const res = await client.put(`/api/financial-years/${editingYear._id}`, fyData);
        if (res.data.success) {
          setYears(years.map(y => y._id === editingYear._id ? res.data.data : y));
        }
      } else {
        const res = await client.post('/api/financial-years', fyData);
        if (res.data.success) {
          setYears([...years, res.data.data]);
        }
      }
      setModalOpen(false);
      refreshMetadata();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleActivate = async (id) => {
    try {
      const res = await client.patch(`/api/financial-years/${id}/activate`);
      if (res.data.success) {
        // Map all to inactive except the newly activated one
        setYears(years.map(y =>
          y._id === id
            ? { ...y, isActive: true, isArchived: false }
            : { ...y, isActive: false }
        ));
        refreshMetadata();
      }
    } catch (err) {
      alert('Failed to activate financial year');
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Are you sure you want to archive this financial year?')) return;
    try {
      const res = await client.patch(`/api/financial-years/${id}/archive`);
      if (res.data.success) {
        setYears(years.map(y => y._id === id ? res.data.data : y));
        refreshMetadata();
      }
    } catch (err) {
      alert('Failed to archive financial year');
    }
  };

  const handleRestore = async (id) => {
    try {
      const res = await client.put(`/api/financial-years/${id}`, { isArchived: false });
      if (res.data.success) {
        setYears(years.map(y => y._id === id ? res.data.data : y));
        refreshMetadata();
      }
    } catch (err) {
      alert('Failed to restore financial year');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this financial year? All associated collections should be deleted first.')) return;
    try {
      const res = await client.delete(`/api/financial-years/${id}`);
      if (res.data.success) {
        setYears(years.filter(y => y._id !== id));
        refreshMetadata();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Financial Year <span className="gold-gradient-text">Management</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure financial reporting periods, select reporting active year, or archive historical records
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 glow-btn"
        >
          <Plus className="w-4 h-4" />
          <span>New Financial Year</span>
        </button>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {years.map((fy) => (
            <div
              key={fy._id}
              className={`glass-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between ${
                fy.isActive ? 'border border-gold/40 shadow-lg shadow-gold/5' : ''
              } ${fy.isArchived ? 'opacity-60' : ''}`}
            >
              {/* Badge Active / Archived */}
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center text-xs font-semibold text-gray-400">
                  <Calendar className="w-4 h-4 mr-1.5 text-gold" />
                  {fy.year}
                </span>
                <div className="flex space-x-1.5">
                  {fy.isActive && (
                    <span className="flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-gold/15 text-gold">
                      <Activity className="w-3 h-3 mr-1" />
                      Active
                    </span>
                  )}
                  {fy.isArchived && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/5 text-gray-400 border border-white/5">
                      Archived
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{fy.label}</h3>
                <p className="text-xs text-gray-400 mt-2 min-h-[40px] line-clamp-2">
                  {fy.description || 'No description provided.'}
                </p>
                <div className="space-y-1.5 mt-4 pt-4 border-t border-white/5 text-xs text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">Start:</span>
                    <span>April {fy.startYear}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">End:</span>
                    <span>March {fy.endYear}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                <div className="flex space-x-2">
                  {!fy.isActive && !fy.isArchived && (
                    <button
                      onClick={() => handleActivate(fy._id)}
                      className="flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-white font-semibold transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Activate</span>
                    </button>
                  )}
                  {fy.isActive && (
                    <span className="text-xs text-gold/80 font-bold flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Current Active
                    </span>
                  )}
                  {fy.isArchived && (
                    <button
                      onClick={() => handleRestore(fy._id)}
                      className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-white font-semibold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-open / Restore</span>
                    </button>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditModal(fy)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors border border-white/5"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  {!fy.isArchived && (
                    <button
                      onClick={() => handleArchive(fy._id)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-amber-500 rounded-lg transition-colors border border-white/5"
                      title="Archive Year"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(fy._id)}
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/10"
                    title="Delete Year"
                  >
                    <Edit className="w-3.5 h-3.5 rotate-45 text-rose-400" /> {/* Wait, rotate 45 to act as delete, or replace with Trash icon if we can import it */}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="w-full max-w-lg glass-card rounded-2xl p-6 border border-white/15 animate-zoomIn">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-gold" />
                {editingYear ? 'Edit Financial Period' : 'Create Financial Period'}
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
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Financial Year Designation</label>
                <input
                  type="text"
                  value={yearString}
                  onChange={(e) => setYearString(e.target.value)}
                  placeholder="e.g. 2025-26"
                  className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Start Calendar Year</label>
                  <input
                    type="number"
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                    placeholder="e.g. 2025"
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">End Calendar Year</label>
                  <input
                    type="number"
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                    placeholder="e.g. 2026"
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Primary financial reporting dashboard scope..."
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
                  {editingYear ? 'Save Changes' : 'Initialize Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialYearManagement;
