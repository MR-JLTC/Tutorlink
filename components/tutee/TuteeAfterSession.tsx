import React from 'react';
import { Star } from 'lucide-react';

const TuteeAfterSession: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Star className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">After Session</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-slate-600">
          Leave feedback and rating for completed sessions to help future 
          students make informed decisions.
        </p>
      </div>
    </div>
  );
};

export default TuteeAfterSession;
