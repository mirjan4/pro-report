import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AppContext = createContext(null);

const allCollectionsPseudo = {
  _id: 'all',
  name: 'All Collections',
  code: 'all',
  color: '#d4af37',
  description: 'Aggregated view of all collections',
  isActive: true
};

const allYearsPseudo = {
  _id: 'all',
  year: 'All Years',
  label: 'All Years',
  isActive: false
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [financialYears, setFinancialYears] = useState([allYearsPseudo]);
  const [selectedFY, setSelectedFY] = useState(allYearsPseudo);
  const [pros, setPros] = useState([]);
  const [modules, setModules] = useState([allCollectionsPseudo]);
  const [selectedModule, setSelectedModule] = useState(allCollectionsPseudo);
  const [collectionHeads, setCollectionHeads] = useState([]);
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
      const [fyRes, prosRes, modRes, headsRes] = await Promise.all([
        client.get('/api/financial-years?includeArchived=true'),
        client.get('/api/pros'),
        client.get('/api/modules'),
        client.get('/api/collection-heads')
      ]);

      if (fyRes.data.success) {
        const fyList = [allYearsPseudo, ...fyRes.data.data.map(fy => ({ ...fy, label: fy.year }))];
        setFinancialYears(fyList);
        const savedFYId = localStorage.getItem('selectedFYId');
        const savedFY = fyList.find(fy => fy._id === savedFYId);
        setSelectedFY(savedFY || allYearsPseudo);
      }

      if (prosRes.data.success) {
        setPros(prosRes.data.data);
      }

      if (modRes.data.success) {
        const activeModules = modRes.data.data.filter(m => m.isActive || ['pro', 'ofc', 'glb'].includes(m.code));
        const modulesList = [allCollectionsPseudo, ...activeModules];
        setModules(modulesList);
        // Default to saved module, or "All Collections"
        const savedModuleId = localStorage.getItem('selectedModuleId');
        const savedModule = modulesList.find(m => m._id === savedModuleId);
        setSelectedModule(savedModule || allCollectionsPseudo);
      }

      if (headsRes && headsRes.data.success) {
        setCollectionHeads(headsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  const handleSetSelectedFY = (fy) => {
    const target = fy || allYearsPseudo;
    setSelectedFY(target);
    if (target && target._id !== 'all') {
      localStorage.setItem('selectedFYId', target._id);
    } else {
      localStorage.removeItem('selectedFYId');
    }
  };

  const handleSetSelectedModule = (mod) => {
    const target = mod || allCollectionsPseudo;
    setSelectedModule(target);
    if (target && target.code !== 'all') {
      localStorage.setItem('selectedModuleId', target._id);
    } else {
      localStorage.removeItem('selectedModuleId');
    }
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

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await client.post('/api/auth/change-password', { currentPassword, newPassword });
      if (res.data.success) {
        const updatedUser = { ...user, needsPasswordChange: false };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to change password'
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setFinancialYears([allYearsPseudo]);
    setSelectedFY(allYearsPseudo);
    setPros([]);
    setModules([allCollectionsPseudo]);
    setSelectedModule(allCollectionsPseudo);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedModuleId');
    localStorage.removeItem('selectedFYId');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        financialYears,
        selectedFY,
        setSelectedFY: handleSetSelectedFY,
        pros,
        setPros,
        setFinancialYears,
        modules,
        setModules,
        selectedModule,
        setSelectedModule: handleSetSelectedModule,
        collectionHeads,
        setCollectionHeads,
        loading,
        login,
        logout,
        changePassword,
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
