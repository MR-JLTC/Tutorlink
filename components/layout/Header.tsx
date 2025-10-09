import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, User as UserIcon } from 'lucide-react';
import Button from '../ui/Button';

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6">
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center">
            <UserIcon className="h-6 w-6 text-slate-500" />
        </div>
        <Button onClick={logout} variant="secondary" className="!px-2 !py-2">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default Header;
