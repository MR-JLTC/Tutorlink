import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TuteeLayout from '../layout/TuteeLayout';
import TuteeBecomeTutor from '../tutee/TuteeBecomeTutor';
import TuteeFindAndBookTutors from '../tutee/TuteeFindAndBookTutors';
import TuteePayment from '../tutee/TuteePayment';
import TuteeAfterSession from '../tutee/TuteeAfterSession';

const TuteeDashboard: React.FC = () => {
  return (
    <TuteeLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/tutee-dashboard/become-tutor" replace />} />
        <Route path="/become-tutor" element={<TuteeBecomeTutor />} />
        <Route path="/find-tutors" element={<TuteeFindAndBookTutors />} />
        <Route path="/payment" element={<TuteePayment />} />
        <Route path="/after-session" element={<TuteeAfterSession />} />
        <Route path="*" element={<Navigate to="/tutee-dashboard/become-tutor" replace />} />
      </Routes>
    </TuteeLayout>
  );
};

export default TuteeDashboard;
