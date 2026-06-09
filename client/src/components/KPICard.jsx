import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

const KPICard = ({ title, value, icon: Icon, trend, trendValue, isCurrency = true, suffix = '', subtitle }) => {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="glass-card relative overflow-hidden rounded-2xl p-6"
    >
      {/* Glow Highlight Effect */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-premium-blue/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold mt-2 text-white font-sans tracking-tight">
            <AnimatedCounter value={value} formatAsCurrency={isCurrency} suffix={suffix} />
          </h3>
        </div>
        <div className="p-3 bg-premium-blue/20 border border-premium-light/20 rounded-xl text-gold">
          {Icon && <Icon className="w-6 h-6" />}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center space-x-1">
          {trend === 'up' && (
            <span className="flex items-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              {trendValue}%
            </span>
          )}
          {trend === 'down' && (
            <span className="flex items-center text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              {trendValue}%
            </span>
          )}
          {trend === 'flat' && (
            <span className="flex items-center text-xs font-semibold text-gray-400 bg-gray-500/10 px-2 py-0.5 rounded-full">
              <Minus className="w-3.5 h-3.5 mr-0.5" />
              {trendValue}%
            </span>
          )}
          {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
        </div>
      </div>
    </motion.div>
  );
};

export default KPICard;
