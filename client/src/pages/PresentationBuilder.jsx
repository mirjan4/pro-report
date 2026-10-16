import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import {
  Presentation, Play, Download, Save, Trash2, Edit, Check, X, Plus,
  Settings, Layers, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Calendar, Clock, Lock, Globe, Share2, Copy, BarChart3, LineChart as LineChartIcon,
  PieChart, Users, Award, Sparkles, HeartHandshake, Eye, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, RefreshCw, Filter, Search, Maximize2, Minimize2,
  FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight,
  BarChart2, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import pptxgen from 'pptxgenjs';

// Currency & formatting helpers
const formatRupee = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  return '₹' + Math.round(Number(val)).toLocaleString('en-IN');
};

const formatRupeeShort = (val) => {
  const num = Number(val || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`;
  return `₹${Math.round(num)}`;
};

// Available Duration Presets
const DURATION_PRESETS = [
  { id: 'thisMonth', label: 'This Month', desc: 'Current active calendar month' },
  { id: 'prevMonth', label: 'Previous Month', desc: 'Most recently closed month' },
  { id: 'last3Months', label: 'Last 3 Months', desc: 'Recent quarter performance' },
  { id: 'last6Months', label: 'Last 6 Months', desc: 'Half-yearly performance' },
  { id: 'last12Months', label: 'Last 12 Months', desc: 'Full rolling year' },
  { id: 'financialYear', label: 'Financial Year', desc: 'April to March fiscal cycle' },
  { id: 'custom', label: 'Custom Date Range', desc: 'Specific start & end dates' }
];

// Custom Recharts Tooltip Component
const CustomRupeeTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0D1B2A] border border-[#F5C518]/30 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
        <p className="font-bold text-[#F5C518] mb-1.5">{label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-gray-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              {entry.name}:
            </span>
            <span className="font-bold text-white font-mono">
              {typeof entry.value === 'number' && entry.name.toLowerCase().includes('%')
                ? `${entry.value.toFixed(1)}%`
                : formatRupee(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const PresentationBuilder = () => {
  const { financialYears, selectedFY, modules } = useApp();

  // Core Reporting Duration & Filter State
  const [periodType, setPeriodType] = useState('last6Months');
  const [customRange, setCustomRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [fySelection, setFySelection] = useState('all');
  const [moduleSelection, setModuleSelection] = useState('all');
  const [proFilter, setProFilter] = useState('all');

  // Interactive View Modes: 'dashboard' | 'presentation' | 'table' | 'saved'
  const [activeView, setActiveView] = useState('dashboard');
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'line' for PRO individual graphs
  const [proSearchQuery, setProSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rank'); // 'rank', 'collection_desc', 'collection_asc', 'growth_desc', 'name'

  // Analytics Compilation Data State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Presentation Deck State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportingPPTX, setExportingPPTX] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const presentationContainerRef = useRef(null);

  // Saved Presentations Management State
  const [savedPresentations, setSavedPresentations] = useState([]);
  const [savingDeck, setSavingDeck] = useState(false);
  const [deckTitle, setDeckTitle] = useState('MARKAZ Takaful Collection Report');
  const [copySuccessId, setCopySuccessId] = useState(null);

  // Sync Financial Year default from context
  useEffect(() => {
    if (selectedFY && selectedFY._id !== 'all' && selectedFY.year) {
      setFySelection(selectedFY.year);
    }
  }, [selectedFY]);

  // Primary Data Fetcher: Re-runs whenever duration or filters change
  const fetchAnalyticsData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const payload = {
        periodType,
        customRange: periodType === 'custom' ? customRange : undefined,
        financialYear: periodType === 'financialYear' ? fySelection : undefined,
        module: moduleSelection !== 'all' ? moduleSelection : undefined,
        pro: proFilter !== 'all' ? proFilter : undefined
      };

      const res = await client.post('/api/presentations/preview-data', payload);
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to fetch analytics data');
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load collection records from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [periodType, fySelection, moduleSelection, proFilter]);

  // Manual Trigger for Custom Date Range change
  const handleApplyCustomRange = () => {
    if (periodType === 'custom') {
      fetchAnalyticsData();
    }
  };

  // Fetch Saved Decks
  const fetchSavedPresentations = async () => {
    try {
      const res = await client.get('/api/presentations');
      if (res.data?.success) {
        setSavedPresentations(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load saved presentations', err);
    }
  };

  useEffect(() => {
    if (activeView === 'saved') {
      fetchSavedPresentations();
    }
  }, [activeView]);

  // Filtered and Sorted PRO Analytics for Cards & Table
  const filteredPros = useMemo(() => {
    if (!data?.proAnalytics) return [];
    let list = [...data.proAnalytics];

    // Filter by search query
    if (proSearchQuery.trim()) {
      const q = proSearchQuery.toLowerCase().trim();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.proId && String(p.proId).toLowerCase().includes(q)) ||
        (p.area && p.area.toLowerCase().includes(q))
      );
    }

    // Sort PROs
    list.sort((a, b) => {
      if (sortBy === 'rank') return a.rank - b.rank;
      if (sortBy === 'collection_desc') return b.totalCollection - a.totalCollection;
      if (sortBy === 'collection_asc') return a.totalCollection - b.totalCollection;
      if (sortBy === 'growth_desc') {
        const ga = a.growthPct !== null ? a.growthPct : -999;
        const gb = b.growthPct !== null ? b.growthPct : -999;
        return gb - ga;
      }
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

    return list;
  }, [data, proSearchQuery, sortBy]);

  // Dynamic Slides Generation: Adapts automatically to selected duration & PRO count
  const presentationSlides = useMemo(() => {
    if (!data) return [];

    const slides = [
      { id: 'cover', type: 'cover', title: 'MARKAZ Takaful Collection Presentation' },
      { id: 'executive_summary', type: 'summary', title: 'Executive Performance Summary' },
      { id: 'monthly_comparison', type: 'comparison', title: 'Month-on-Month Collection Analysis' },
      { id: 'top_10_pros', type: 'top10', title: 'Top 10 PRO Contributors' }
    ];

    // A separate slide for EVERY PRO in database
    (data.proAnalytics || []).forEach((pro) => {
      slides.push({
        id: `pro_${pro.proId}`,
        type: 'individual_pro',
        title: `PRO Performance: ${pro.name}`,
        proData: pro
      });
    });

    slides.push({ id: 'growth_movers', type: 'movers', title: 'Growth & Decline Analysis' });
    slides.push({ id: 'observations', type: 'observations', title: 'Key Observations & Strategic Insights' });

    return slides;
  }, [data]);

  // Slide Navigation Handlers
  const nextSlide = () => {
    setCurrentSlideIndex(prev => Math.min(prev + 1, presentationSlides.length - 1));
  };

  const prevSlide = () => {
    setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
  };

  // Keyboard Navigation for Presentation View
  useEffect(() => {
    if (activeView !== 'presentation') return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, presentationSlides.length, isFullscreen]);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      const el = presentationContainerRef.current || document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // PPTX Presentation Exporter using pptxgenjs
  const handleExportPPTX = async () => {
    if (!data) return;
    setExportingPPTX(true);

    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = 'MARKAZ Takaful';
      pptx.company = 'MARKAZ Takaful Management';
      pptx.title = `Takaful PRO Collection Dashboard - ${data.duration?.periodLabel}`;

      const BG_COLOR = '0D1B2A';
      const CARD_BG = '1E293B';
      const GOLD = 'F5C518';
      const TEAL = '00A896';
      const WHITE = 'FFFFFF';
      const GRAY = '94A3B8';

      // 1. Cover Slide
      const slide1 = pptx.addSlide();
      slide1.background = { color: BG_COLOR };
      slide1.addText('MARKAZ TAKAFUL', {
        x: 0.8, y: 1.5, w: 8.5, h: 0.5,
        fontSize: 16, color: GOLD, bold: true, letterSpacing: 3
      });
      slide1.addText('PRO Collection Analytics & Presentation Dashboard', {
        x: 0.8, y: 2.1, w: 8.5, h: 1.2,
        fontSize: 32, color: WHITE, bold: true
      });
      slide1.addText(`Reporting Period: ${data.duration?.periodLabel || 'All Periods'}`, {
        x: 0.8, y: 3.5, w: 8.5, h: 0.5,
        fontSize: 16, color: TEAL, bold: true
      });
      slide1.addText(`Total Collections: ${formatRupee(data.summary?.totalCollection)}  •  Active PROs: ${data.summary?.activePros}  •  Contributing PROs: ${data.summary?.contributingPros}`, {
        x: 0.8, y: 4.2, w: 8.5, h: 0.5,
        fontSize: 13, color: GRAY
      });
      slide1.addText(`Generated: ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric', day: 'numeric' })}`, {
        x: 0.8, y: 6.2, w: 8.5, h: 0.4,
        fontSize: 11, color: GRAY
      });

      // 2. Executive Summary Slide
      const slide2 = pptx.addSlide();
      slide2.background = { color: BG_COLOR };
      slide2.addText('EXECUTIVE SUMMARY', { x: 0.8, y: 0.6, fontSize: 13, color: GOLD, bold: true, letterSpacing: 2 });
      slide2.addText(`Collection Performance Overview — ${data.duration?.periodLabel}`, { x: 0.8, y: 1.0, fontSize: 22, color: WHITE, bold: true });

      const kpis = [
        { label: 'Total Collection', val: formatRupee(data.summary?.totalCollection), sub: `${data.duration?.numMonths} Months Duration` },
        { label: 'Monthly Average', val: formatRupee(data.summary?.avgMonthlyCollection), sub: 'Average per month' },
        { label: 'Active PROs', val: `${data.summary?.contributingPros} / ${data.summary?.activePros}`, sub: 'PROs Contributing' },
        { label: 'Highest Month', val: data.summary?.highestMonth?.label || 'N/A', sub: formatRupee(data.summary?.highestMonth?.amount) },
        { label: 'Top PRO Contributor', val: data.summary?.topPro?.name || 'N/A', sub: `${data.summary?.topPro?.pct}% Contribution` },
        { label: 'Period Growth', val: data.summary?.growthText || 'N/A', sub: `vs ${data.duration?.prevPeriodLabel || 'Prior'}` }
      ];

      kpis.forEach((kpi, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const x = 0.8 + col * 2.8;
        const y = 1.8 + row * 1.5;

        slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x, y, w: 2.6, h: 1.3,
          fill: { color: CARD_BG }, line: { color: '334155', width: 1 }, rectRadius: 0.1
        });
        slide2.addText(kpi.label, { x: x + 0.15, y: y + 0.15, w: 2.3, h: 0.25, fontSize: 10, color: GRAY, bold: true });
        slide2.addText(kpi.val, { x: x + 0.15, y: y + 0.45, w: 2.3, h: 0.45, fontSize: 18, color: GOLD, bold: true });
        slide2.addText(kpi.sub, { x: x + 0.15, y: y + 0.95, w: 2.3, h: 0.25, fontSize: 9, color: TEAL });
      });

      // 3. Month-on-Month Collection Analysis Slide (Top KPI Cards + Native Bar Chart + Single-Column Combined Table)
      const slide3 = pptx.addSlide();
      slide3.background = { color: BG_COLOR };
      slide3.addText('MONTH-ON-MONTH COLLECTION ANALYSIS', {
        x: 0.6, y: 0.35, w: 9.0, h: 0.45,
        fontSize: 22, color: WHITE, bold: true
      });
      slide3.addText(`Overall collection trends & growth rates • ${data.duration?.periodLabel || 'Reporting Period'}`, {
        x: 0.6, y: 0.75, w: 9.0, h: 0.25,
        fontSize: 9.5, color: GRAY
      });

      // 4 KPI Cards across top
      const summaryKpis = [
        { label: 'TOTAL COLLECTION', val: formatRupee(data.summary?.totalCollection) },
        { label: 'MONTHLY AVERAGE', val: formatRupee(data.summary?.avgMonthlyCollection) },
        { label: 'HIGHEST MONTH', val: data.summary?.highestMonth?.label || 'N/A' },
        { label: 'HIGHEST COLLECTION', val: formatRupee(data.summary?.highestMonth?.amount) }
      ];

      summaryKpis.forEach((sk, idx) => {
        const x = 0.6 + idx * 2.25;
        slide3.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x, y: 1.05, w: 2.15, h: 0.85,
          fill: { color: CARD_BG }, line: { color: '334155', width: 1 }, rectRadius: 0.08
        });
        slide3.addText(sk.label, { x: x + 0.1, y: 1.12, w: 1.95, h: 0.2, fontSize: 7.5, color: TEAL, bold: true });
        slide3.addText(sk.val, { x: x + 0.1, y: 1.35, w: 1.95, h: 0.45, fontSize: 13, color: WHITE, bold: true });
      });

      // Left: Native Bar Chart with Values Above Each Bar
      const trendMonths = (data.monthlyTrends || []).map(m => m.label || m.month || '');
      const trendVals = (data.monthlyTrends || []).map(m => Number(m.total || 0));

      if (trendMonths.length > 0) {
        slide3.addChart(pptx.charts.BAR, [
          {
            name: 'Total Collection',
            labels: trendMonths,
            values: trendVals
          }
        ], {
          x: 0.6,
          y: 2.05,
          w: 5.5,
          h: 3.2,
          barDir: 'col',
          showTitle: true,
          title: 'Monthly Collection Trend',
          titleColor: GOLD,
          titleFontSize: 11,
          showValue: true,
          dataLabelColor: WHITE,
          dataLabelFontSize: 7.5,
          dataLabelPosition: 'outEnd',
          chartColors: ['00A896', '3B82F6', '10B981', '8B5CF6', '06B6D4', 'F59E0B', 'EC4899', 'F43F5E', '6366F1', '14B8A6', 'EAB308', 'EF4444'],
          valAxisHidden: false,
          catAxisLabelColor: GRAY,
          catAxisLabelFontSize: 8,
          valAxisLabelColor: GRAY,
          valAxisLabelFontSize: 7.5,
          catGridLine: { style: 'none' },
          valGridLine: { color: '334155', size: 0.5 }
        });
      }

      // Right: Breakdown Table (Only Month and Takaful + Additional in ONE column, plus MoM Growth)
      slide3.addText('MONTHLY BREAKDOWN', {
        x: 6.3, y: 2.05, w: 3.3, h: 0.25,
        fontSize: 10, color: GOLD, bold: true, letterSpacing: 1
      });

      const trendRows = [
        [
          { text: 'Month', options: { bold: true, fill: '1E3A8A', color: WHITE, fontSize: 8.5 } },
          { text: 'Collection (₹)', options: { bold: true, fill: '1E3A8A', color: GOLD, align: 'right', fontSize: 8.5 } },
          { text: 'Growth', options: { bold: true, fill: '1E3A8A', color: WHITE, align: 'right', fontSize: 8.5 } }
        ]
      ];

      (data.monthlyTrends || []).forEach(m => {
        trendRows.push([
          { text: m.label || m.month || '', options: { color: WHITE, fontSize: 8 } },
          { text: formatRupee(m.total), options: { color: TEAL, bold: true, align: 'right', fontSize: 8 } },
          { text: m.momGrowthText || (m.momGrowth !== null && m.momGrowth !== undefined ? `${m.momGrowth > 0 ? '+' : ''}${m.momGrowth}%` : '—'), options: { color: (m.momGrowthPct || m.momGrowth) > 0 ? TEAL : ((m.momGrowthPct || m.momGrowth) < 0 ? 'EF4444' : GRAY), align: 'right', fontSize: 8 } }
        ]);
      });

      slide3.addTable(trendRows, {
        x: 6.3, y: 2.35, w: 3.3,
        fill: { color: CARD_BG },
        border: { color: '334155', pt: 0.5 }
      });

      slide3.addText(`Total: ${formatRupee(data.summary?.totalCollection)}  •  Avg: ${formatRupee(data.summary?.avgMonthlyCollection)}/mo`, {
        x: 6.3, y: 5.15, w: 3.3, h: 0.25,
        fontSize: 8.5, color: GRAY
      });

      // 4. Top 10 PRO Contributors Slide (Top KPI Cards + Native Bar Chart + Single-Column Table)
      const slide4 = pptx.addSlide();
      slide4.background = { color: BG_COLOR };
      slide4.addText('TOP 10 PRO CONTRIBUTORS', {
        x: 0.6, y: 0.35, w: 9.0, h: 0.45,
        fontSize: 22, color: WHITE, bold: true
      });
      slide4.addText(`Leading Collection Performance & Share • ${data.duration?.periodLabel || 'Reporting Period'}`, {
        x: 0.6, y: 0.75, w: 9.0, h: 0.25,
        fontSize: 9.5, color: GRAY
      });

      const top10List = data.top10Pros || [];
      const top10Total = top10List.reduce((sum, p) => sum + (p.totalCollection || 0), 0);
      const top10Pct = data.summary?.totalCollection > 0
        ? ((top10Total / data.summary.totalCollection) * 100).toFixed(1)
        : '0.0';
      const top1Pro = top10List[0] || { name: 'None', totalCollection: 0 };

      // 4 KPI Cards across top
      const top10Kpis = [
        { label: 'TOP 10 TOTAL', val: formatRupee(top10Total) },
        { label: 'COLLECTION SHARE', val: `${top10Pct}%` },
        { label: '#1 CONTRIBUTOR', val: top1Pro.name || 'N/A' },
        { label: '#1 COLLECTION', val: formatRupee(top1Pro.totalCollection) }
      ];

      top10Kpis.forEach((tk, idx) => {
        const x = 0.6 + idx * 2.25;
        slide4.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x, y: 1.05, w: 2.15, h: 0.85,
          fill: { color: CARD_BG }, line: { color: '334155', width: 1 }, rectRadius: 0.08
        });
        slide4.addText(tk.label, { x: x + 0.1, y: 1.12, w: 1.95, h: 0.2, fontSize: 7.5, color: TEAL, bold: true });
        slide4.addText(tk.val, { x: x + 0.1, y: 1.35, w: 1.95, h: 0.45, fontSize: 13, color: WHITE, bold: true });
      });

      // Left: Native Bar Chart with Values on Each Bar
      const proNames = top10List.map(p => (p.name.length > 14 ? p.name.substring(0, 13) + '..' : p.name));
      const proTotals = top10List.map(p => Number(p.totalCollection || 0));

      if (proNames.length > 0) {
        slide4.addChart(pptx.charts.BAR, [
          {
            name: 'Total Collection',
            labels: proNames,
            values: proTotals
          }
        ], {
          x: 0.6,
          y: 2.05,
          w: 5.2,
          h: 3.2,
          barDir: 'col',
          showTitle: true,
          title: 'Top 10 Collections by PRO',
          titleColor: GOLD,
          titleFontSize: 11,
          showValue: true,
          dataLabelColor: WHITE,
          dataLabelFontSize: 7,
          dataLabelPosition: 'outEnd',
          chartColors: ['F5C518', '00A896', '3B82F6', '10B981', '8B5CF6', '06B6D4', 'F59E0B', 'EC4899', 'F43F5E', '6366F1'],
          valAxisHidden: false,
          catAxisLabelColor: GRAY,
          catAxisLabelFontSize: 7.5,
          valAxisLabelColor: GRAY,
          valAxisLabelFontSize: 7.5,
          catGridLine: { style: 'none' },
          valGridLine: { color: '334155', size: 0.5 }
        });
      }

      // Right: Breakdown Table (Only Rank, Name, Collection in ONE column, and Share)
      slide4.addText('CONTRIBUTORS RANKING', {
        x: 6.0, y: 2.05, w: 3.6, h: 0.25,
        fontSize: 10, color: GOLD, bold: true, letterSpacing: 1
      });

      const top10Rows = [
        [
          { text: 'Rank', options: { bold: true, fill: '1E3A8A', color: GOLD, fontSize: 8 } },
          { text: 'PRO Officer', options: { bold: true, fill: '1E3A8A', color: WHITE, fontSize: 8 } },
          { text: 'Collection (₹)', options: { bold: true, fill: '1E3A8A', color: GOLD, align: 'right', fontSize: 8 } },
          { text: 'Share', options: { bold: true, fill: '1E3A8A', color: TEAL, align: 'right', fontSize: 8 } }
        ]
      ];

      top10List.forEach(p => {
        top10Rows.push([
          { text: `#${p.rank}`, options: { color: GOLD, bold: true, fontSize: 7.5 } },
          { text: p.name.length > 18 ? p.name.substring(0, 17) + '..' : p.name, options: { color: WHITE, bold: true, fontSize: 7.5 } },
          { text: formatRupee(p.totalCollection), options: { color: TEAL, bold: true, align: 'right', fontSize: 7.5 } },
          { text: `${p.contributionPct}%`, options: { color: WHITE, align: 'right', fontSize: 7.5 } }
        ]);
      });

      slide4.addTable(top10Rows, {
        x: 6.0, y: 2.35, w: 3.6,
        fill: { color: CARD_BG },
        border: { color: '334155', pt: 0.5 }
      });

      slide4.addText(`Top 10 Total: ${formatRupee(top10Total)}  •  Share: ${top10Pct}% of collections`, {
        x: 6.0, y: 5.15, w: 3.6, h: 0.25,
        fontSize: 8, color: GRAY
      });

      // 5. Individual PRO Slides: ONE SLIDE FOR EVERY PRO IN DATABASE
      (data.proAnalytics || []).forEach((pro) => {
        const proSlide = pptx.addSlide();
        proSlide.background = { color: BG_COLOR };

        // 1. PRO Header
        proSlide.addText(pro.name.toUpperCase(), {
          x: 0.6, y: 0.35, w: 9.0, h: 0.45,
          fontSize: 22, color: WHITE, bold: true
        });
        proSlide.addText(`Individual collection trend • ${data.duration?.periodLabel || 'Reporting Period'}`, {
          x: 0.6, y: 0.75, w: 9.0, h: 0.3,
          fontSize: 9.5, color: GRAY
        });

        // 2. 4 KPI Cards across top
        const proKpis = [
          { label: 'TOTAL COLLECTION', val: formatRupee(pro.totalCollection) },
          { label: 'MONTHLY AVERAGE', val: formatRupee(pro.avgMonthly) },
          { label: 'HIGHEST MONTH', val: pro.highestMonth?.label || 'N/A' },
          { label: 'HIGHEST COLLECTION', val: formatRupee(pro.highestMonth?.amount) }
        ];

        proKpis.forEach((pk, idx) => {
          const x = 0.6 + idx * 2.25;
          proSlide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x, y: 1.05, w: 2.15, h: 0.85,
            fill: { color: CARD_BG }, line: { color: '334155', width: 1 }, rectRadius: 0.08
          });
          proSlide.addText(pk.label, { x: x + 0.1, y: 1.12, w: 1.95, h: 0.2, fontSize: 7.5, color: TEAL, bold: true });
          proSlide.addText(pk.val, { x: x + 0.1, y: 1.35, w: 1.95, h: 0.45, fontSize: 13, color: WHITE, bold: true });
        });

        // 3. Left Side: NATIVE POWERPOINT BAR CHART
        const chartMonths = (pro.monthlyData || []).map(m => m.label || m.month || '');
        const chartValues = (pro.monthlyData || []).map(m => Number(m.total !== undefined ? m.total : (m.amount || 0)));

        if (chartMonths.length > 0) {
          const isLine = chartType === 'line';
          proSlide.addChart(isLine ? pptx.charts.LINE : pptx.charts.BAR, [
            {
              name: 'Monthly Collection',
              labels: chartMonths,
              values: chartValues
            }
          ], {
            x: 0.6,
            y: 2.05,
            w: 5.5,
            h: 3.2,
            barDir: 'col',
            showTitle: true,
            title: 'Monthly Collection',
            titleColor: GOLD,
            titleFontSize: 11,
            showValue: true,
            dataLabelColor: WHITE,
            dataLabelFontSize: 7.5,
            dataLabelPosition: isLine ? 'top' : 'outEnd',
            chartColors: isLine ? ['00A896'] : ['3B82F6', 'EF4444', '10B981', '8B5CF6', '06B6D4', 'F59E0B', '00A896', 'EC4899', 'F43F5E', '6366F1', '14B8A6', 'EAB308'],
            lineSize: 2.5,
            lineDataSymbol: 'circle',
            lineDataSymbolSize: 6,
            valAxisHidden: false,
            catAxisLabelColor: GRAY,
            catAxisLabelFontSize: 8,
            valAxisLabelColor: GRAY,
            valAxisLabelFontSize: 7.5,
            catGridLine: { style: 'none' },
            valGridLine: { color: '334155', size: 0.5 }
          });
        }

        // 4. Right Side: MONTHLY BREAKDOWN TABLE (Only Month and Takaful + Additional in ONE column!)
        proSlide.addText('MONTHLY BREAKDOWN', {
          x: 6.3, y: 2.05, w: 3.3, h: 0.25,
          fontSize: 10, color: GOLD, bold: true, letterSpacing: 1
        });

        const proMonthRows = [
          [
            { text: 'Month', options: { bold: true, fill: '1E3A8A', color: WHITE, fontSize: 8.5 } },
            { text: 'Collection (₹)', options: { bold: true, fill: '1E3A8A', color: GOLD, align: 'right', fontSize: 8.5 } }
          ]
        ];

        (pro.monthlyData || []).forEach(pm => {
          const tot = Number(pm.total !== undefined ? pm.total : (pm.amount || 0));
          proMonthRows.push([
            { text: pm.label || pm.month || '', options: { color: WHITE, fontSize: 8 } },
            { text: formatRupee(tot), options: { color: TEAL, bold: true, align: 'right', fontSize: 8 } }
          ]);
        });

        proSlide.addTable(proMonthRows, {
          x: 6.3, y: 2.35, w: 3.3,
          fill: { color: CARD_BG },
          border: { color: '334155', pt: 0.5 }
        });

        proSlide.addText(`Rank by total: #${pro.rank}  •  Contribution: ${pro.contributionPct}%`, {
          x: 6.3, y: 5.15, w: 3.3, h: 0.25,
          fontSize: 8.5, color: GRAY
        });
      });

      // 6. Growth Movers Slide
      const slideMovers = pptx.addSlide();
      slideMovers.background = { color: BG_COLOR };
      slideMovers.addText('GROWTH & DECLINE ANALYSIS', { x: 0.8, y: 0.6, fontSize: 13, color: GOLD, bold: true, letterSpacing: 2 });
      slideMovers.addText(`Comparison vs Previous Equivalent Period (${data.duration?.prevPeriodLabel || 'Prior'})`, {
        x: 0.8, y: 1.0, fontSize: 20, color: WHITE, bold: true
      });

      const gainers = (data.growthMovers?.topGainers || []).slice(0, 5);
      const decliners = (data.growthMovers?.topDecliners || []).slice(0, 5);

      const moverRows = [
        [
          { text: 'Top Gainers (Growth %)', options: { bold: true, fill: '065F46', color: WHITE } },
          { text: 'Prior Collection', options: { bold: true, fill: '065F46', color: WHITE, align: 'right' } },
          { text: 'Current Collection', options: { bold: true, fill: '065F46', color: WHITE, align: 'right' } },
          { text: 'Growth', options: { bold: true, fill: '065F46', color: GOLD, align: 'right' } }
        ]
      ];

      gainers.forEach(g => {
        moverRows.push([
          { text: g.name, options: { color: WHITE, bold: true } },
          { text: formatRupee(g.prevTotal), options: { color: GRAY, align: 'right' } },
          { text: formatRupee(g.totalCollection), options: { color: WHITE, align: 'right' } },
          { text: g.growthText, options: { color: TEAL, bold: true, align: 'right' } }
        ]);
      });

      slideMovers.addTable(moverRows, {
        x: 0.8, y: 1.8, w: 8.4,
        fill: { color: CARD_BG },
        border: { color: '334155', pt: 0.5 },
        fontSize: 9
      });

      // 7. Key Observations Slide
      const slideObs = pptx.addSlide();
      slideObs.background = { color: BG_COLOR };
      slideObs.addText('STRATEGIC OBSERVATIONS & SUMMARY', { x: 0.8, y: 0.6, fontSize: 13, color: GOLD, bold: true, letterSpacing: 2 });
      slideObs.addText(`Key Insights for Management Review`, { x: 0.8, y: 1.0, fontSize: 22, color: WHITE, bold: true });

      const obsList = data.observations || [];
      obsList.forEach((obs, idx) => {
        slideObs.addShape(pptx.shapes.OVAL, {
          x: 0.8, y: 1.8 + idx * 0.7 + 0.08, w: 0.12, h: 0.12,
          fill: { color: GOLD }
        });
        slideObs.addText(obs, {
          x: 1.1, y: 1.8 + idx * 0.7, w: 8.0, h: 0.6,
          fontSize: 13, color: WHITE, bold: false
        });
      });

      slideObs.addText('MARKAZ Takaful — Strategic Planning & PRO Performance Directorate', {
        x: 0.8, y: 6.3, fontSize: 11, color: GRAY
      });

      // Save PPTX File
      const safeDurationName = (data.duration?.periodLabel || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await pptx.writeFile({ fileName: `MARKAZ_Takaful_PRO_Presentation_${safeDurationName}.pptx` });
    } catch (err) {
      console.error('PPTX export error:', err);
      alert('Failed to export PowerPoint presentation: ' + (err?.message || err));
    } finally {
      setExportingPPTX(false);
    }
  };

  // PDF Exporter using jsPDF + AutoTable
  const handleExportPDF = async () => {
    if (!data) return;
    setExportingPDF(true);

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Page 1: Cover / Executive Summary
      doc.setFillColor(13, 27, 42); // Navy Blue
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setTextColor(245, 197, 24); // Gold
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('MARKAZ TAKAFUL', 20, 25);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('Dynamic PRO Collection Analytics & Presentation Dashboard', 20, 35);

      doc.setTextColor(0, 168, 150); // Teal
      doc.setFontSize(11);
      doc.text(`Reporting Period: ${data.duration?.periodLabel || 'N/A'} (Generated ${new Date().toLocaleDateString('en-IN')})`, 20, 44);

      // KPI Summary Boxes on PDF
      const kpis = [
        ['Total Collections', formatRupee(data.summary?.totalCollection)],
        ['Monthly Average', formatRupee(data.summary?.avgMonthlyCollection)],
        ['Active / Contributing PROs', `${data.summary?.contributingPros} / ${data.summary?.activePros}`],
        ['Highest Collection Month', `${data.summary?.highestMonth?.label || 'N/A'} (${formatRupee(data.summary?.highestMonth?.amount)})`],
        ['Top PRO Performer', `${data.summary?.topPro?.name} (${data.summary?.topPro?.pct}%)`],
        ['Growth vs Prior Period', data.summary?.growthText || 'N/A']
      ];

      doc.autoTable({
        startY: 55,
        head: [['Key Performance Indicator', 'Value']],
        body: kpis,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: [245, 197, 24], fontStyle: 'bold' },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        styles: { fontSize: 10, cellPadding: 3.5 }
      });

      // Page 2: Monthly Trends Table
      doc.addPage();
      doc.setFillColor(13, 27, 42);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setTextColor(245, 197, 24);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('MONTHLY COLLECTION SUMMARY & MOM GROWTH', 20, 20);

      const trendRows = (data.monthlyTrends || []).map(m => [
        m.label,
        Math.round(m.takaful).toLocaleString('en-IN'),
        Math.round(m.additional).toLocaleString('en-IN'),
        Math.round(m.total).toLocaleString('en-IN'),
        m.momGrowthText || '—'
      ]);

      doc.autoTable({
        startY: 30,
        head: [['Month', 'Takaful Base (Rs)', 'Additional (Rs)', 'Total Collection (Rs)', 'MoM Growth']],
        body: trendRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: [245, 197, 24] },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 }
      });

      // Page 3: PRO Rankings Table
      doc.addPage();
      doc.setFillColor(13, 27, 42);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setTextColor(245, 197, 24);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPLETE PRO PERFORMANCE & RANKINGS', 20, 20);

      const proTableRows = (data.proAnalytics || []).map(p => [
        `#${p.rank}`,
        p.name,
        p.area || p.category || '—',
        Math.round(p.avgMonthly).toLocaleString('en-IN'),
        p.highestMonth?.label || '—',
        p.growthText || 'N/A',
        `${p.contributionPct}%`,
        Math.round(p.totalCollection).toLocaleString('en-IN')
      ]);

      doc.autoTable({
        startY: 30,
        head: [['Rank', 'PRO Name', 'Area/Module', 'Monthly Avg (Rs)', 'Highest Month', 'Growth %', 'Share (%)', 'Total Collection (Rs)']],
        body: proTableRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: [245, 197, 24] },
        bodyStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5, cellPadding: 2.5 }
      });

      const safeDurationName = (data.duration?.periodLabel || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`MARKAZ_Takaful_PRO_Report_${safeDurationName}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to export PDF report.');
    } finally {
      setExportingPDF(false);
    }
  };

  // Save current report preset configuration
  const handleSaveDeckConfig = async () => {
    if (!deckTitle.trim()) {
      alert('Please enter a presentation title.');
      return;
    }

    setSavingDeck(true);
    try {
      const payload = {
        title: deckTitle,
        periodType,
        customRange: periodType === 'custom' ? customRange : undefined,
        financialYear: periodType === 'financialYear' ? fySelection : undefined,
        module: moduleSelection !== 'all' ? moduleSelection : undefined,
        liveData: true,
        accessControl: {
          isPublic: true,
          isPasswordProtected: false
        }
      };

      const res = await client.post('/api/presentations', payload);
      if (res.data?.success) {
        alert('Presentation configuration saved successfully!');
        fetchSavedPresentations();
      }
    } catch (err) {
      console.error('Save deck error:', err);
      alert(err.response?.data?.message || 'Failed to save presentation.');
    } finally {
      setSavingDeck(false);
    }
  };

  const copyShareLink = (id) => {
    const link = `${window.location.origin}/presentation/${id}`;
    navigator.clipboard.writeText(link);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2500);
  };

  return (
    <div className="space-y-6 pb-20 text-gray-100">

      {/* TOP HEADER & ACTION BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-white/10 shadow-xl bg-gradient-to-r from-[#0D1B2A] via-[#101F33] to-[#0D1B2A]">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-[#00A896]/20 border border-[#00A896]/40 rounded-xl text-[#00A896] shadow-inner">
              <Presentation className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Dynamic Takaful PRO Collection Analytics & Presentation Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                MARKAZ Takaful Collection Reports • Multi-duration analytics, PRO-wise graphs, rankings & management slides
              </p>
            </div>
          </div>

          {/* Prominent Current Period Display */}
          {data?.duration && (
            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5C518]/10 border border-[#F5C518]/30 text-[#F5C518] text-xs font-bold">
                <Calendar className="w-3.5 h-3.5" />
                <span>Selected Reporting Period: <strong className="text-white">{data.duration.periodLabel}</strong></span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">
                {data.duration.numMonths} {data.duration.numMonths === 1 ? 'Month' : 'Months'} Range
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#00A896]/10 border border-[#00A896]/30 text-[#00A896] font-semibold">
                {data.summary?.contributingPros || 0} Contributing PROs
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-semibold">
                Total: {formatRupee(data.summary?.totalCollection)}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setActiveView('presentation');
              setCurrentSlideIndex(0);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F5C518] via-[#D4AF37] to-[#F5C518] text-[#0A0F1D] font-extrabold text-sm shadow-lg shadow-[#F5C518]/20 hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Generate Presentation
          </button>

          <button
            onClick={handleExportPPTX}
            disabled={exportingPPTX || !data}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A896]/20 hover:bg-[#00A896]/30 border border-[#00A896]/40 text-[#00A896] font-bold text-xs transition cursor-pointer disabled:opacity-50"
            title="Download PowerPoint (.pptx) Deck"
          >
            {exportingPPTX ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PPTX
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exportingPDF || !data}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            title="Download Landscape PDF Document"
          >
            {exportingPDF ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Export PDF
          </button>

          <button
            onClick={() => fetchAnalyticsData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition cursor-pointer"
            title="Refresh Data from Database"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#F5C518]' : ''}`} />
          </button>
        </div>
      </div>

      {/* VIEW SELECTOR TABS */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          {[
            { id: 'dashboard', label: 'Analytics Dashboard', icon: BarChart3 },
            { id: 'presentation', label: 'Presentation Deck View', icon: Presentation, badge: presentationSlides.length },
            { id: 'table', label: 'PRO Rankings Table', icon: FileSpreadsheet },
            { id: 'saved', label: 'Saved Presentations', icon: Layers }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeView === tab.id
                  ? 'bg-gradient-to-r from-[#00A896] to-[#028090] text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-2 py-0.2 rounded-full font-extrabold ${
                  activeView === tab.id ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* DURATION SELECTOR & FILTER TOOLBAR */}
      <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-4">
        {/* Row 1: Duration Presets */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#F5C518]" />
              Select Reporting Duration (Recalculates Dashboard & Presentation Dynamically)
            </label>
            <span className="text-[11px] text-[#00A896] font-medium hidden sm:inline">
              All metrics reconcile with actual MongoDB collection records
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {DURATION_PRESETS.map(preset => {
              const isActive = periodType === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setPeriodType(preset.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                    isActive
                      ? 'bg-[#F5C518]/15 border-[#F5C518] text-[#F5C518] shadow-lg shadow-[#F5C518]/10'
                      : 'bg-white/[0.02] border-white/5 text-gray-300 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <span className="text-xs font-extrabold">{preset.label}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{preset.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Conditional Controls (FY Picker or Custom Date Inputs) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-white/5 items-center">
          {/* Conditional: Financial Year Selector */}
          {periodType === 'financialYear' && (
            <div>
              <label className="text-[11px] text-gray-400 block mb-1 font-semibold">Select Financial Year</label>
              <select
                value={fySelection}
                onChange={(e) => setFySelection(e.target.value)}
                className="w-full bg-[#0D1B2A] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#F5C518]"
              >
                <option value="all">Current / Active FY (2026-27)</option>
                {(financialYears || []).filter(y => y._id !== 'all').map(fy => (
                  <option key={fy._id} value={fy.year}>
                    FY {fy.year}-{String(Number(fy.year) + 1).slice(2)} {fy.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional: Custom Date Range Pickers */}
          {periodType === 'custom' && (
            <div className="md:col-span-2 flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-gray-400 block mb-1 font-semibold">Start Date</label>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full bg-[#0D1B2A] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#F5C518]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-gray-400 block mb-1 font-semibold">End Date</label>
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full bg-[#0D1B2A] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#F5C518]"
                />
              </div>
              <div className="pt-5">
                <button
                  onClick={handleApplyCustomRange}
                  className="px-4 py-2 rounded-xl bg-[#00A896] hover:bg-[#028090] text-white text-xs font-bold transition cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Category / Module Filter */}
          <div>
            <label className="text-[11px] text-gray-400 block mb-1 font-semibold">Collection Category / Module</label>
            <select
              value={moduleSelection}
              onChange={(e) => setModuleSelection(e.target.value)}
              className="w-full bg-[#0D1B2A] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#F5C518]"
            >
              <option value="all">All Categories</option>
              {(modules || []).filter(m => m._id !== 'all').map(mod => (
                <option key={mod._id} value={mod._id}>{mod.name} ({mod.code})</option>
              ))}
            </select>
          </div>

          {/* PRO Specific Filter */}
          <div>
            <label className="text-[11px] text-gray-400 block mb-1 font-semibold">Focus Individual PRO</label>
            <select
              value={proFilter}
              onChange={(e) => setProFilter(e.target.value)}
              className="w-full bg-[#0D1B2A] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#F5C518]"
            >
              <option value="all">All PROs ({data?.proAnalytics?.length || 0})</option>
              {(data?.proAnalytics || []).map(p => (
                <option key={p.proId} value={p.proId}>
                  #{p.rank} {p.name} ({formatRupeeShort(p.totalCollection)})
                </option>
              ))}
            </select>
          </div>

          {/* Chart Style Toggle */}
          <div>
            <label className="text-[11px] text-gray-400 block mb-1 font-semibold">PRO Chart Style</label>
            <div className="flex items-center gap-1 bg-[#0D1B2A] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setChartType('bar')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartType === 'bar' ? 'bg-[#00A896] text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Bar
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartType === 'line' ? 'bg-[#00A896] text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" /> Line
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* LOADING SPINNER */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#F5C518]" />
          <p className="text-sm font-semibold text-gray-400">Loading and compiling dynamic collection data...</p>
        </div>
      )}

      {/* MAIN VIEW 1: DASHBOARD VIEW */}
      {!loading && activeView === 'dashboard' && data && (
        <div className="space-y-8">

          {/* 3. DASHBOARD SUMMARY CARDS (KPIS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

            {/* 1. Total Collection */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 rounded-2xl border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Collection</span>
                <span className="p-2 rounded-xl bg-[#F5C518]/15 text-[#F5C518]">
                  <Award className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-extrabold text-[#F5C518] mt-2 font-mono">
                {formatRupee(data.summary?.totalCollection)}
              </h3>
              <p className="text-[11px] text-gray-400 mt-2">
                Takaful: {formatRupeeShort(data.summary?.takafulTotal)} • Add: {formatRupeeShort(data.summary?.additionalTotal)}
              </p>
            </motion.div>

            {/* 2. Number of Active PROs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-5 rounded-2xl border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active PROs</span>
                <span className="p-2 rounded-xl bg-[#00A896]/15 text-[#00A896]">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-extrabold text-white mt-2 font-mono">
                {data.summary?.contributingPros} <span className="text-sm font-normal text-gray-400">/ {data.summary?.activePros}</span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-2">
                {data.summary?.zeroPros > 0 ? (
                  <span className="text-amber-400">{data.summary?.zeroPros} with zero collection</span>
                ) : (
                  <span className="text-emerald-400">100% contributing</span>
                )}
              </p>
            </motion.div>

            {/* 3. Average Monthly Collection */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-5 rounded-2xl border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Monthly Average</span>
                <span className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                  <BarChart3 className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-2xl font-extrabold text-white mt-2 font-mono">
                {formatRupee(data.summary?.avgMonthlyCollection)}
              </h3>
              <p className="text-[11px] text-gray-400 mt-2">
                Over {data.duration?.numMonths} reporting {data.duration?.numMonths === 1 ? 'month' : 'months'}
              </p>
            </motion.div>

            {/* 4. Highest Collection Month */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-5 rounded-2xl border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Highest Month</span>
                <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white mt-2 truncate">
                {data.summary?.highestMonth?.label || 'N/A'}
              </h3>
              <p className="text-[11px] text-emerald-400 font-mono mt-2">
                {formatRupee(data.summary?.highestMonth?.amount)}
              </p>
            </motion.div>

            {/* 5. Top-Performing PRO */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-5 rounded-2xl border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Top PRO</span>
                <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Award className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white mt-2 truncate" title={data.summary?.topPro?.name}>
                {data.summary?.topPro?.name || 'N/A'}
              </h3>
              <p className="text-[11px] text-[#F5C518] mt-2 font-mono">
                {formatRupee(data.summary?.topPro?.amount)} ({data.summary?.topPro?.pct}%)
              </p>
            </motion.div>

            {/* 6. Collection Growth Percentage */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass-card p-5 rounded-2xl border border-white/10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Period Growth</span>
                <span className={`p-2 rounded-xl ${
                  data.summary?.growthPct > 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : (data.summary?.growthPct < 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-gray-500/15 text-gray-400')
                }`}>
                  {data.summary?.growthPct > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </span>
              </div>
              <h3 className={`text-2xl font-extrabold mt-2 font-mono ${
                data.summary?.growthPct > 0 ? 'text-emerald-400' : (data.summary?.growthPct < 0 ? 'text-rose-400' : 'text-gray-300')
              }`}>
                {data.summary?.growthText || 'N/A'}
              </h3>
              <p className="text-[10px] text-gray-400 mt-2 truncate">
                vs {data.duration?.prevPeriodLabel || 'Prior Period'}
              </p>
            </motion.div>

          </div>

          {/* 4. MONTHLY COLLECTION COMPARISON & CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Monthly Total & MoM Growth Rechart (2 Columns) */}
            <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#00A896]" />
                    Monthly Collection Comparison & Trends
                  </h3>
                  <p className="text-xs text-gray-400">Total collections per month with month-on-month trend</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-gray-300">
                    <span className="w-3 h-3 rounded-full bg-[#00A896]" /> Total Collection (₹)
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-300">
                    <span className="w-3 h-3 rounded-full bg-[#F5C518]" /> Previous Period
                  </span>
                </div>
              </div>

              <div className="h-80 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.monthlyTrends || []} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="tealBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00A896" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#028090" stopOpacity={0.4} />
                      </linearGradient>
                      <linearGradient id="goldBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F5C518" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v}
                    />
                    <Tooltip content={<CustomRupeeTooltip />} />
                    <Bar dataKey="total" name="Total Collection" fill="url(#tealBarGrad)" radius={[6, 6, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="prevPeriodAmount"
                      name="Prior Period Equivalent"
                      stroke="#F5C518"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#F5C518' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 10 PROs Performance Bar Chart */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#F5C518]" />
                    Top 10 PRO Performance
                  </h3>
                  <p className="text-xs text-gray-400">Ranked by collection in selected period</p>
                </div>
              </div>

              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={(data.top10Pros || []).slice(0, 7)}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      type="number"
                      stroke="#94A3B8"
                      fontSize={10}
                      tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#94A3B8"
                      fontSize={10}
                      width={80}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomRupeeTooltip />} />
                    <Bar dataKey="totalCollection" name="Total Collection" radius={[0, 6, 6, 0]}>
                      {(data.top10Pros || []).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? '#F5C518' : (index < 3 ? '#00A896' : '#3B82F6')}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* GROWTH MOVERS: GAINERS & DECLINERS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Top Gainers */}
            <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Top Collection Gainers vs Previous Period
                </h4>
                <span className="text-[11px] text-gray-400">vs {data.duration?.prevPeriodLabel}</span>
              </div>
              <div className="space-y-2">
                {(data.growthMovers?.topGainers || []).length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center">No gainer records found in this duration</p>
                ) : (
                  (data.growthMovers?.topGainers || []).map(p => (
                    <div key={p.proId} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div>
                        <p className="text-xs font-bold text-white">#{p.rank} {p.name}</p>
                        <p className="text-[10px] text-gray-400">Prior: {formatRupee(p.prevTotal)} → Current: {formatRupee(p.totalCollection)}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full font-mono">
                        {p.growthText}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Decliners */}
            <div className="glass-card p-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.02] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-rose-400 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Top Collection Decliners vs Previous Period
                </h4>
                <span className="text-[11px] text-gray-400">vs {data.duration?.prevPeriodLabel}</span>
              </div>
              <div className="space-y-2">
                {(data.growthMovers?.topDecliners || []).length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center">No decliner records found in this duration</p>
                ) : (
                  (data.growthMovers?.topDecliners || []).map(p => (
                    <div key={p.proId} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div>
                        <p className="text-xs font-bold text-white">#{p.rank} {p.name}</p>
                        <p className="text-[10px] text-gray-400">Prior: {formatRupee(p.prevTotal)} → Current: {formatRupee(p.totalCollection)}</p>
                      </div>
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full font-mono">
                        {p.growthText}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* 2. PRO-WISE INDIVIDUAL GRAPHS (SEPARATE GRAPH FOR EVERY PRO) */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#F5C518]" />
                  PRO-Wise Individual Collection Graphs ({filteredPros.length} PROs)
                </h3>
                <p className="text-xs text-gray-400">
                  Every PRO has an independent dynamic graph showing monthly collections, total, average, highest month, and growth comparison.
                </p>
              </div>

              {/* Search & Sort Controls for PRO Cards */}
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search PRO name..."
                    value={proSearchQuery}
                    onChange={(e) => setProSearchQuery(e.target.value)}
                    className="bg-[#0D1B2A] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#F5C518] w-44"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[#0D1B2A] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none"
                >
                  <option value="rank">Sort by Rank</option>
                  <option value="collection_desc">Highest Collection</option>
                  <option value="collection_asc">Lowest Collection</option>
                  <option value="growth_desc">Highest Growth</option>
                  <option value="name">Name (A-Z)</option>
                </select>

                {/* Quick Chart Style Toggle */}
                <div className="flex items-center bg-[#0D1B2A] p-0.5 rounded-xl border border-white/10">
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      chartType === 'bar' ? 'bg-[#00A896] text-white shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Bar Chart"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Bar
                  </button>
                  <button
                    onClick={() => setChartType('line')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      chartType === 'line' ? 'bg-[#00A896] text-white shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Line Chart"
                  >
                    <LineChartIcon className="w-3.5 h-3.5" /> Line
                  </button>
                </div>
              </div>
            </div>

            {/* PRO Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredPros.map(pro => (
                <div
                  key={pro.proId}
                  className="glass-card p-5 rounded-2xl border border-white/10 hover:border-[#F5C518]/30 transition-all flex flex-col justify-between"
                >
                  {/* PRO Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            pro.rank === 1 ? 'bg-[#F5C518] text-[#0A0F1D]' : 'bg-white/10 text-gray-200'
                          }`}>
                            #{pro.rank}
                          </span>
                          <h4 className="font-extrabold text-white text-base truncate max-w-[200px]" title={pro.name}>
                            {pro.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {pro.designation || 'PRO Officer'} • {pro.area || pro.category || 'General'}
                        </p>
                      </div>

                      {/* Status / Contribution Pill */}
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#00A896]/15 border border-[#00A896]/30 text-[#00A896] font-bold">
                        {pro.contributionPct}% share
                      </span>
                    </div>

                    {/* Key Metrics Strip for this PRO */}
                    <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Total</span>
                        <span className="text-xs font-black text-[#F5C518] font-mono block mt-0.5">
                          {formatRupee(pro.totalCollection)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Monthly Avg</span>
                        <span className="text-xs font-bold text-white font-mono block mt-0.5">
                          {formatRupee(pro.avgMonthly)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Growth</span>
                        <span className={`text-xs font-bold font-mono block mt-0.5 ${
                          pro.growthPct > 0 ? 'text-emerald-400' : (pro.growthPct < 0 ? 'text-rose-400' : 'text-gray-400')
                        }`}>
                          {pro.growthText || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Highest Month Badge */}
                    {pro.highestMonth?.amount > 0 && (
                      <p className="text-[10px] text-gray-400 mt-2 flex items-center justify-between">
                        <span>Best Month: <strong className="text-white">{pro.highestMonth.label}</strong></span>
                        <span className="text-emerald-400 font-mono font-semibold">{formatRupee(pro.highestMonth.amount)}</span>
                      </p>
                    )}
                  </div>

                  {/* Individual Rechart for this PRO */}
                  {(() => {
                    const proChartData = (pro.monthlyData || []).map(m => {
                      const tot = Number(m.total !== undefined ? m.total : (m.amount !== undefined ? m.amount : 0));
                      const lbl = m.label || m.month || '';
                      return {
                        ...m,
                        label: lbl,
                        month: lbl,
                        total: tot,
                        amount: tot
                      };
                    });
                    const hasCollection = pro.totalCollection > 0 || proChartData.some(d => d.total > 0);

                    return (
                      <div className="w-full h-48 mt-3 pt-2 border-t border-white/5">
                        {!hasCollection ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-3 text-gray-500">
                            <AlertTriangle className="w-5 h-5 mb-1 text-gray-600" />
                            <span className="text-xs">No collections recorded in this period</span>
                            <span className="text-[10px] text-gray-600 mt-0.5">(Confirmed zero records)</span>
                          </div>
                        ) : (
                          <div className="w-full h-full min-h-[160px]">
                            <ResponsiveContainer key={`resp_${chartType}_${pro.proId}`} width="100%" height={175}>
                              {chartType === 'line' ? (
                                <AreaChart key={`line_chart_${pro.proId}`} data={proChartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                                  <defs>
                                    <linearGradient id={`area_grad_${pro.proId}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#00A896" stopOpacity={0.45} />
                                      <stop offset="100%" stopColor="#00A896" stopOpacity={0.02} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={9} tickLine={false} />
                                  <YAxis
                                    stroke="#94A3B8"
                                    fontSize={9}
                                    tickLine={false}
                                    domain={[0, 'auto']}
                                    tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                                  />
                                  <Tooltip content={<CustomRupeeTooltip />} />
                                  <Area
                                    type="monotone"
                                    dataKey="total"
                                    name="Collection"
                                    stroke="#00A896"
                                    strokeWidth={2.5}
                                    fill={`url(#area_grad_${pro.proId})`}
                                    dot={{ r: 3.5, fill: '#F5C518', stroke: '#0D1B2A', strokeWidth: 1.5 }}
                                    activeDot={{ r: 5, fill: '#F5C518' }}
                                    isAnimationActive={false}
                                  />
                                </AreaChart>
                              ) : (
                                <BarChart key={`bar_chart_${pro.proId}`} data={proChartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                                  <defs>
                                    <linearGradient id={`grad_pro_${pro.proId}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#00A896" stopOpacity={0.9} />
                                      <stop offset="100%" stopColor="#028090" stopOpacity={0.4} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={9} tickLine={false} />
                                  <YAxis
                                    stroke="#94A3B8"
                                    fontSize={9}
                                    tickLine={false}
                                    domain={[0, 'auto']}
                                    tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                                  />
                                  <Tooltip content={<CustomRupeeTooltip />} />
                                  <Bar dataKey="total" name="Collection" fill={`url(#grad_pro_${pro.proId})`} radius={[4, 4, 0, 0]} minPointSize={3} />
                                </BarChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

          {/* DYNAMIC OBSERVATIONS & STRATEGIC INSIGHTS */}
          <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F5C518]" />
              Strategic Observations & Automated Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(data.observations || []).map((obs, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F5C518] shrink-0 mt-1" />
                  <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">{obs}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* MAIN VIEW 2: DYNAMIC PRESENTATION DECK GENERATOR */}
      {!loading && activeView === 'presentation' && data && (
        <div className="space-y-6" ref={presentationContainerRef}>

          {/* Presentation Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4 rounded-2xl border border-white/10 bg-[#0D1B2A]">
            <div className="flex items-center gap-3">
              <span className="text-sm font-extrabold text-[#F5C518]">
                Slide {currentSlideIndex + 1} of {presentationSlides.length}
              </span>
              <span className="text-xs text-gray-400">
                • {presentationSlides[currentSlideIndex]?.title}
              </span>
            </div>

            {/* Slide Navigation Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={prevSlide}
                disabled={currentSlideIndex === 0}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 cursor-pointer"
                title="Previous Slide (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextSlide}
                disabled={currentSlideIndex === presentationSlides.length - 1}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-30 cursor-pointer"
                title="Next Slide (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white cursor-pointer ml-2"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 16:9 Widescreen Presentation Canvas */}
          <div className="w-full aspect-[16/9] max-w-6xl mx-auto rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-gradient-to-br from-[#0D1B2A] via-[#101F33] to-[#0A1128] p-8 sm:p-12 flex flex-col justify-between relative">

            {/* Slide Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-bold text-[#F5C518] uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> MARKAZ TAKAFUL DASHBOARD
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {presentationSlides[currentSlideIndex]?.title}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold text-[#00A896] block">
                  Reporting Period: {data.duration?.periodLabel}
                </span>
                <span className="text-[10px] text-gray-500">
                  Slide {currentSlideIndex + 1} of {presentationSlides.length}
                </span>
              </div>
            </div>

            {/* Slide Dynamic Body Content */}
            <div className="flex-1 flex flex-col justify-center py-6">

              {/* Slide 1: Cover */}
              {presentationSlides[currentSlideIndex]?.type === 'cover' && (
                <div className="text-center space-y-6 max-w-3xl mx-auto">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-[#F5C518]/15 border border-[#F5C518]/30 text-[#F5C518] text-xs font-extrabold uppercase tracking-widest">
                    Executive Presentation
                  </span>
                  <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                    MARKAZ Takaful PRO Collection Analytics
                  </h1>
                  <p className="text-base sm:text-lg text-[#00A896] font-semibold">
                    Reporting Duration: {data.duration?.periodLabel}
                  </p>
                  <div className="flex items-center justify-center gap-6 pt-4 text-xs text-gray-300">
                    <div>
                      <strong className="text-lg text-[#F5C518] block">{formatRupee(data.summary?.totalCollection)}</strong>
                      Total Collections
                    </div>
                    <div className="w-px h-8 bg-white/20" />
                    <div>
                      <strong className="text-lg text-white block">{data.summary?.activePros}</strong>
                      Active PROs
                    </div>
                    <div className="w-px h-8 bg-white/20" />
                    <div>
                      <strong className="text-lg text-emerald-400 block">{data.summary?.growthText || 'N/A'}</strong>
                      Period Growth
                    </div>
                  </div>
                </div>
              )}

              {/* Slide 2: Executive Summary */}
              {presentationSlides[currentSlideIndex]?.type === 'summary' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-xs text-gray-400 uppercase font-bold block">Total Collections</span>
                      <span className="text-2xl font-black text-[#F5C518] block mt-1">{formatRupee(data.summary?.totalCollection)}</span>
                      <span className="text-[11px] text-gray-400">Over {data.duration?.numMonths} months</span>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-xs text-gray-400 uppercase font-bold block">Average Monthly</span>
                      <span className="text-2xl font-black text-white block mt-1">{formatRupee(data.summary?.avgMonthlyCollection)}</span>
                      <span className="text-[11px] text-[#00A896]">Calculated accurately</span>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-xs text-gray-400 uppercase font-bold block">Top Performing PRO</span>
                      <span className="text-2xl font-black text-emerald-400 block mt-1 truncate">{data.summary?.topPro?.name}</span>
                      <span className="text-[11px] text-gray-400">{data.summary?.topPro?.pct}% of total</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Key Takeaways</h4>
                    {(data.observations || []).slice(0, 3).map((obs, i) => (
                      <p key={i} className="text-xs sm:text-sm text-gray-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518]" /> {obs}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Slide 3: Month-on-Month Collection Analysis (Top KPI Cards + Graph + Single-Column Breakdown Table) */}
              {(presentationSlides[currentSlideIndex]?.type === 'comparison' || presentationSlides[currentSlideIndex]?.type === 'trends') && (
                <div className="space-y-4">
                  {/* Top 4 KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] text-[#00A896] uppercase font-bold block">Total Collection</span>
                      <span className="text-xl font-black text-white">{formatRupee(data.summary?.totalCollection)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] text-[#00A896] uppercase font-bold block">Monthly Average</span>
                      <span className="text-xl font-black text-white">{formatRupee(data.summary?.avgMonthlyCollection)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] text-[#00A896] uppercase font-bold block">Highest Month</span>
                      <span className="text-xl font-black text-[#F5C518] truncate block">{data.summary?.highestMonth?.label || 'N/A'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] text-[#00A896] uppercase font-bold block">Highest Collection</span>
                      <span className="text-xl font-black text-emerald-400">{formatRupee(data.summary?.highestMonth?.amount)}</span>
                    </div>
                  </div>

                  {/* Main Split: Left Graph + Right Table */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 items-stretch">
                    {/* Left: Monthly Collection Graph */}
                    <div className="lg:col-span-7 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#F5C518]">Monthly Collection Trend</span>
                        <span className="text-[10px] text-gray-400">Values in ₹</span>
                      </div>
                      <div className="w-full h-52">
                        <ResponsiveContainer width="100%" height={210}>
                          <BarChart data={data.monthlyTrends || []} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                            <defs>
                              <linearGradient id="momBarGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#00A896" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#028090" stopOpacity={0.4} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} />
                            <YAxis
                              stroke="#94A3B8"
                              fontSize={10}
                              tickLine={false}
                              domain={[0, 'auto']}
                              tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                            />
                            <Tooltip content={<CustomRupeeTooltip />} />
                            <Bar dataKey="total" name="Collection" fill="url(#momBarGrad)" radius={[5, 5, 0, 0]} minPointSize={4} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Right: MONTHLY BREAKDOWN Table (Only Month & Takaful+Additional in 1 column, plus MoM Growth) */}
                    <div className="lg:col-span-5 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#F5C518] uppercase tracking-wider block mb-2">
                          MONTHLY BREAKDOWN
                        </span>
                        <div className="overflow-y-auto max-h-48 pr-1">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-white/10 text-gray-400 font-bold">
                                <th className="py-1">Month</th>
                                <th className="py-1 text-right text-[#00A896]">Collection (₹)</th>
                                <th className="py-1 text-right text-gray-300">Growth</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {(data.monthlyTrends || []).map((m, idx) => (
                                <tr key={idx} className="text-gray-300 hover:bg-white/[0.02]">
                                  <td className="py-1.5 font-bold text-white">{m.label || m.month}</td>
                                  <td className="py-1.5 text-right font-bold text-[#00A896]">{formatRupee(m.total)}</td>
                                  <td className={`py-1.5 text-right font-bold ${(m.momGrowthPct || m.momGrowth) > 0 ? 'text-emerald-400' : ((m.momGrowthPct || m.momGrowth) < 0 ? 'text-rose-400' : 'text-gray-400')}`}>
                                    {m.momGrowthText || (m.momGrowth !== null && m.momGrowth !== undefined ? `${m.momGrowth > 0 ? '+' : ''}${m.momGrowth}%` : '—')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Total: <strong className="text-white">{formatRupee(data.summary?.totalCollection)}</strong></span>
                        <span>Avg: <strong className="text-white">{formatRupee(data.summary?.avgMonthlyCollection)}/mo</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide 4: Top 10 PRO Contributors (Top KPI Cards + Graph + Single-Column Breakdown Table) */}
              {presentationSlides[currentSlideIndex]?.type === 'top10' && (() => {
                const top10List = data.top10Pros || [];
                const top10Total = top10List.reduce((sum, p) => sum + (p.totalCollection || 0), 0);
                const top10Pct = data.summary?.totalCollection > 0
                  ? ((top10Total / data.summary.totalCollection) * 100).toFixed(1)
                  : '0.0';
                const top1Pro = top10List[0] || { name: 'None', totalCollection: 0 };

                return (
                  <div className="space-y-4">
                    {/* Top 4 KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                        <span className="text-[10px] text-[#00A896] uppercase font-bold block">Top 10 Total</span>
                        <span className="text-xl font-black text-white">{formatRupee(top10Total)}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                        <span className="text-[10px] text-[#00A896] uppercase font-bold block">Collection Share</span>
                        <span className="text-xl font-black text-white">{top10Pct}%</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                        <span className="text-[10px] text-[#00A896] uppercase font-bold block">#1 Contributor</span>
                        <span className="text-xl font-black text-[#F5C518] truncate block">{top1Pro.name}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                        <span className="text-[10px] text-[#00A896] uppercase font-bold block">#1 Collection</span>
                        <span className="text-xl font-black text-emerald-400">{formatRupee(top1Pro.totalCollection)}</span>
                      </div>
                    </div>

                    {/* Main Split: Left Graph + Right Table */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 items-stretch">
                      {/* Left: Top 10 Bar Chart */}
                      <div className="lg:col-span-7 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-[#F5C518]">Leading Collection by PRO</span>
                          <span className="text-[10px] text-gray-400">Values in ₹</span>
                        </div>
                        <div className="w-full h-52">
                          <ResponsiveContainer width="100%" height={210}>
                            <BarChart
                              layout="vertical"
                              data={top10List}
                              margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient id="top10BarGrad" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#F5C518" stopOpacity={0.9} />
                                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.4} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis
                                type="number"
                                stroke="#94A3B8"
                                fontSize={10}
                                tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                              />
                              <YAxis
                                dataKey="name"
                                type="category"
                                stroke="#94A3B8"
                                fontSize={10}
                                width={85}
                                tickFormatter={(n) => n.length > 12 ? `${n.substring(0, 11)}..` : n}
                              />
                              <Tooltip content={<CustomRupeeTooltip />} />
                              <Bar dataKey="totalCollection" name="Total Collection" fill="url(#top10BarGrad)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Right: CONTRIBUTORS RANKING Table (Only Rank, Name, Collection in 1 column, and Share) */}
                      <div className="lg:col-span-5 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#F5C518] uppercase tracking-wider block mb-2">
                            CONTRIBUTORS RANKING
                          </span>
                          <div className="overflow-y-auto max-h-48 pr-1">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-white/10 text-gray-400 font-bold">
                                  <th className="py-1">Rank</th>
                                  <th className="py-1">PRO Officer</th>
                                  <th className="py-1 text-right text-[#00A896]">Collection (₹)</th>
                                  <th className="py-1 text-right text-gray-300">Share</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {top10List.map((p) => (
                                  <tr key={p.proId || p.rank} className="text-gray-300 hover:bg-white/[0.02]">
                                    <td className="py-1.5 font-bold text-[#F5C518]">#{p.rank}</td>
                                    <td className="py-1.5 font-bold text-white truncate max-w-[110px]" title={p.name}>
                                      {p.name}
                                    </td>
                                    <td className="py-1.5 text-right font-bold text-[#00A896]">
                                      {formatRupee(p.totalCollection)}
                                    </td>
                                    <td className="py-1.5 text-right font-bold text-gray-200">
                                      {p.contributionPct}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
                          <span>Top 10 Total: <strong className="text-white">{formatRupee(top10Total)}</strong></span>
                          <span>Share: <strong className="text-white">{top10Pct}%</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Slides 6 to N: Individual PRO Slide */}
              {presentationSlides[currentSlideIndex]?.type === 'individual_pro' && (
                <div className="space-y-4">
                  {(() => {
                    const pro = presentationSlides[currentSlideIndex]?.proData;
                    if (!pro) return null;
                    return (
                      <>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Rank</span>
                            <span className="text-xl font-black text-[#F5C518]">#{pro.rank}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Total</span>
                            <span className="text-xl font-black text-white">{formatRupee(pro.totalCollection)}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Monthly Avg</span>
                            <span className="text-xl font-black text-white">{formatRupee(pro.avgMonthly)}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Growth</span>
                            <span className={`text-xl font-black ${pro.growthPct > 0 ? 'text-emerald-400' : (pro.growthPct < 0 ? 'text-rose-400' : 'text-gray-400')}`}>
                              {pro.growthText || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {(() => {
                          const slideChartData = (pro.monthlyData || []).map(m => {
                            const tot = Number(m.total !== undefined ? m.total : (m.amount !== undefined ? m.amount : 0));
                            const lbl = m.label || m.month || '';
                            return {
                              ...m,
                              label: lbl,
                              month: lbl,
                              total: tot,
                              amount: tot
                            };
                          });
                          const hasCollection = pro.totalCollection > 0 || slideChartData.some(d => d.total > 0);

                          return (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 items-stretch">
                              {/* Left: Monthly Collection Graph */}
                              <div className="lg:col-span-7 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-[#F5C518]">Monthly Collection</span>
                                  <span className="text-[10px] text-gray-400">Values in ₹</span>
                                </div>
                                {!hasCollection ? (
                                  <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-gray-500">
                                    <AlertTriangle className="w-5 h-5 mb-1 text-gray-500" />
                                    <span className="text-xs">No collections recorded in this period</span>
                                  </div>
                                ) : (
                                  <div className="w-full h-48">
                                    <ResponsiveContainer key={`pres_resp_${chartType}_${pro.proId}`} width="100%" height={190}>
                                      {chartType === 'line' ? (
                                        <AreaChart key={`slide_line_${pro.proId}`} data={slideChartData} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                                          <defs>
                                            <linearGradient id={`slide_area_grad_${pro.proId}`} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="0%" stopColor="#00A896" stopOpacity={0.45} />
                                              <stop offset="100%" stopColor="#00A896" stopOpacity={0.02} />
                                            </linearGradient>
                                          </defs>
                                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                          <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                          <YAxis
                                            stroke="#94A3B8"
                                            fontSize={10}
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                            tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                                          />
                                          <Tooltip content={<CustomRupeeTooltip />} />
                                          <Area
                                            type="monotone"
                                            dataKey="total"
                                            name="Collection"
                                            stroke="#00A896"
                                            strokeWidth={3}
                                            fill={`url(#slide_area_grad_${pro.proId})`}
                                            dot={{ r: 4, fill: '#F5C518', stroke: '#0D1B2A', strokeWidth: 1.5 }}
                                            activeDot={{ r: 6, fill: '#F5C518' }}
                                            isAnimationActive={false}
                                          />
                                        </AreaChart>
                                      ) : (
                                        <BarChart key={`slide_bar_${pro.proId}`} data={slideChartData} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                                          <defs>
                                            <linearGradient id={`grad_slide_${pro.proId}`} x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="0%" stopColor="#00A896" stopOpacity={0.9} />
                                              <stop offset="100%" stopColor="#028090" stopOpacity={0.4} />
                                            </linearGradient>
                                          </defs>
                                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                          <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                          <YAxis
                                            stroke="#94A3B8"
                                            fontSize={10}
                                            tickLine={false}
                                            domain={[0, 'auto']}
                                            tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
                                          />
                                          <Tooltip content={<CustomRupeeTooltip />} />
                                          <Bar dataKey="total" name="Collection" fill={`url(#grad_slide_${pro.proId})`} radius={[5, 5, 0, 0]} minPointSize={4} />
                                        </BarChart>
                                      )}
                                    </ResponsiveContainer>
                                  </div>
                                )}
                              </div>

                              {/* Right: MONTHLY BREAKDOWN Table (Only Month & Takaful+Additional in 1 column) */}
                              <div className="lg:col-span-5 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                                <div>
                                  <span className="text-xs font-bold text-[#F5C518] uppercase tracking-wider block mb-2">
                                    MONTHLY BREAKDOWN
                                  </span>
                                  <div className="overflow-y-auto max-h-44 pr-1">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="border-b border-white/10 text-gray-400 font-bold">
                                          <th className="py-1">Month</th>
                                          <th className="py-1 text-right text-[#00A896]">Collection (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5">
                                        {slideChartData.map((m, idx) => (
                                          <tr key={idx} className="text-gray-300">
                                            <td className="py-1 text-white font-medium">{m.label}</td>
                                            <td className="py-1 text-right font-mono font-bold text-[#00A896]">{formatRupee(m.total)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                                <div className="text-[10px] text-gray-400 pt-2 border-t border-white/5 flex justify-between">
                                  <span>Rank by total: <strong className="text-white">#{pro.rank}</strong></span>
                                  <span>Share: <strong className="text-[#00A896]">{pro.contributionPct}%</strong></span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Slide Movers */}
              {presentationSlides[currentSlideIndex]?.type === 'movers' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase">Top 5 Gainers</h4>
                    {(data.growthMovers?.topGainers || []).slice(0, 5).map(g => (
                      <div key={g.proId} className="flex justify-between text-xs text-gray-200">
                        <span>{g.name}</span>
                        <strong className="text-emerald-400 font-mono">{g.growthText}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                    <h4 className="text-xs font-bold text-rose-400 uppercase">Top 5 Decliners</h4>
                    {(data.growthMovers?.topDecliners || []).slice(0, 5).map(d => (
                      <div key={d.proId} className="flex justify-between text-xs text-gray-200">
                        <span>{d.name}</span>
                        <strong className="text-rose-400 font-mono">{d.growthText}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Slide Observations */}
              {presentationSlides[currentSlideIndex]?.type === 'observations' && (
                <div className="space-y-3 max-w-3xl mx-auto">
                  {(data.observations || []).map((obs, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F5C518] mt-1 shrink-0" />
                      <p className="text-sm text-gray-200">{obs}</p>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Slide Footer */}
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-gray-500">
              <span>MARKAZ Takaful • Management Dashboard</span>
              <span>Duration: {data.duration?.periodLabel}</span>
            </div>

          </div>

          {/* Slide Thumbnail Navigation Drawer */}
          <div className="glass-card p-4 rounded-2xl border border-white/10 space-y-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              Slide Deck Drawer (Click any slide to view)
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {presentationSlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
                    currentSlideIndex === idx
                      ? 'bg-[#F5C518] text-[#0A0F1D] border-[#F5C518]'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {idx + 1}. {slide.title.replace('PRO Performance: ', '')}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* MAIN VIEW 3: SEARCHABLE PRO RANKINGS & PERFORMANCE TABLE */}
      {!loading && activeView === 'table' && data && (
        <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#00A896]" />
                PRO Performance Rankings Table ({filteredPros.length} PROs)
              </h3>
              <p className="text-xs text-gray-400">
                Detailed rankings, monthly averages, and growth percentages for {data.duration?.periodLabel}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter PRO by name..."
                  value={proSearchQuery}
                  onChange={(e) => setProSearchQuery(e.target.value)}
                  className="bg-[#0D1B2A] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#F5C518] w-48"
                />
              </div>

              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-200 font-bold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> PDF Table
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                  <th className="p-3">Rank</th>
                  <th className="p-3">PRO Officer</th>
                  <th className="p-3">Category / Area</th>
                  <th className="p-3 text-right">Monthly Avg</th>
                  <th className="p-3 text-right">Highest Month</th>
                  <th className="p-3 text-right">Prior Collection</th>
                  <th className="p-3 text-right">Growth %</th>
                  <th className="p-3 text-right">Contribution %</th>
                  <th className="p-3 text-right text-[#F5C518]">Total Collection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPros.map(p => (
                  <tr key={p.proId} className="hover:bg-white/[0.02] text-gray-300 transition">
                    <td className="p-3 font-extrabold text-[#F5C518]">#{p.rank}</td>
                    <td className="p-3 font-bold text-white">{p.name}</td>
                    <td className="p-3 text-gray-400">{p.area || p.category || 'General'}</td>
                    <td className="p-3 text-right font-mono">{formatRupee(p.avgMonthly)}</td>
                    <td className="p-3 text-right text-gray-300">
                      {p.highestMonth?.label || '—'} {p.highestMonth?.amount > 0 ? `(${formatRupeeShort(p.highestMonth.amount)})` : ''}
                    </td>
                    <td className="p-3 text-right font-mono text-gray-400">{formatRupee(p.prevTotal)}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        p.growthPct > 0 ? 'bg-emerald-500/15 text-emerald-400' : (p.growthPct < 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-white/5 text-gray-400')
                      }`}>
                        {p.growthText || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono font-bold text-[#00A896]">{p.contributionPct}%</span>
                        <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#00A896]" style={{ width: `${Math.min(100, Number(p.contributionPct) * 4)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right font-extrabold font-mono text-[#F5C518]">
                      {formatRupee(p.totalCollection)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MAIN VIEW 4: SAVED PRESENTATIONS & PRESETS */}
      {activeView === 'saved' && (
        <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#F5C518]" />
                Saved Presentation Decks
              </h3>
              <p className="text-xs text-gray-400">Save your current period configuration or generate public presentation links</p>
            </div>

            {/* Quick Save Box */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                placeholder="Presentation title..."
                className="bg-[#0D1B2A] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F5C518] w-64"
              />
              <button
                onClick={handleSaveDeckConfig}
                disabled={savingDeck}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#F5C518] to-[#D4AF37] text-[#0A0F1D] text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Save Current Setup
              </button>
            </div>
          </div>

          {savedPresentations.length === 0 ? (
            <p className="text-xs text-gray-500 py-10 text-center">No saved presentations found. Click "Save Current Setup" above to store this report.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedPresentations.map(pres => (
                <div key={pres._id} className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-[#F5C518]/30 transition space-y-3">
                  <div>
                    <h4 className="font-extrabold text-white text-sm truncate">{pres.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00A896]/15 text-[#00A896] font-bold uppercase mt-1 inline-block">
                      {pres.periodType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                    <button
                      onClick={() => window.open(`/presentation/${pres._id}`, '_blank')}
                      className="text-xs font-bold text-[#F5C518] flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> Launch Deck
                    </button>
                    <button
                      onClick={() => copyShareLink(pres._id)}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copySuccessId === pres._id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Share
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default PresentationBuilder;
