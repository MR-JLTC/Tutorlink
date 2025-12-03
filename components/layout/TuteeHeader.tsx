import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Menu } from 'lucide-react';
import Button from '../ui/Button';
import { NotificationBell } from '../ui/NotificationBell';

interface TuteeHeaderProps {
  onMenuClick?: () => void;
}

const TuteeHeader: React.FC<TuteeHeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
      <div className="px-2 sm:px-3 md:px-4 lg:px-4 py-2 sm:py-2.5 md:py-4 lg:py-4 md:h-[72px] lg:h-[72px] md:flex md:items-center">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 w-full md:h-full">
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 flex-1 min-w-0 overflow-hidden md:h-full">
            {/* Mobile Menu Button */}
            <button
              onClick={onMenuClick}
              className="md:hidden p-1.5 sm:p-2 rounded-md text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 flex-shrink-0 touch-manipulation"
              aria-label="Open menu"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            
            <div className="min-w-0 flex-1 overflow-hidden md:flex md:flex-col md:justify-center md:h-full md:leading-none">
              <h1 className="text-sm sm:text-base md:text-lg lg:text-lg font-semibold md:font-bold text-slate-800 truncate md:leading-tight">
                <span className="truncate inline-block max-w-full">Welcome back, {user?.name?.split(' ')[0] || 'Student'} </span>
              </h1>
              <p className="text-[10px] sm:text-xs md:text-xs text-slate-600 md:text-slate-600 md:font-medium hidden sm:block truncate md:leading-tight md:mt-0">
                Find tutors and manage your learning sessions
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-4 flex-shrink-0">
            <NotificationBell />
            <Button 
              onClick={logout} 
              variant="secondary" 
              className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 !px-1.5 sm:!px-2 md:!px-3 !py-1.5 sm:!py-2 text-xs sm:text-sm touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TuteeHeader;
