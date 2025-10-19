import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // You might want to show a loading spinner here
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user) {
    // Decide redirect target based on attempted area
    const path = location.pathname;
    const isTutorOrTutee = path.startsWith('/tutor') || path.startsWith('/tutee');
    return <Navigate to={isTutorOrTutee ? "/login" : "/admin-login"} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
