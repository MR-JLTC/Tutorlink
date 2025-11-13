import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut } from 'lucide-react';
import Button from '../ui/Button';
import { NotificationBell } from '../ui/NotificationBell';

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
          <NotificationBell />
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
