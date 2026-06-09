import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Trophy,
  GitCompare,
  BrainCircuit,
  Users,
  Calendar,
  Layers,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  Sparkles,
  Package,
  ChevronDown,
  ChevronUp,
  LineChart,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Map module icon code to lucide icon component
const moduleIconMap = {
  users: Users,
  globe: BarChart3,
  building: Layers,
  layers: Layers,
  default: Package
};

const ModuleIcon = ({ icon, className }) => {
  const IconComp = moduleIconMap[icon] || moduleIconMap.default;
  return <IconComp className={className} />;
};

const Navbar = () => {
  const { user, logout, financialYears, selectedFY, setSelectedFY, modules, selectedModule, setSelectedModule } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [moduleDropOpen, setModuleDropOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [adminSectionExpanded, setAdminSectionExpanded] = useState(false);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarAnalyticsExpanded');
    return saved ? saved === 'true' : true;
  });
  const [adminExpanded, setAdminExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarAdminExpanded');
    return saved ? saved === 'true' : true;
  });
  const navigate = useNavigate();

  const toggleAnalytics = () => {
    setAnalyticsExpanded(prev => {
      const next = !prev;
      localStorage.setItem('sidebarAnalyticsExpanded', String(next));
      return next;
    });
  };

  const toggleAdmin = () => {
    setAdminExpanded(prev => {
      const next = !prev;
      localStorage.setItem('sidebarAdminExpanded', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/analytics', label: 'Collection Analysis', icon: BarChart3 },
    { path: '/rankings', label: 'Top Performers', icon: Trophy },
    { path: '/comparison', label: 'Annual Comparison', icon: GitCompare },
    { path: '/monthly-comparison', label: 'Monthly Comparison', icon: LineChart },
    { path: '/insights', label: 'AI Insights', icon: BrainCircuit },
    { path: '/reports', label: 'Reports', icon: FileSpreadsheet },
  ];

  const adminItems = [
    { path: '/pros', label: 'PRO Management', icon: Users },
    { path: '/collections', label: 'Collection Entry', icon: Layers },
    { path: '/financial-years', label: 'FY Management', icon: Calendar },
    { path: '/modules', label: 'Module Management', icon: Package },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  const renderNavLinks = (items) => {
    return items.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={() => setIsOpen(false)}
        title={isCollapsed ? item.label : ''}
        className={({ isActive }) =>
          `flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
            isCollapsed ? 'justify-center' : 'space-x-3'
          } ${
            isActive
              ? 'bg-gradient-to-r from-premium-blue/40 to-premium-blue/10 border-l-4 border-gold text-white shadow-lg shadow-premium-blue/10'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`
        }
      >
        <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-200 shrink-0" />
        {!isCollapsed && <span className="font-medium text-sm truncate animate-fadeIn">{item.label}</span>}
      </NavLink>
    ));
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-dark-bg/80 border-b border-white/5 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-6 h-6 text-gold animate-pulse" />
          <span className="font-bold tracking-wider text-white bg-gradient-to-r from-white to-gold-accent bg-clip-text text-transparent">TAKAFUL PRO</span>
        </div>
        <div className="flex items-center space-x-4">
          {financialYears.length > 0 && (
            <select
              value={selectedFY?._id || ''}
              onChange={(e) => {
                const fy = financialYears.find(y => y._id === e.target.value);
                if (fy) setSelectedFY(fy);
              }}
              className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gold font-semibold focus:outline-none focus:border-gold"
            >
              {financialYears.map((fy) => (
                <option key={fy._id} value={fy._id}>
                  {fy.year} {fy.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          )}
          <button onClick={toggleSidebar} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div onClick={toggleSidebar} className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300" />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 lg:static z-50 bg-gradient-to-b from-[#0a1128] to-[#040814] border-r border-white/5 flex flex-col justify-between transform transition-all duration-300 lg:transform-none lg:h-screen lg:sticky lg:top-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'w-72 lg:w-20' : 'w-72 lg:w-72'}`}
      >
        <div>
          {/* Logo & Header */}
          <div className={`p-6 hidden lg:flex items-center space-x-3 border-b border-white/5 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="p-2 bg-gradient-to-br from-gold to-gold-accent rounded-xl shadow-lg shadow-gold/20 shrink-0">
              <Sparkles className="w-5 h-5 text-dark-bg" />
            </div>
            {!isCollapsed && (
              <div className="animate-fadeIn truncate">
                <h1 className="font-bold text-lg leading-none tracking-wider text-white">TAKAFUL</h1>
                <span className="text-[10px] uppercase tracking-widest text-gold font-semibold">Collection Analysis</span>
              </div>
            )}
          </div>

          {/* User Profile Summary - Collapsible */}
          <div className="p-4 border-b border-white/5 bg-white/[0.01]">
            <button
              onClick={() => setAdminSectionExpanded(prev => !prev)}
              className={`w-full flex items-center bg-[#0d1b2a]/60 border border-white/10 hover:border-gold/30 rounded-xl px-3 py-2.5 text-xs font-bold text-gold transition-colors duration-200 cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-between'}`}
              title={isCollapsed ? 'Admin Control' : ''}
            >
              <div className="flex items-center space-x-2">
                {adminSectionExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gold shrink-0" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-gold shrink-0" />
                )}
                {!isCollapsed && <span>Admin</span>}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {adminSectionExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className={`overflow-hidden flex flex-col ${isCollapsed ? 'items-center space-y-4 pt-4' : 'space-y-4 pt-4'}`}
                >
                  {/* User Profile Details */}
                  <div className="flex items-center space-x-3 w-full">
                    <div className="w-10 h-10 rounded-xl bg-premium-blue/30 border border-premium-light/20 flex items-center justify-center font-bold text-gold text-lg shrink-0">
                      {user?.fullName?.charAt(0) || 'A'}
                    </div>
                    {!isCollapsed && (
                      <div className="overflow-hidden animate-fadeIn">
                        <h3 className="text-sm font-semibold text-white truncate">{user?.fullName || 'Administrator'}</h3>
                        <p className="text-xs text-gold/80 font-medium capitalize">{user?.role || 'Admin'} Account</p>
                      </div>
                    )}
                  </div>

                  {/* FY Filter Dropdown */}
                  {financialYears.length > 0 && (
                    <div className="w-full">
                      {!isCollapsed ? (
                        <div className="animate-fadeIn">
                          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Reporting Year</label>
                          <select
                            value={selectedFY?._id || ''}
                            onChange={(e) => {
                              const fy = financialYears.find(y => y._id === e.target.value);
                              if (fy) setSelectedFY(fy);
                            }}
                            className="w-full bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-gold font-semibold focus:outline-none focus:border-gold transition-colors duration-200"
                          >
                            {financialYears.map((fy) => (
                              <option key={fy._id} value={fy._id}>
                                {fy.year} {fy.isActive ? '(Active)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-center text-xs text-gold font-bold" title={`Reporting Year: ${selectedFY?.year || 'N/A'}`}>
                          {selectedFY?.year ? selectedFY.year.split('-')[0] : 'FY'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Module Selector */}
                  {modules.length > 0 && (
                    <div className="w-full">
                      {!isCollapsed ? (
                        <div className="animate-fadeIn">
                          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Active Module</label>
                          <div className="relative">
                            <button
                              onClick={() => setModuleDropOpen(o => !o)}
                              className="w-full flex items-center justify-between gap-2 bg-[#0d1b2a]/60 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none hover:border-white/20 transition-colors duration-200"
                              style={{ color: selectedModule?.color || '#d4af37' }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedModule?.color || '#d4af37' }} />
                                <span className="truncate">{selectedModule?.name || 'Select Module'}</span>
                              </div>
                              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${moduleDropOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {moduleDropOpen && (
                              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0d1b2a] border border-white/10 rounded-xl overflow-hidden shadow-xl shadow-black/40">
                                {modules.map((mod) => (
                                  <button
                                    key={mod._id}
                                    onClick={() => { setSelectedModule(mod); setModuleDropOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-white/5 transition-colors duration-150 ${selectedModule?._id === mod._id ? 'bg-white/5' : ''}`}
                                  >
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: mod.color }} />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-white truncate">{mod.name}</div>
                                      {mod.description && <div className="text-[10px] text-gray-500 truncate">{mod.description}</div>}
                                    </div>
                                    {selectedModule?._id === mod._id && (
                                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: mod.color, background: mod.color + '22' }}>Active</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <span
                            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/10 cursor-pointer"
                            style={{ background: selectedModule?.color || '#d4af37' }}
                            title={`Active Module: ${selectedModule?.name || 'N/A'}`}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Main Navigation Links */}
        <div className="p-4 space-y-1.5 overflow-y-auto no-scrollbar max-h-[calc(100vh-380px)]">
          {/* Analytics Section Header */}
          <button
            onClick={toggleAnalytics}
            className={`w-full flex items-center justify-between py-2 text-left text-[10px] text-gray-500 font-bold uppercase tracking-wider hover:text-white transition-colors duration-150 group cursor-pointer ${
              isCollapsed ? 'justify-center px-0 mb-2' : 'px-4 mb-2'
            }`}
            title={isCollapsed ? (analyticsExpanded ? 'Collapse Analytics' : 'Expand Analytics') : ''}
          >
            {!isCollapsed ? (
              <>
                <span>Analytics</span>
                <ChevronRight className={`w-3.5 h-3.5 text-gold transition-transform duration-300 ${analyticsExpanded ? 'rotate-90' : ''}`} />
              </>
            ) : (
              <ChevronRight className={`w-4 h-4 text-gold transition-transform duration-300 ${analyticsExpanded ? 'rotate-90' : ''}`} />
            )}
          </button>

          {/* Analytics Links */}
          <AnimatePresence initial={false}>
            {analyticsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden space-y-1.5"
              >
                {renderNavLinks(navItems)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Administration Section Header */}
          {user?.role === 'admin' && (
            <>
              <button
                onClick={toggleAdmin}
                className={`w-full flex items-center justify-between py-2 mt-4 text-left text-[10px] text-gray-500 font-bold uppercase tracking-wider hover:text-white transition-colors duration-150 group cursor-pointer ${
                  isCollapsed ? 'justify-center px-0 mb-2' : 'px-4 mb-2'
                }`}
                title={isCollapsed ? (adminExpanded ? 'Collapse Administration' : 'Expand Administration') : ''}
              >
                {!isCollapsed ? (
                  <>
                    <span>Administration</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-gold transition-transform duration-300 ${adminExpanded ? 'rotate-90' : ''}`} />
                  </>
                ) : (
                  <ChevronRight className={`w-4 h-4 text-gold transition-transform duration-300 ${adminExpanded ? 'rotate-90' : ''}`} />
                )}
              </button>

              {/* Administration Links */}
              <AnimatePresence initial={false}>
                {adminExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden space-y-1.5"
                  >
                    {renderNavLinks(adminItems)}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-white/5 bg-white/[0.01] space-y-2">
          {/* Collapse button for desktop */}
          <button
            onClick={toggleCollapse}
            className="w-full hidden lg:flex items-center px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gold" />
            ) : (
              <div className="flex items-center space-x-3">
                <ChevronLeft className="w-5 h-5 text-gold" />
                <span className="font-semibold text-sm">Collapse Menu</span>
              </div>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-rose-500/10 hover:border hover:border-rose-500/20 transition-all duration-200 group cursor-pointer"
            title="Sign Out"
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}
          >
            <LogOut className="w-5 h-5 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-transform duration-200 shrink-0" />
            {!isCollapsed && <span className="font-semibold text-sm truncate animate-fadeIn ml-3">Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
