import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/api';

interface VerificationContextType {
  isVerified: boolean;
  applicationStatus: 'pending' | 'approved' | 'rejected';
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
}

export const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

interface VerificationProviderProps {
  children: ReactNode;
}

export const VerificationProvider: React.FC<VerificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isLoading, setIsLoading] = useState(true);

  const checkVerificationStatus = async () => {
    if (!user?.user_id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.get(`/tutors/${user.user_id}/status`);
      setIsVerified(response.data.is_verified);
      setApplicationStatus(response.data.status);
    } catch (error) {
      console.error('Failed to check verification status:', error);
      setIsVerified(false);
      setApplicationStatus('pending');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = async () => {
    setIsLoading(true);
    await checkVerificationStatus();
  };

  useEffect(() => {
    checkVerificationStatus();
  }, [user]);

  const value = {
    isVerified,
    applicationStatus,
    isLoading,
    refreshStatus,
  };

  return (
    <VerificationContext.Provider value={value}>
      {children}
    </VerificationContext.Provider>
  );
};

export const useVerification = () => {
  const context = React.useContext(VerificationContext);
  if (context === undefined) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
};
