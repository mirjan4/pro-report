import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Rankings from './pages/Rankings';
import Comparison from './pages/Comparison';
import MonthlyComparison from './pages/MonthlyComparison';
import Insights from './pages/Insights';
import ProManagement from './pages/ProManagement';
import CollectionEntry from './pages/CollectionEntry';
import SponsorEntry from './pages/SponsorEntry';
import FinancialYearManagement from './pages/FinancialYearManagement';
import ProProfile from './pages/ProProfile';
import Reports from './pages/Reports';
import ModuleManagement from './pages/ModuleManagement';
import DistributionEntry from './pages/DistributionEntry';
import PresentationBuilder from './pages/PresentationBuilder';
import PublicPresentation from './pages/PublicPresentation';

const ForcePasswordChangeModal = () => {
  const { changePassword, logout } = useApp();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    const result = await changePassword(currentPassword, newPassword);
    setSubmitting(false);

    if (result.success) {
      setSuccess('Password updated successfully! Loading...');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="w-full max-w-md glass-card rounded-3xl p-8 border border-white/10 relative z-10 shadow-2xl shadow-black/40">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-gradient-to-br from-gold to-gold-accent rounded-2xl shadow-xl shadow-gold/20 mb-4 animate-pulse">
          <Lock className="w-6 h-6 text-dark-bg" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Password Change Required</h2>
        <p className="text-sm text-gray-400 mt-2">
          Your account is configured with a temporary password. Please choose a new secure password to continue.
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm p-3 rounded-xl mb-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-3 rounded-xl mb-4">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Current Password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter temporary password"
            className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-all duration-200"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">New Password</label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Choose new password"
            className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-all duration-200"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Confirm New Password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-all duration-200"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-gradient-to-r from-gold to-gold-accent hover:from-gold-accent hover:to-gold text-dark-bg font-bold rounded-xl shadow-lg shadow-gold/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 glow-btn mt-6"
        >
          {submitting ? 'Updating...' : 'Save & Continue'}
        </button>

        <button
          type="button"
          onClick={logout}
          className="w-full py-3 border border-white/10 hover:bg-white/5 text-gray-300 font-bold rounded-xl transition-all duration-200 text-xs mt-2"
        >
          Cancel & Sign Out
        </button>
      </form>
    </div>
  );
};

const PrivateLayout = ({ children }) => {
  const { token, loading, user } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.needsPasswordChange) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Orbs */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-premium-blue/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gold/5 rounded-full blur-[120px] pointer-events-none" />
        <ForcePasswordChangeModal />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-dark-bg">
      <Navbar />
      <main className="flex-1 overflow-y-auto h-screen max-w-full">
        {children}
      </main>
    </div>
  );
};

const AdminRoute = ({ children }) => {
  const { user, token, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

const App = () => {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<PrivateLayout><Dashboard /></PrivateLayout>} />
          <Route path="/analytics" element={<PrivateLayout><Analytics /></PrivateLayout>} />
          <Route path="/rankings" element={<PrivateLayout><Rankings /></PrivateLayout>} />
          <Route path="/comparison" element={<PrivateLayout><Comparison /></PrivateLayout>} />
          <Route path="/monthly-comparison" element={<PrivateLayout><MonthlyComparison /></PrivateLayout>} />
          <Route path="/insights" element={<PrivateLayout><Insights /></PrivateLayout>} />
          <Route path="/reports" element={<PrivateLayout><Reports /></PrivateLayout>} />
          <Route path="/pro/:id" element={<PrivateLayout><ProProfile /></PrivateLayout>} />
          <Route path="/sponsors" element={<PrivateLayout><SponsorEntry /></PrivateLayout>} />
          <Route path="/presentation-builder" element={<PrivateLayout><PresentationBuilder /></PrivateLayout>} />

          {/* Public Presentation Route */}
          <Route path="/presentation/:id" element={<PublicPresentation />} />

          {/* Admin-Only Routes */}
          <Route path="/pros" element={<PrivateLayout><AdminRoute><ProManagement /></AdminRoute></PrivateLayout>} />
          <Route path="/collections" element={<PrivateLayout><AdminRoute><CollectionEntry /></AdminRoute></PrivateLayout>} />
          <Route path="/distributions" element={<PrivateLayout><AdminRoute><DistributionEntry /></AdminRoute></PrivateLayout>} />
          <Route path="/financial-years" element={<PrivateLayout><AdminRoute><FinancialYearManagement /></AdminRoute></PrivateLayout>} />
          <Route path="/modules" element={<PrivateLayout><AdminRoute><ModuleManagement /></AdminRoute></PrivateLayout>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AppProvider>
  );
};

export default App;
