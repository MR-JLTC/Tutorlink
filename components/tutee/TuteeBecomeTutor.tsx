import React from 'react';
import { GraduationCap } from 'lucide-react';

const TuteeBecomeTutor: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <GraduationCap className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">Become a Tutor</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-slate-600">
          This page will allow students to apply to become tutors by selecting subjects 
          and uploading supporting documents like transcripts.
        </p>
      </div>
    </div>
  );
};

export default TuteeBecomeTutor;
