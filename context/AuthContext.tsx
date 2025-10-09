import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import apiClient from '../services/api';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (details: { name: string; email: string; password?: string }) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const handleAuthSuccess = (data: { user: User; accessToken: string }) => {
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.accessToken);
    navigate('/');
  }

  const login = async (email: string, password?: string) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      handleAuthSuccess(response.data);
    } catch (err: any) {
      // Toast is shown globally by axios interceptor; avoid duplicate here
      throw err;
    }
  };
  
  const register = async (details: { name: string; email: string; password?: string }) => {
    try {
      const response = await apiClient.post('/auth/register', details);
      handleAuthSuccess(response.data);
    } catch (err: any) {
      // Toast is shown globally by axios interceptor; avoid duplicate here
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
