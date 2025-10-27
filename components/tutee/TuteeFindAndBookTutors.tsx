import React from 'react';
import { Search } from 'lucide-react';

const TuteeFindAndBookTutors: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Search className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">Find & Book Tutors</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-slate-600">
          Browse tutors filtered by your course subjects, view their profiles, 
          ratings, and availability to book a session.
        </p>
      </div>
    </div>
  );
};

export default TuteeFindAndBookTutors;
