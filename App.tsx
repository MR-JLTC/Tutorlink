import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import LoginPage from './components/auth/AdminLoginPage';
import RegistrationPage from './components/auth/AdminRegistrationPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './components/Dashboard';
import UserManagement from './components/UserManagement';
import TutorManagement from './components/TutorManagement';
import UniversityManagement from './components/UniversityManagement';
import CourseManagement from './components/CourseManagement';
import PaymentManagement from './components/PaymentManagement';
import LandingPage from './components/Tutor_TuteePages/LandingPage';
import TuteeRegistrationPage from './components/Tutor_TuteePages/TuteeRegistrationPage';
import TutorRegistrationPage from './components/Tutor_TuteePages/TutorRegistrationPage';
import TutorDashboard from './components/Tutor_TuteePages/TutorDashboard';
const TuteeDashboard = () => <div className="p-6"><h1 className="text-2xl font-bold">TuteeDashboard</h1><p className="text-slate-600 mt-2">Coming soon.</p></div>;
import UnifiedLoginPage from './components/auth/UnifiedLoginPage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
      <Routes>
        <Route path="/LandingPage" element={<LandingPage />} />
        <Route path="/TuteeRegistrationPage" element={<TuteeRegistrationPage />} />
        <Route path="/TutorRegistrationPage" element={<TutorRegistrationPage />} />
        <Route path="/login" element={<UnifiedLoginPage />} />
        <Route path="/admin-login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/tutors" element={<TutorManagement />} />
                  <Route path="/tutor-dashboard" element={<TutorDashboard />} />
                  <Route path="/tutee-dashboard" element={<TuteeDashboard />} />
                  <Route path="/universities" element={<UniversityManagement />} />
                  <Route path="/courses" element={<CourseManagement />} />
                  <Route path="/payments" element={<PaymentManagement />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
