import React from 'react';
import { CreditCard } from 'lucide-react';

const TuteePayment: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <CreditCard className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-800">Payment</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-slate-600">
          View tutor payment information, upload proof of payment via GCash, 
          and wait for tutor approval.
        </p>
      </div>
    </div>
  );
};

export default TuteePayment;
