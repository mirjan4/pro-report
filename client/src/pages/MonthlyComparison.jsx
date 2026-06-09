import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import ReactECharts from 'echarts-for-react';
import {
  LineChart,
  Calendar,
  Users,
  Download,
  TrendingUp,
  TrendingDown,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Search,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Crown,
  ChevronDown,
  Check,
  Percent
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import AnimatedCounter from '../components/AnimatedCounter';

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];

const MonthlyComparison = () => {
  const { financialYears, selectedFY, selectedModule } = useApp();
  
  // States
  const [month, setMonth] = useState('April');
  const [selectedPros, setSelectedPros] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchRankings, setSearchRankings] = useState('');
  const [proDropdownOpen, setProDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Chart refs
  const cylinderChartRef = useRef(null);
  const lineChartRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch metrics when FY, Module, or Month changes
  const fetchData = async () => {
    if (!selectedFY?._id) return;
    setLoading(true);
    try {
      const moduleParam = selectedModule ? `&module=${selectedModule._id}` : '';
      const res = await client.get(
        `/api/analytics/monthly-comparison?financialYear=${selectedFY._id}&month=${month}${moduleParam}`
      );
      if (res.data.success) {
        setData(res.data.data);
        
        // Auto-select top 3 active PROs for the line chart if none are selected yet
        const trends = res.data.data.allProsTrend || [];
        if (selectedPros.length === 0 && trends.length > 0) {
          const defaultSelect = trends
            .filter(p => p.status === 'active')
            .slice(0, 3)
            .map(p => p.proId);
          setSelectedPros(defaultSelect);
        }
      }
    } catch (err) {
      console.error('Failed to load monthly comparison analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedFY, selectedModule, month]);

  // Handle month cycling
  const nextMonth = () => {
    const idx = MONTHS.indexOf(month);
    setMonth(MONTHS[(idx + 1) % 12]);
  };

  const prevMonth = () => {
    const idx = MONTHS.indexOf(month);
    setMonth(MONTHS[(idx - 1 + 12) % 12]);
  };

  // Toggle selected PRO for line chart
  const toggleProSelection = (proId) => {
    if (selectedPros.includes(proId)) {
      setSelectedPros(selectedPros.filter(id => id !== proId));
    } else {
      setSelectedPros([...selectedPros, proId]);
    }
  };

  // PNG Export
  const exportChartPNG = (chartRef, chartName) => {
    if (chartRef.current) {
      const echartsInstance = chartRef.current.getEchartsInstance();
      const url = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#0a0f1d'
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = `${chartName}_${month}_${selectedFY?.year}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Excel Export
  const exportExcel = () => {
    if (!data) return;

    // 1. Monthly Rankings sheet
    const rankingSheetData = data.rankings.map(r => ({
      Rank: r.rank,
      Name: r.name,
      Designation: r.designation,
      Area: r.area,
      [`Collection in ${data.selectedMonth} (INR)`]: r.amount,
      Status: r.status
    }));

    // 2. Winners sheet
    const winnersSheetData = data.monthlyWinners.map(w => ({
      Month: w.month,
      WinnerName: w.winner ? w.winner.name : 'No Collection',
      WinnerDesignation: w.winner ? w.winner.designation : '-',
      WinnerArea: w.winner ? w.winner.area : '-',
      WinnerCollectionAmount: w.winner ? w.winner.amount : 0
    }));

    // 3. Trends sheet
    const trendSheetData = data.allProsTrend
      .filter(p => selectedPros.includes(p.proId))
      .map(p => {
        const row = { Name: p.name, Designation: p.designation, Area: p.area };
        MONTHS.forEach(m => {
          row[m] = p.monthlyAmounts[m] || 0;
        });
        return row;
      });

    const workbook = XLSX.utils.book_new();

    const wsRankings = XLSX.utils.json_to_sheet(rankingSheetData);
    XLSX.utils.book_append_sheet(workbook, wsRankings, `${data.selectedMonth} Rankings`);

    const wsWinners = XLSX.utils.json_to_sheet(winnersSheetData);
    XLSX.utils.book_append_sheet(workbook, wsWinners, 'Monthly Best Performers');

    if (trendSheetData.length > 0) {
      const wsTrends = XLSX.utils.json_to_sheet(trendSheetData);
      XLSX.utils.book_append_sheet(workbook, wsTrends, 'PRO Trends');
    }

    XLSX.writeFile(workbook, `PRO_Monthly_Comparison_${data.selectedMonth}_${selectedFY?.year}.xlsx`);
  };

  // PDF Export
  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`PRO Monthly Analysis: ${data.selectedMonth} (${selectedFY?.label})`, 14, 15);

    doc.setFontSize(10);
    doc.text(`Module Scope: ${selectedModule?.name || 'All Modules'}`, 14, 21);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, 26);

    doc.setFontSize(12);
    doc.text('Growth Analysis Summary:', 14, 35);
    doc.setFontSize(9);
    doc.text(`- Current Month (${data.growthAnalysis.currentMonth}) Total: INR ${data.growthAnalysis.currentTotal.toLocaleString('en-IN')}`, 16, 42);
    doc.text(`- Previous Month (${data.growthAnalysis.prevMonth}) Total: INR ${data.growthAnalysis.prevTotal.toLocaleString('en-IN')}`, 16, 47);
    doc.text(`- Delta Index: INR ${data.growthAnalysis.diff.toLocaleString('en-IN')} (${data.growthAnalysis.pct >= 0 ? '+' : ''}${data.growthAnalysis.pct}%)`, 16, 52);

    doc.setFontSize(12);
    doc.text(`${data.selectedMonth} Performance Rankings (Top 10)`, 14, 62);

    const tableColumn = ['Rank', 'Name', 'Designation', 'Area', 'Collection (INR)', 'Status'];
    const tableRows = data.rankings.slice(0, 10).map(r => [
      r.rank,
      r.name,
      r.designation,
      r.area,
      r.amount.toLocaleString('en-IN'),
      r.status
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 67,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 27, 42] }
    });

    doc.addPage();
    doc.setFontSize(14);
    doc.text('Monthly Winners (Best Performers per Month)', 14, 15);

    const winnersColumn = ['Month', 'Winner Name', 'Designation', 'Area', 'Collection (INR)'];
    const winnersRows = data.monthlyWinners.map(w => [
      w.month,
      w.winner ? w.winner.name : 'No Collection',
      w.winner ? w.winner.designation : '-',
      w.winner ? w.winner.area : '-',
      w.winner ? w.winner.amount.toLocaleString('en-IN') : '0'
    ]);

    doc.autoTable({
      head: [winnersColumn],
      body: winnersRows,
      startY: 22,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 27, 42] }
    });

    doc.save(`PRO_Monthly_Comparison_${data.selectedMonth}_${selectedFY?.year}.pdf`);
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  // Filter rankings for Table Search
  const filteredRankings = data.rankings.filter(p =>
    p.name.toLowerCase().includes(searchRankings.toLowerCase()) ||
    p.area.toLowerCase().includes(searchRankings.toLowerCase())
  );

  // ECharts 3D Cylinder Bar Chart Option
  const barNames = data.rankings.map(r => r.name);
  const barValues = data.rankings.map(r => r.amount);

  const cylinderOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(10, 15, 29, 0.95)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (params) => {
        const val = params[0].value;
        return `
          <div class="p-1 font-sans">
            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${params[0].name}</p>
            <p class="text-sm font-extrabold text-gold mt-1">₹${val.toLocaleString('en-IN')}</p>
          </div>
        `;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: barNames,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { color: '#9ca3af', rotate: 35, fontSize: 10, interval: 0 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      axisLabel: { color: '#9ca3af', formatter: (v) => `₹${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v.toLocaleString('en-IN')}` }
    },
    series: [
      {
        name: 'Collection',
        type: 'bar',
        barWidth: 25,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(245, 197, 24, 0.75)' },
              { offset: 0.5, color: 'rgba(245, 197, 24, 1)' },
              { offset: 1, color: 'rgba(212, 175, 55, 0.75)' }
            ]
          }
        },
        data: barValues,
        z: 10
      },
      {
        name: 'Top Cap',
        type: 'pictorialBar',
        symbol: 'ellipse',
        symbolSize: [25, 8],
        symbolPosition: 'end',
        symbolOffset: [0, -4],
        data: barValues.map(v => (v > 0 ? v : 0)),
        z: 12,
        itemStyle: {
          color: '#fff',
          opacity: 0.9
        }
      },
      {
        name: 'Bottom Cap',
        type: 'pictorialBar',
        symbol: 'ellipse',
        symbolSize: [25, 8],
        symbolPosition: 'start',
        symbolOffset: [0, 4],
        data: barValues,
        z: 12,
        itemStyle: {
          color: 'rgba(212, 175, 55, 1)'
        }
      }
    ]
  };

  // ECharts Line Chart Option
  const trendsList = data.allProsTrend || [];
  const checkedPros = trendsList.filter(p => selectedPros.includes(p.proId));
  const lineColors = ['#f5c518', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];

  const lineSeries = checkedPros.map((pro, idx) => ({
    name: pro.name,
    type: 'line',
    smooth: true,
    showSymbol: true,
    symbolSize: 8,
    lineStyle: { width: 3, color: lineColors[idx % lineColors.length] },
    itemStyle: { color: lineColors[idx % lineColors.length] },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: lineColors[idx % lineColors.length] + '33' },
          { offset: 1, color: lineColors[idx % lineColors.length] + '00' }
        ]
      }
    },
    data: MONTHS.map(m => pro.monthlyAmounts[m] || 0)
  }));

  const trendOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 15, 29, 0.95)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 }
    },
    legend: {
      textStyle: { color: '#9ca3af', fontSize: 10 },
      data: checkedPros.map(p => p.name)
    },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: MONTHS,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { color: '#9ca3af', rotate: 25, fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      axisLabel: { color: '#9ca3af' }
    },
    series: lineSeries
  };

  const selectedMonthWinner = data.monthlyWinners.find(w => w.month === month)?.winner;

  return (
    <div className="p-6 space-y-6 animate-fadeIn pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-white">
            PRO Monthly <span className="gold-gradient-text">Comparison</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Conduct monthly collections relative rankings, multi-trend overlay, and dynamic growth analysis
          </p>
        </div>

        {/* Global actions */}
        <div className="flex space-x-3 shrink-0">
          <button
            onClick={exportExcel}
            className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-gold border border-gold/20 hover:border-gold/40 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center space-x-2 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 glow-btn cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="glass-card rounded-2xl p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 relative z-20">
        {/* Month Cycler */}
        <div className="flex items-center space-x-3 bg-[#0a0f1d]/60 border border-white/10 p-1.5 rounded-xl self-start md:self-auto">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-white/5 rounded-lg text-gold hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-32 text-center">
            <span className="text-sm font-bold text-white uppercase tracking-wider">{month}</span>
          </div>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-white/5 rounded-lg text-gold hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* PRO Trend Overlay Multi-Select Dropdown */}
        <div className="relative flex-1 max-w-sm" ref={dropdownRef}>
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
            Trend Chart overlay ({selectedPros.length} selected)
          </label>
          <button
            onClick={() => setProDropdownOpen(!proDropdownOpen)}
            className="w-full flex items-center justify-between bg-[#0a0f1d]/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none hover:border-gold/30 transition-all cursor-pointer"
          >
            <span className="truncate">
              {selectedPros.length === 0
                ? 'Select PRO Officers'
                : `${selectedPros.length} Officers Selected`}
            </span>
            <ChevronDown className="w-4 h-4 text-gold shrink-0" />
          </button>

          {proDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#0d1b2a] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar">
              {trendsList.map((p) => {
                const isSelected = selectedPros.includes(p.proId);
                return (
                  <button
                    key={p.proId}
                    onClick={() => toggleProSelection(p.proId)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-white/5 transition-all text-white border-b border-white/5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-gold border-gold text-dark-bg'
                            : 'border-white/20'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{p.area}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Indicators summary */}
        <div className="text-gray-500 hidden lg:flex items-center space-x-3 shrink-0">
          <LineChart className="w-6 h-6 text-gold/60" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            PRO Monthly Index Panel
          </span>
        </div>
      </div>

      {/* KPI Cards Row & Selected Winner */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Metric 1: Current Month Collections */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg border border-white/5 text-gold">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{month} Collection</p>
          <h3 className="text-3xl font-extrabold text-white mt-2">
            <AnimatedCounter value={data.growthAnalysis.currentTotal} formatAsCurrency={true} />
          </h3>
          <p className="text-xs text-gray-500 mt-2">Total batch collections</p>
        </div>

        {/* Metric 2: Previous Month Collections */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg border border-white/5 text-gray-400">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{data.growthAnalysis.prevMonth} Total</p>
          <h3 className="text-3xl font-extrabold text-white/80 mt-2">
            <AnimatedCounter value={data.growthAnalysis.prevTotal} formatAsCurrency={true} />
          </h3>
          <p className="text-xs text-gray-500 mt-2">Previous comparison baseline</p>
        </div>

        {/* Metric 3: Growth Index */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div
            className={`absolute right-4 top-4 p-2 rounded-lg border text-sm font-bold flex items-center gap-0.5 ${
              data.growthAnalysis.pct >= 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>{data.growthAnalysis.pct >= 0 ? '+' : ''}{data.growthAnalysis.pct}%</span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Growth Index</p>
          <h3
            className={`text-3xl font-extrabold mt-2 ${
              data.growthAnalysis.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            <AnimatedCounter
              value={data.growthAnalysis.diff}
              formatAsCurrency={true}
              prefix={data.growthAnalysis.diff >= 0 ? '+' : ''}
            />
          </h3>
          <p className="text-xs text-gray-500 mt-2">Growth difference</p>
        </div>

        {/* Selected Month's Best Performer */}
        <div className="glass-card rounded-2xl p-6 relative bg-gradient-to-br from-[#0c1b2a] to-gold/5 border-gold/15">
          <div className="absolute right-4 top-4 p-1.5 bg-gold/10 border border-gold/25 rounded-lg text-gold animate-pulse">
            <Crown className="w-5 h-5" />
          </div>
          <p className="text-xs font-extrabold text-gold uppercase tracking-widest flex items-center gap-1">
            {month} Best Performer
          </p>
          {selectedMonthWinner ? (
            <div className="mt-2">
              <h4 className="text-xl font-bold text-white truncate">{selectedMonthWinner.name}</h4>
              <p className="text-xs text-gray-400">{selectedMonthWinner.designation} • {selectedMonthWinner.area}</p>
              <span className="inline-block mt-2 text-sm font-extrabold text-gold">
                ₹{selectedMonthWinner.amount.toLocaleString('en-IN')}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-4 font-semibold italic">No data recorded</p>
          )}
        </div>
      </div>

      {/* Dynamic Charts — Full Width Single Column */}
      <div className="flex flex-col gap-6">
        {/* Monthly Comparison cylinder chart — Full Width */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-gold" />
              {month} Collection Breakdown
            </h3>
            <button
              onClick={() => exportChartPNG(cylinderChartRef, 'Cylinder_Chart')}
              className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Download PNG Chart"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
          <div style={{ height: '500px' }} className="relative w-full">
            {barValues.length > 0 ? (
              <ReactECharts
                ref={cylinderChartRef}
                option={cylinderOption}
                style={{ width: '100%', height: '100%' }}
                theme="dark-theme"
                notMerge={true}
                lazyUpdate={true}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 italic">
                No collections reported this month
              </div>
            )}
          </div>
        </div>

        {/* Multi-PRO line chart trend — Full Width */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center">
              <LineChart className="w-5 h-5 mr-2 text-gold" />
              PRO Performance Trends Overlay
            </h3>
            <button
              onClick={() => exportChartPNG(lineChartRef, 'Trends_Overlay_Chart')}
              className="p-1.5 hover:bg-white/5 border border-white/5 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Download PNG Chart"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
          <div style={{ height: '500px' }} className="relative w-full">
            {selectedPros.length > 0 ? (
              <ReactECharts
                ref={lineChartRef}
                option={trendOption}
                style={{ width: '100%', height: '100%' }}
                theme="dark-theme"
                notMerge={true}
                lazyUpdate={true}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 italic">
                Select one or more PRO officers from overlay dropdown to display trends
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Winners Horizontal Carousel */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <Crown className="w-5 h-5 mr-2 text-gold" />
          Financial Year Monthly Winners
        </h3>
        <div className="flex overflow-x-auto space-x-4 pb-2 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
          {data.monthlyWinners.map((w, index) => (
            <div
              key={index}
              className={`min-w-[200px] flex-1 glass-card rounded-xl p-4 flex flex-col justify-between border ${
                w.month === month
                  ? 'border-gold/30 bg-gold/5 shadow-md shadow-gold/5 scale-[1.01]'
                  : 'border-white/5 bg-[#0a0f1d]/20'
              } transition-all duration-300`}
            >
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-gray-500 block mb-1">
                  {w.month}
                </span>
                {w.winner ? (
                  <>
                    <h4 className="font-bold text-sm text-white truncate">{w.winner.name}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{w.winner.area}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 italic mt-1 font-semibold">No entries</p>
                )}
              </div>
              {w.winner && (
                <span className="text-xs font-extrabold text-gold mt-3 block">
                  ₹{w.winner.amount.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Table Rankings */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 mb-6">
          <h3 className="text-lg font-bold text-white flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-gold" />
            {month} Rankings Table
          </h3>
          <div className="relative w-full md:w-80">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchRankings}
              onChange={(e) => setSearchRankings(e.target.value)}
              placeholder="Search rankings by name or area..."
              className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-gold transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-xs font-bold uppercase border-b border-white/10">
                <th className="p-4 w-20 text-center">Rank</th>
                <th className="p-4">Name</th>
                <th className="p-4 text-right">Collection Amount</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-gray-300">
              {filteredRankings.length > 0 ? (
                filteredRankings.map((pro) => (
                  <tr key={pro.proId} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-center font-bold">
                      {pro.amount > 0 ? (
                        pro.rank <= 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold/10 text-gold text-xs font-extrabold border border-gold/30">
                            {pro.rank}
                          </span>
                        ) : (
                          pro.rank
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-4 font-bold text-white">{pro.name}</td>
                    <td className="p-4 text-right font-extrabold text-white">
                      ₹{pro.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          pro.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {pro.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500 italic">
                    No matching rankings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyComparison;
