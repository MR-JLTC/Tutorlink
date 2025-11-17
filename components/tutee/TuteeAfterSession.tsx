import React from 'react';
import { Star } from 'lucide-react';

const TuteeAfterSession: React.FC = () => {
  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-white shadow-lg -mx-2 sm:-mx-3 md:mx-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Star className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-yellow-300 flex-shrink-0" />
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">After Session</h1>
        </div>
      </div>
      
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 -mx-2 sm:-mx-3 md:mx-0">
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed">
          Leave feedback and rating for completed sessions to help future 
          students make informed decisions.
        </p>
      </div>
    </div>
  );
};

export default TuteeAfterSession;
