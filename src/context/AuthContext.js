import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { pushNotificationService } from '../services/pushNotificationService';
import { locationService } from '../services/locationService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await authService.getStoredUser();
        if (stored.token && stored.user) {
          setUser(stored.user);
          setToken(stored.token);
        }
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  // Enregistrer push token quand connecte
  useEffect(() => {
    if (user && token) {
      pushNotificationService.registerForPushNotifications();
      // Livraison en cours ? Reprendre le partage de position automatiquement
      locationService.resumeActiveDelivery();
    }
  }, [user, token]);

  const login = async (email, password) => {
    const result = await authService.login(email, password);
    setUser(result.user);
    setToken(result.token);
    return result;
  };

  const logout = async () => {
    await locationService.stopAll();
    await pushNotificationService.removePushToken();
    await authService.logout();
    setUser(null);
    setToken(null);
  };

  const updateUser = (updated) => setUser(prev => ({ ...prev, ...updated }));

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
