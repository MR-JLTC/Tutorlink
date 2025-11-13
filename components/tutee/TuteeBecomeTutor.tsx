import React from 'react';
import { GraduationCap } from 'lucide-react';
import TutorRegistrationPage from '../Tutor_TuteePages/TutorRegistrationPage';

const TuteeBecomeTutor: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <GraduationCap className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">Become a Tutor</h1>
      </div>
      <p className="text-slate-600 text-lg">
        Turn your knowledge into impact and income. Share your expertise, help fellow students excel, and build your portfolio — all in one place.
      </p>

      {/* Reuse the full Tutor Registration experience inside the tutee dashboard */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <TutorRegistrationPage />
      </div>
    </div>
  );
};

export default TuteeBecomeTutor;
