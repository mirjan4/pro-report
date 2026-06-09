import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import client from '../api/client';
import EChartWrapper from '../components/EChartWrapper';
import {
  BrainCircuit,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  BarChart2
} from 'lucide-react';

const Insights = () => {
  const { selectedFY, selectedModule } = useApp();
  const [insights, setInsights] = useState(null);
  const [zeroContributors, setZeroContributors] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFY?._id) return;
      setLoading(true);
      try {
        const modParam = selectedModule ? `&module=${selectedModule._id}` : '';
        const [insightsRes, rankingsRes] = await Promise.all([
          client.get(`/api/analytics/insights?financialYear=${selectedFY._id}${modParam}`),
          client.get(`/api/analytics/rankings?financialYear=${selectedFY._id}${modParam}`)
        ]);
        if (insightsRes.data.success) setInsights(insightsRes.data.data);
        if (rankingsRes.data.success) {
          setZeroContributors(rankingsRes.data.data.zeroPros || []);
          setRankings(rankingsRes.data.data.rankings || []);
        }
      } catch (err) {
        console.error('Failed to load insights', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedFY, selectedModule]);

  // Small/Additional contributors: those with total below average
  const avgCollection = rankings.length > 0
    ? rankings.reduce((s, p) => s + p.total, 0) / rankings.length
    : 0;
  const smallerContributors = rankings.filter(p => p.total < avgCollection && p.total > 0);

  const smallerContributorsChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(13, 27, 42, 0.9)',
      borderColor: 'rgba(245, 197, 24, 0.3)',
      textStyle: { color: '#fff' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: { color: '#9ca3af' }
    },
    yAxis: {
      type: 'category',
      data: smallerContributors.map(p => p.name),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#9ca3af' }
    },
    series: [
      {
        name: 'Total Collection',
        type: 'bar',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.6)' },
              { offset: 1, color: '#3b82f6' }
            ]
          },
          borderRadius: [0, 4, 4, 0]
        },
        data: smallerContributors.map(p => p.total)
      }
    ]
  };

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
      <div className="flex items-center space-x-3">
        <div className="p-2.5 bg-gradient-to-br from-gold to-gold-accent rounded-xl shadow-lg shadow-gold/20">
          <BrainCircuit className="w-6 h-6 text-dark-bg" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">
            AI <span className="gold-gradient-text">Insights</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Automated recommendations and risk analysis based entirely on current database records — {selectedFY?.label}
          </p>
        </div>
      </div>

      {/* Main Insights Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Findings */}
        <div className="glass-card rounded-2xl p-6 border-l-4 border-l-premium-light/50">
          <h3 className="text-lg font-bold text-white flex items-center mb-4">
            <Sparkles className="w-5 h-5 mr-2 text-gold animate-pulse" />
            Key Findings & Summary
          </h3>
          <div className="space-y-3">
            {insights?.keyFindings?.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-3 text-sm text-gray-300">
                <span className="text-gold mt-1 font-semibold">{idx + 1}.</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Growth Opportunities */}
        <div className="glass-card rounded-2xl p-6 border-l-4 border-l-gold/50">
          <h3 className="text-lg font-bold text-white flex items-center mb-4">
            <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" />
            Growth Opportunities
          </h3>
          <div className="space-y-3">
            {insights?.growthOpportunities?.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-3 text-sm text-gray-300">
                <Lightbulb className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weak Areas */}
        <div className="glass-card rounded-2xl p-6 border-l-4 border-l-rose-500/50">
          <h3 className="text-lg font-bold text-white flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 mr-2 text-rose-400" />
            Weak Areas & Risks
          </h3>
          <div className="space-y-3">
            {insights?.weakAreas?.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-3 text-sm text-gray-300">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actionable Recommendations */}
        <div className="glass-card rounded-2xl p-6 border-l-4 border-l-amber-500/50">
          <h3 className="text-lg font-bold text-white flex items-center mb-4">
            <Lightbulb className="w-5 h-5 mr-2 text-amber-500" />
            Recommendations & Monitoring Plan
          </h3>
          <div className="space-y-3">
            {insights?.recommendations?.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-3 text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zero Contributors Section */}
      <div className="glass-card rounded-2xl p-6 border border-rose-500/20 bg-rose-950/5">
        <h3 className="text-lg font-bold text-rose-400 flex items-center mb-4">
          <AlertTriangle className="w-5 h-5 mr-2 text-rose-400" />
          Zero Contributors Warning Directory
        </h3>
        {zeroContributors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zeroContributors.map(pro => (
              <div key={pro.proId} className="p-4 bg-slate-950/40 border border-rose-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white text-sm">{pro.name}</h4>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 uppercase bg-rose-500/10 text-rose-400">
                    Status: {pro.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-rose-400 block font-bold">₹0.00</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Collection</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No active contributors currently have zero collections.</p>
        )}
      </div>

      {/* Additional/Smaller Contributors Chart Analysis */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-2 flex items-center">
          <BarChart2 className="w-5 h-5 mr-2 text-gold" />
          Additional/Smaller Contributors Comparison
        </h3>
        <p className="text-xs text-gray-400 mb-6">
          Relative scale of PROs whose individual totals are below average (₹{avgCollection.toLocaleString('en-IN')})
        </p>
        <div className="h-80">
          {smallerContributors.length > 0 ? (
            <EChartWrapper option={smallerContributorsChartOption} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              No smaller contributors recorded in database.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Insights;
