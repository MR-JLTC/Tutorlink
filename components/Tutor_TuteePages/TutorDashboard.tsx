import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TutorLayout from '../layout/TutorLayout';
import ApplicationVerification from '../tutor/ApplicationVerification';
import ProfileSetup from '../tutor/ProfileSetup';
import AvailabilityScheduling from '../tutor/AvailabilityScheduling';
import SessionHandling from '../tutor/SessionHandling';
import EarningsHistory from '../tutor/EarningsHistory';

const TutorDashboard: React.FC = () => {
  return (
    <TutorLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/tutor-dashboard/application" replace />} />
        <Route path="/application" element={<ApplicationVerification />} />
        <Route path="/profile" element={<ProfileSetup />} />
        <Route path="/availability" element={<AvailabilityScheduling />} />
        <Route path="/sessions" element={<SessionHandling />} />
        <Route path="/earnings" element={<EarningsHistory />} />
        <Route path="*" element={<Navigate to="/tutor-dashboard/application" replace />} />
      </Routes>
    </TutorLayout>
  );
};

export default TutorDashboard;