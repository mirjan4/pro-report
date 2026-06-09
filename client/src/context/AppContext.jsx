import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedFY, setSelectedFY] = useState(null);
  const [pros, setPros] = useState([]);
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await client.get('/api/auth/me');
          if (res.data.success) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            await loadMetadata();
          }
        } catch (err) {
          console.error('Auth initialization failed', err);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const loadMetadata = async () => {
    try {
      const [fyRes, prosRes, modRes] = await Promise.all([
        client.get('/api/financial-years'),
        client.get('/api/pros'),
        client.get('/api/modules')
      ]);

      if (fyRes.data.success) {
        setFinancialYears(fyRes.data.data);
        const active = fyRes.data.data.find(fy => fy.isActive);
        if (active) setSelectedFY(active);
        else if (fyRes.data.data.length > 0) setSelectedFY(fyRes.data.data[0]);
      }

      if (prosRes.data.success) {
        setPros(prosRes.data.data);
      }

      if (modRes.data.success) {
        const activeModules = modRes.data.data.filter(m => m.isActive);
        setModules(activeModules);
        // Default to PRO module, or first active module
        const savedModuleId = localStorage.getItem('selectedModuleId');
        const savedModule = activeModules.find(m => m._id === savedModuleId);
        const proMod = activeModules.find(m => m.code === 'pro');
        setSelectedModule(savedModule || proMod || activeModules[0] || null);
      }
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  const handleSetSelectedModule = (mod) => {
    setSelectedModule(mod);
    if (mod) localStorage.setItem('selectedModuleId', mod._id);
    else localStorage.removeItem('selectedModuleId');
  };

  const login = async (username, password) => {
    try {
      const res = await client.post('/api/auth/login', { username, password });
      if (res.data.success) {
        const { token: jwt, user: userData } = res.data;
        setToken(jwt);
        setUser(userData);
        localStorage.setItem('token', jwt);
        localStorage.setItem('user', JSON.stringify(userData));
        await loadMetadata();
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Invalid username or password'
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setFinancialYears([]);
    setSelectedFY(null);
    setPros([]);
    setModules([]);
    setSelectedModule(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedModuleId');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        financialYears,
        selectedFY,
        setSelectedFY,
        pros,
        setPros,
        setFinancialYears,
        modules,
        setModules,
        selectedModule,
        setSelectedModule: handleSetSelectedModule,
        loading,
        login,
        logout,
        refreshMetadata: loadMetadata
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
