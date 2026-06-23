import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import EChartWrapper from '../components/EChartWrapper';
import {
  Lock, AlertCircle, Play, ChevronLeft, ChevronRight, Maximize,
  Minimize, Home, HelpCircle, Sparkles, Award, Star, List, Layout,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const PublicPresentation = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Authentication & Presentation states
  const [presentation, setPresentation] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);

  // Deck status
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [direction, setDirection] = useState(1); // 1 = next, -1 = prev

  useEffect(() => {
    loadPresentation();
  }, [id]);

  // Bind keyboard navigation
  useEffect(() => {
    if (!presentation || passwordRequired) return;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.code === 'ArrowLeft' || e.code === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.code === 'F11') {
        // We let F11 work natively, but keep fullscreen state updated
        setTimeout(checkFullscreenState, 200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation, passwordRequired, currentSlideIndex]);

  const loadPresentation = async (pwdHeader = null) => {
    setLoading(true);
    setAuthError('');
    try {
      const config = {};
      if (pwdHeader) {
        config.headers = { 'X-Presentation-Password': pwdHeader };
      }
      const res = await client.get(`/api/presentations/public/${id}`, config);
      if (res.data.success) {
        if (res.data.isPasswordRequired) {
          setPasswordRequired(true);
        } else {
          setPresentation(res.data.presentation);
          setReportData(res.data.data);
          setPasswordRequired(false);
        }
      }
    } catch (err) {
      console.error('Failed to load presentation', err);
      setAuthError(err.response?.data?.message || 'Access Denied / Expired link');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      const res = await client.post(`/api/presentations/public/${id}/verify`, { password });
      if (res.data.success) {
        setPresentation(res.data.presentation);
        setReportData(res.data.data);
        setPasswordRequired(false);
        // Save correct password for potential re-fetches
        sessionStorage.setItem(`pres_pwd_${id}`, password);
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Incorrect password.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    const docEl = document.documentElement;
    if (!document.fullscreenElement) {
      docEl.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Fullscreen request failed', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  const checkFullscreenState = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  // Listen for native escape exit
  useEffect(() => {
    const onFullscreenChange = () => checkFullscreenState();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const activeSlides = presentation ? presentation.slides.filter(s => s.enabled) : [];
  const currentSlide = activeSlides[currentSlideIndex];

  const nextSlide = () => {
    if (currentSlideIndex < activeSlides.length - 1) {
      setDirection(1);
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setDirection(-1);
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  // ECharts Configs (16:9 Optimized)
  const getCategoryShareOption = () => {
    if (!reportData) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: ₹{c} ({d}%)' },
      series: [{
        name: 'Categories',
        type: 'pie',
        radius: ['50%', '75%'],
        padAngle: 4,
        itemStyle: { borderRadius: 12 },
        label: { show: true, color: '#fff', fontSize: 13, formatter: '{b}: {d}%' },
        data: reportData.categoryShare.map(c => ({ value: c.value, name: c.name, itemStyle: { color: c.color } }))
      }]
    };
  };

  const getCollectionTrendOption = () => {
    if (!reportData) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: MONTHS.map(m => m.substring(0, 3)),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#fff', fontSize: 14 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#fff', fontSize: 13, formatter: (v) => v >= 100000 ? `${(v/100000).toFixed(0)}L` : v }
      },
      series: [{
        name: 'Collection',
        type: 'line',
        smooth: true,
        symbolSize: 12,
        itemStyle: { color: '#f5c518' },
        lineStyle: { width: 5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 197, 24, 0.35)' },
              { offset: 1, color: 'transparent' }
            ]
          }
        },
        data: reportData.monthlySummary.map(m => m.total)
      }]
    };
  };

  const getSponsorGrowthOption = () => {
    if (!reportData) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: MONTHS.map(m => m.substring(0, 3)),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisLabel: { color: '#fff', fontSize: 14 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#fff', fontSize: 13 }
      },
      series: [{
        name: 'Sponsors',
        type: 'line',
        smooth: true,
        symbolSize: 10,
        itemStyle: { color: '#f5c518' },
        lineStyle: { width: 5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245, 197, 24, 0.25)' },
              { offset: 1, color: 'transparent' }
            ]
          }
        },
        data: reportData.sponsorGrowth.map(g => g.cumulative)
      }]
    };
  };

  const getDistributionOption = () => {
    if (!reportData) return {};
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: ₹{c} ({d}%)' },
      series: [{
        name: 'Distributions',
        type: 'pie',
        radius: ['50%', '75%'],
        padAngle: 4,
        itemStyle: { borderRadius: 12 },
        label: { show: true, color: '#fff', fontSize: 13, formatter: '{b}: {d}%' },
        data: reportData.distributionAnalysis.map((c, idx) => ({
          value: c.value,
          name: c.name,
          itemStyle: { color: ['#f5c518', '#2563eb', '#10b981', '#ef4444', '#8b5cf6'][idx % 5] }
        }))
      }]
    };
  };

  // Format Helper
  const formatRupee = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  // Transitions
  const slideVariants = {
    enter: (dir) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir) => ({
      x: dir < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040814] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold" />
        <p className="text-gray-500 text-sm font-semibold">Loading slideshow deck...</p>
      </div>
    );
  }

  // Password walls
  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-[#040814] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Orbs */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-premium-blue/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gold/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md glass-card rounded-3xl p-8 border border-white/10 relative z-10 shadow-2xl shadow-black/40">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-gradient-to-br from-gold to-gold-accent rounded-2xl shadow-xl shadow-gold/20 mb-4">
              <Lock className="w-6 h-6 text-dark-bg" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Password Required</h2>
            <p className="text-sm text-gray-400 mt-2">
              This Takaful board presentation link is password-secured.
            </p>
          </div>

          {authError && (
            <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm p-3 rounded-xl mb-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter slides password"
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-extrabold rounded-xl shadow-lg shadow-gold/10 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer"
            >
              Verify & Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (authError || !presentation) {
    return (
      <div className="min-h-screen bg-[#040814] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400 text-sm max-w-sm mb-6">{authError || 'The presentation could not be loaded.'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold-accent text-dark-bg font-bold rounded-xl text-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040814] flex flex-col justify-between text-white relative overflow-hidden select-none">
      
      {/* 16:9 Presentation Deck Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[1100px] aspect-[16/9] bg-gradient-to-b from-[#0a1128] to-[#040814] border border-white/10 rounded-3xl p-8 sm:p-12 flex flex-col justify-between relative shadow-2xl shadow-black/80 overflow-hidden">
          
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={currentSlide.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col justify-between"
            >
              {/* Slide Header */}
              <div className="flex justify-between items-start border-b border-gold/20 pb-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-gold tracking-tight uppercase" style={{ margin: 0 }}>
                    {currentSlide.title}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">Takaful Foundation Board Report</p>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-bold text-gold uppercase tracking-wider">
                  {presentation.collectionFilter === 'all' ? 'All Collections' : `${presentation.collectionFilter} View`}
                </div>
              </div>

              {/* Slide Body */}
              <div className="flex-1 my-6 flex items-center justify-center overflow-hidden">

                {/* 1. COVER PAGE */}
                {currentSlide.id === 'cover' && (
                  <div className="text-center space-y-4 py-8">
                    <Sparkles className="w-16 h-16 text-gold mx-auto animate-pulse" />
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-widest text-white uppercase">{presentation.title}</h1>
                    <p className="text-lg text-gold font-bold tracking-widest uppercase">
                      {presentation.periodType === 'custom' ? 'Custom Range' : `FY ${reportData.kpis.fyLabel || 'Scope'}`}
                    </p>
                    <div className="w-32 h-0.5 bg-gold mx-auto my-4" />
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Takaful Management Information Systems</p>
                  </div>
                )}

                {/* 2. EXECUTIVE SUMMARY */}
                {currentSlide.id === 'summary' && (
                  <div className="grid grid-cols-3 gap-6 w-full text-center">
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl shadow-lg">
                      <span className="text-xs text-gray-400 block font-bold uppercase tracking-wider">Total Takaful Collection</span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-gold block mt-3">{formatRupee(reportData.kpis.totalCollection)}</span>
                      <span className="text-xs text-emerald-400 mt-1.5 block">+{reportData.kpis.growthPct}% vs Last Financial Year</span>
                    </div>
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl shadow-lg">
                      <span className="text-xs text-gray-400 block font-bold uppercase tracking-wider">Total Active Sponsors</span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-gold block mt-3">{reportData.kpis.totalSponsors}</span>
                      <span className="text-xs text-gray-500 mt-1.5 block">{reportData.kpis.premiumCount} High tier sponsors</span>
                    </div>
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl shadow-lg">
                      <span className="text-xs text-gray-400 block font-bold uppercase tracking-wider">Recruiters Performance</span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-gold block mt-3">{reportData.kpis.activePros} Officers</span>
                      <span className="text-xs text-emerald-400 mt-1.5 block">{reportData.kpis.contributingPros} Active contributors</span>
                    </div>
                  </div>
                )}

                {/* 3. COLLECTION SUMMARY */}
                {currentSlide.id === 'coll_summary' && (
                  <div className="grid grid-cols-2 gap-8 w-full items-center">
                    <div className="space-y-4">
                      <h4 className="text-sm text-gray-400 font-bold uppercase tracking-wider">Breakdown Metrics</h4>
                      <div className="space-y-3">
                        {reportData.categoryShare.map(c => (
                          <div key={c.name} className="flex justify-between items-center text-base border-b border-white/5 pb-2">
                            <span className="text-gray-300 font-semibold">{c.name}</span>
                            <span className="font-extrabold text-white">{formatRupee(c.value)} ({c.pct}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-6 bg-[#0d1b2a]/30 border border-white/10 rounded-3xl text-center shadow-lg">
                      <span className="text-sm text-gray-400 block font-bold uppercase tracking-wider">Grand Total Collection</span>
                      <span className="text-3xl sm:text-4xl font-extrabold text-gold block mt-3">{formatRupee(reportData.kpis.totalCollection)}</span>
                      <span className="text-xs text-gray-500 block mt-3">{reportData.kpis.contributingPros} active recruiters submitted</span>
                    </div>
                  </div>
                )}

                {/* 4. CATEGORY DETAILS */}
                {currentSlide.id === 'cat_details' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-[380px] h-[280px]">
                      <EChartWrapper option={getCategoryShareOption()} />
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4 text-xs ml-12">
                      {reportData.categoryShare.map(c => (
                        <div key={c.name} className="p-3 bg-white/[0.01] border border-white/5 rounded-2xl flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                          <div>
                            <div className="font-bold text-white text-sm">{c.name}</div>
                            <div className="text-gold font-bold text-sm mt-0.5">{formatRupee(c.value)} ({c.pct}%)</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. TOP CONTRIBUTORS */}
                {currentSlide.id === 'top_contributors' && (
                  <div className="w-full space-y-4">
                    <h4 className="text-sm text-gray-400 font-bold uppercase tracking-wider">Top 5 Performing Officers</h4>
                    <div className="grid grid-cols-5 gap-4">
                      {reportData.topContributors.map((c, idx) => (
                        <div key={c.proId} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center flex flex-col justify-between shadow">
                          <div>
                            <span className="text-xs font-bold text-gold block">RANK #{idx+1}</span>
                            <div className="font-bold text-white text-sm mt-2 truncate">{c.name}</div>
                            <span className="text-[10px] text-gray-500 block mt-1 truncate">{c.area}</span>
                          </div>
                          <span className="text-sm font-extrabold text-gold block mt-4">{formatRupee(c.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. SPONSOR SUMMARY */}
                {currentSlide.id === 'sponsor_summary' && (
                  <div className="grid grid-cols-4 gap-4 w-full text-center">
                    <div className="p-4 bg-[#0d1b2a]/40 border border-white/10 rounded-2xl">
                      <span className="text-xs text-gray-400 block font-bold uppercase">Total Sponsors</span>
                      <span className="text-3xl font-extrabold text-gold block mt-3">{reportData.kpis.totalSponsors}</span>
                      <span className="text-xs text-gray-500 mt-2 block">Active recurring base</span>
                    </div>
                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
                      <span className="text-xs text-gray-400 block font-bold uppercase">Premium Tier</span>
                      <span className="text-2xl font-extrabold text-white block mt-3">{reportData.kpis.premiumCount}</span>
                      <span className="text-xs text-gold mt-2 block">High tier sponsors</span>
                    </div>
                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
                      <span className="text-xs text-gray-400 block font-bold uppercase">Smart Tier</span>
                      <span className="text-2xl font-extrabold text-white block mt-3">{reportData.kpis.smartCount}</span>
                      <span className="text-xs text-gold mt-2 block">Medium tier sponsors</span>
                    </div>
                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
                      <span className="text-xs text-gray-400 block font-bold uppercase">Standard Tier</span>
                      <span className="text-2xl font-extrabold text-white block mt-3">{reportData.kpis.standardCount}</span>
                      <span className="text-xs text-gold mt-2 block">Base standard tiers</span>
                    </div>
                  </div>
                )}

                {/* 7. SPONSOR RANKINGS */}
                {currentSlide.id === 'sponsor_rankings' && (
                  <div className="w-full space-y-4">
                    <h4 className="text-sm text-gray-400 font-bold uppercase tracking-wider">Sponsor Recruiters Leaderboard</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {reportData.sponsorRankings.slice(0, 4).map((r, idx) => (
                        <div key={r.proId} className="flex justify-between items-center p-4 bg-white/[0.01] border border-white/5 rounded-2xl text-sm shadow">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-gold text-lg">#{idx+1}</span>
                            <div>
                              <div className="font-bold text-white text-base">{r.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{r.area} — {r.category}</div>
                            </div>
                          </div>
                          <span className="font-extrabold text-gold text-base">{r.total} Sponsors</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. DISTRIBUTION ANALYSIS */}
                {currentSlide.id === 'dist_analysis' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-[380px] h-[280px]">
                      <EChartWrapper option={getDistributionOption()} />
                    </div>
                    <div className="flex-1 space-y-2.5 ml-12 text-sm max-h-[260px] overflow-y-auto no-scrollbar">
                      {reportData.distributionAnalysis.map((d, idx) => (
                        <div key={d.name} className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-gray-300 font-semibold">{d.name}</span>
                          <span className="font-bold text-white">{formatRupee(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 9. MONTHLY COMPARISON */}
                {currentSlide.id === 'monthly_comparison' && (
                  <div className="w-full h-[280px]">
                    <EChartWrapper option={getCollectionTrendOption()} />
                  </div>
                )}

                {/* 10. ANNUAL COMPARISON */}
                {currentSlide.id === 'annual_comparison' && (
                  <div className="grid grid-cols-2 gap-8 w-full items-center text-center">
                    <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl shadow-lg">
                      <span className="text-sm text-gray-400 block font-bold uppercase tracking-wider">Current FY Collection</span>
                      <span className="text-4xl font-extrabold text-gold block mt-3">{formatRupee(reportData.kpis.totalCollection)}</span>
                      <span className="text-xs text-gray-500 mt-3 block">Active Target Period</span>
                    </div>
                    <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl shadow-lg">
                      <span className="text-sm text-gray-400 block font-bold uppercase tracking-wider">Previous FY Collection</span>
                      <span className="text-4xl font-extrabold text-white block mt-3">{formatRupee(reportData.kpis.prevCollection)}</span>
                      <span className="text-xs text-emerald-400 mt-3 block">Annual Growth: +{reportData.kpis.growthPct}%</span>
                    </div>
                  </div>
                )}

                {/* 11. GROWTH TRENDS */}
                {currentSlide.id === 'growth_trends' && (
                  <div className="w-full h-[280px]">
                    <EChartWrapper option={getSponsorGrowthOption()} />
                  </div>
                )}

                {/* 12. AI INSIGHTS */}
                {currentSlide.id === 'ai_insights' && (
                  <div className="w-full text-left space-y-4 pl-12">
                    {reportData.insights.map((ins, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <span className="w-3 h-3 rounded-full bg-gold shrink-0 mt-1.5" />
                        <p className="text-base font-semibold text-gray-200">{ins}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 13. PRO DETAIL */}
                {currentSlide.id === 'pro_detail' && (
                  <div className="w-full border border-white/10 rounded-2xl overflow-y-auto max-h-[260px] no-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                          <th className="px-5 py-2.5">Rank</th>
                          <th className="px-5 py-2.5">Recruiter Officer</th>
                          <th className="px-5 py-2.5 text-right">Takaful</th>
                          <th className="px-5 py-2.5 text-right">Additional</th>
                          <th className="px-5 py-2.5 text-right text-gold">Total Performance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reportData.recruiterRankings.slice(0, 10).map((r) => (
                          <tr key={r.proId} className="text-gray-300 hover:bg-white/[0.01]">
                            <td className="px-5 py-2 font-bold text-gold">#{r.rank}</td>
                            <td className="px-5 py-2 font-semibold text-white truncate max-w-[150px]">{r.name}</td>
                            <td className="px-5 py-2 text-right">{formatRupee(r.takaful)}</td>
                            <td className="px-5 py-2 text-right">{formatRupee(r.additional)}</td>
                            <td className="px-5 py-2 text-right font-bold text-gold">{formatRupee(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 14. DIRECT COLLECTIONS */}
                {currentSlide.id === 'direct_cols' && (
                  <div className="w-full border border-white/10 rounded-2xl overflow-y-auto max-h-[260px] no-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-white/5 text-gray-400 uppercase font-bold border-b border-white/10">
                          <th className="px-5 py-2.5">Recruiter</th>
                          {reportData.directCollectionHeads.map(head => (
                            <th key={head} className="px-5 py-2.5 text-right">{head}</th>
                          ))}
                          <th className="px-5 py-2.5 text-right text-gold">Grand Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reportData.directCollections.slice(0, 10).map((r, idx) => (
                          <tr key={idx} className="text-gray-300 hover:bg-white/[0.01]">
                            <td className="px-5 py-2 font-semibold text-white truncate max-w-[150px]">{r.proName}</td>
                            {reportData.directCollectionHeads.map(head => (
                              <td key={head} className="px-5 py-2 text-right">{formatRupee(r.headAmounts[head])}</td>
                            ))}
                            <td className="px-5 py-2 text-right font-bold text-gold">{formatRupee(r.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 15. CLOSING SLIDE */}
                {currentSlide.id === 'closing' && (
                  <div className="text-center space-y-4 py-8" style={{ width: '100%' }}>
                    <h2 className="text-4xl font-extrabold text-gold tracking-widest uppercase">THANK YOU</h2>
                    <p className="text-base text-gray-300">For your support and dedication to Takaful initiatives.</p>
                    <div className="w-24 h-0.5 bg-gold mx-auto my-4" />
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Takaful Foundation — Board of Directors</p>
                  </div>
                )}

              </div>

              {/* Slide Footer */}
              <div className="flex justify-between items-center border-t border-white/5 pt-3 text-[10px] text-gray-500">
                <span>Period: {presentation.periodType === 'custom' ? `${presentation.customRange?.startDate} to ${presentation.customRange?.endDate}` : `FY ${reportData.kpis.fyLabel || 'N/A'}`}</span>
                <span>Slide {currentSlideIndex + 1} of {activeSlides.length}</span>
              </div>
            </motion.div>
          </AnimatePresence>

        </div>
      </div>

      {/* Fullscreen Deck Controls footer */}
      <footer className="bg-slate-950/80 border-t border-white/5 px-6 py-4 flex items-center justify-between gap-4 backdrop-blur-md relative z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition cursor-pointer"
            title="Go to Dashboard"
          >
            <Home className="w-4 h-4" />
          </button>
          
          {/* Jump select */}
          <select
            value={currentSlideIndex}
            onChange={(e) => setCurrentSlideIndex(Number(e.target.value))}
            className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gold font-bold focus:outline-none"
          >
            {activeSlides.map((s, idx) => (
              <option key={s.id} value={idx}>
                {idx + 1}. {s.title}
              </option>
            ))}
          </select>
        </div>

        {/* Progress bar indicator */}
        <div className="hidden md:flex flex-1 max-w-sm bg-white/10 h-1 rounded-full overflow-hidden mx-4">
          <div
            className="bg-gold h-full transition-all duration-300"
            style={{ width: `${((currentSlideIndex + 1) / activeSlides.length) * 100}%` }}
          />
        </div>

        {/* Next/Prev arrow controller buttons */}
        <div className="flex items-center gap-2">
          <button
            disabled={currentSlideIndex === 0}
            onClick={prevSlide}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-xl border border-white/5 text-sm font-bold text-gray-200 transition cursor-pointer flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          
          <span className="text-xs text-gray-500 font-semibold px-2">
            {currentSlideIndex + 1} / {activeSlides.length}
          </span>

          <button
            disabled={currentSlideIndex === activeSlides.length - 1}
            onClick={nextSlide}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-xl border border-white/5 text-sm font-bold text-gray-200 transition cursor-pointer flex items-center gap-1.5"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition cursor-pointer ml-2"
            title="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PublicPresentation;
