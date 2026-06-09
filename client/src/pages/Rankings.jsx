import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import { Trophy, Search, ChevronDown, ChevronUp, Download, Eye, TrendingUp, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const Rankings = () => {
  const { selectedFY, selectedModule } = useApp();
  const [rankings, setRankings] = useState([]);
  const [zeroPros, setZeroPros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('rank');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFY?._id) return;
      setLoading(true);
      try {
        const modParam = selectedModule ? `&module=${selectedModule._id}` : '';
        const res = await client.get(`/api/analytics/rankings?financialYear=${selectedFY._id}${modParam}`);
        if (res.data.success) {
          setRankings(res.data.data.rankings || []);
          setZeroPros(res.data.data.zeroPros || []);
        }
      } catch (err) {
        console.error('Failed to load rankings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedFY, selectedModule]);

  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Combine rankings & zero contributors for the full table list
  const fullList = [
    ...rankings,
    ...zeroPros.map(p => ({ ...p, total: 0, rank: '-', growth: 0 }))
  ];

  // Apply search
  const filteredList = fullList.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Apply sorting
  const sortedList = [...filteredList].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Handle string conversion or missing value
    if (sortField === 'rank') {
      aVal = a.rank === '-' ? 9999 : Number(a.rank);
      bVal = b.rank === '-' ? 9999 : Number(b.rank);
    } else if (sortField === 'total' || sortField === 'growth') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    } else {
      aVal = aVal?.toString().toLowerCase() || '';
      bVal = bVal?.toString().toLowerCase() || '';
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Apply pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedList.length / itemsPerPage);

  // Export to Excel
  const exportExcel = () => {
    const dataToExport = sortedList.map(p => ({
      Rank: p.rank,
      Name: p.name,
      'Total Collection (INR)': p.total,
      'Growth (%)': p.growth,
      Status: p.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PRO Rankings');
    XLSX.writeFile(workbook, `PRO_Rankings_${selectedFY?.year}.xlsx`);
  };

  // Export to PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`PRO Performance Rankings - ${selectedFY?.label}`, 14, 15);

    const tableColumn = ['Rank', 'Name', 'Total Collection (INR)', 'Growth %', 'Status'];
    const tableRows = sortedList.map(p => [
      p.rank,
      p.name,
      p.total.toLocaleString('en-IN'),
      `${p.growth}%`,
      p.status
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 22,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [13, 27, 42] }
    });

    doc.save(`PRO_Rankings_${selectedFY?.year}.pdf`);
  };

  const top3 = rankings.slice(0, 3);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Performance <span className="gold-gradient-text">Rankings</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {selectedModule && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border"
                style={{ color: selectedModule.color, borderColor: selectedModule.color + '44', background: selectedModule.color + '18' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedModule.color }} />
                {selectedModule.name}
              </span>
            )}
            <p className="text-gray-400 text-sm">Top performers & ranking metrics for {selectedFY?.label}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportExcel}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-gold border border-gold/30 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center space-x-2 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 glow-btn"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2nd Place */}
        {top3[1] && (
          <div className="glass-card rounded-2xl p-6 border-t-4 border-slate-400/50 flex flex-col items-center text-center relative md:order-1 mt-6">
            <span className="text-4xl mb-2">🥈</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">2nd Rank</span>
            <h3 className="text-xl font-bold text-white mt-1">{top3[1].name}</h3>
            <p className="text-2xl font-extrabold text-gold mt-2">
              ₹{top3[1].total.toLocaleString('en-IN')}
            </p>
            <span className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full mt-2 font-semibold">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              +{top3[1].growth}% Growth
            </span>
          </div>
        )}

        {/* 1st Place */}
        {top3[0] && (
          <div className="glass-card rounded-2xl p-8 border-t-4 border-gold/75 flex flex-col items-center text-center relative md:order-2 shadow-2xl shadow-gold/5 transform scale-105">
            <div className="absolute -top-5 bg-gold text-dark-bg font-extrabold text-[10px] tracking-widest uppercase px-3 py-1 rounded-full shadow-lg shadow-gold/20">
              Top Contributor
            </div>
            <span className="text-5xl mb-2">🥇</span>
            <span className="text-xs font-bold text-gold uppercase tracking-widest">1st Rank</span>
            <h3 className="text-2xl font-bold text-white mt-1">{top3[0].name}</h3>
            <p className="text-3xl font-extrabold text-gold mt-2">
              ₹{top3[0].total.toLocaleString('en-IN')}
            </p>
            <span className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full mt-2 font-semibold">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              +{top3[0].growth}% Growth
            </span>
          </div>
        )}

        {/* 3rd Place */}
        {top3[2] && (
          <div className="glass-card rounded-2xl p-6 border-t-4 border-amber-600/50 flex flex-col items-center text-center relative md:order-3 mt-6">
            <span className="text-4xl mb-2">🥉</span>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">3rd Rank</span>
            <h3 className="text-xl font-bold text-white mt-1">{top3[2].name}</h3>
            <p className="text-2xl font-extrabold text-gold mt-2">
              ₹{top3[2].total.toLocaleString('en-IN')}
            </p>
            <span className="flex items-center text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full mt-2 font-semibold">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              +{top3[2].growth}% Growth
            </span>
          </div>
        )}
      </div>

      {/* Full Table Card */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Table Search & Controls */}
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <h3 className="text-lg font-bold text-white">Full Performance Directory</h3>
          <div className="relative w-full md:w-80">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or area..."
              className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gold transition-colors duration-200"
            />
          </div>
        </div>

        {/* Table content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/40 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-white/5">
                <th className="px-6 py-4 xl:px-4 xl:py-5 cursor-pointer hover:text-white xl:w-[8%]" onClick={() => handleSort('rank')}>
                  <div className="flex items-center space-x-1">
                    <span>Rank</span>
                    {sortField === 'rank' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-6 py-4 xl:px-4 xl:py-5 cursor-pointer hover:text-white xl:w-[52%]" onClick={() => handleSort('name')}>
                  <div className="flex items-center space-x-1">
                    <span>PRO Name</span>
                    {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-6 py-4 xl:px-4 xl:py-5 cursor-pointer hover:text-white xl:w-[25%]" onClick={() => handleSort('total')}>
                  <div className="flex items-center space-x-1 xl:justify-end">
                    <span>Total Collection</span>
                    {sortField === 'total' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-6 py-4 xl:px-4 xl:py-5 cursor-pointer hover:text-white xl:hidden" onClick={() => handleSort('growth')}>
                  <div className="flex items-center space-x-1">
                    <span>Growth %</span>
                    {sortField === 'growth' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-6 py-4 xl:px-4 xl:py-5 cursor-pointer hover:text-white xl:w-[15%]" onClick={() => handleSort('status')}>
                  <div className="flex items-center space-x-1 xl:justify-center">
                    <span>Status</span>
                    {sortField === 'status' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-6 py-4 xl:px-4 xl:py-5 text-right xl:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {currentItems.length > 0 ? (
                currentItems.map((p) => {
                  const isActiveContributor = p.status === 'active' && p.total > 0;
                  const isZeroContributor = p.status === 'active' && p.total === 0;

                  return (
                    <tr
                      key={p.proId}
                      className={`hover:bg-white/[0.02] transition-colors duration-150 ${
                        isActiveContributor ? 'border-l-4 border-l-emerald-500/50' : ''
                      } ${isZeroContributor ? 'border-l-4 border-l-rose-500/50 bg-rose-950/5' : ''}`}
                    >
                      <td className="px-6 py-4 xl:px-4 xl:py-5 font-semibold text-white align-middle xl:w-[8%]">
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
                      </td>
                      <td className="px-6 py-4 xl:px-4 xl:py-5 align-middle xl:w-[52%]">
                        <Link to={`/pro/${p.proId}`} className="font-semibold text-white hover:text-gold transition-colors duration-150 block truncate max-w-full xl:text-[19px] xl:font-bold">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 xl:px-4 xl:py-5 font-medium text-white align-middle xl:w-[25%] text-right xl:text-right xl:text-[21px] xl:font-extrabold xl:text-gold whitespace-nowrap">
                        ₹{p.total.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 xl:px-4 xl:py-5 align-middle xl:hidden">
                        <span className={`text-sm font-semibold ${p.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {p.growth >= 0 ? '+' : ''}{p.growth}%
                        </span>
                      </td>
                      <td className="px-6 py-4 xl:px-4 xl:py-5 align-middle xl:w-[15%] text-center xl:text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            p.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-gray-500/10 text-gray-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              p.status === 'active' ? 'bg-emerald-400' : 'bg-gray-400'
                            }`}
                          />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 xl:px-4 xl:py-5 text-right align-middle xl:hidden">
                        <Link
                          to={`/pro/${p.proId}`}
                          className="inline-flex items-center space-x-1.5 bg-premium-blue/30 hover:bg-premium-blue/50 text-gold border border-premium-light/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Profile</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400 text-sm xl:hidden">
                    No records match your criteria.
                  </td>
                  <td colSpan="4" className="hidden xl:table-cell px-6 py-8 text-center text-gray-400 text-sm">
                    No records match your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedList.length)} of{' '}
              {sortedList.length} contributors
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
              >
                Previous
              </button>
              {[...Array(totalPages)].map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    currentPage === idx + 1
                      ? 'bg-gold text-dark-bg'
                      : 'bg-slate-900 border border-white/10 text-gray-300 hover:bg-slate-800'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rankings;
