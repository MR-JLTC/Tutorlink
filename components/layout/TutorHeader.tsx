import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Bell, Settings } from 'lucide-react';
import Button from '../ui/Button';

const TutorHeader: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Welcome back, {user?.name || 'Tutor'}!</h1>
          <p className="text-sm text-slate-600">Manage your tutoring profile and sessions</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
          </button>
          <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <Settings className="h-5 w-5" />
          </button>
          <Button 
            onClick={logout} 
            variant="secondary" 
            className="flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default TutorHeader;
