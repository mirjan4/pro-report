import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
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

const PrivateLayout = ({ children }) => {
  const { token, loading } = useApp();

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

          {/* Admin-Only Routes */}
          <Route path="/pros" element={<PrivateLayout><AdminRoute><ProManagement /></AdminRoute></PrivateLayout>} />
          <Route path="/collections" element={<PrivateLayout><AdminRoute><CollectionEntry /></AdminRoute></PrivateLayout>} />
          <Route path="/sponsors" element={<PrivateLayout><AdminRoute><SponsorEntry /></AdminRoute></PrivateLayout>} />
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
