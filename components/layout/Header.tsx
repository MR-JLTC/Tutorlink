import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, User as UserIcon } from 'lucide-react';
import Button from '../ui/Button';
import { getFileUrl } from '../../services/api';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [imageError, setImageError] = useState(false);

  const profileImageUrl = user?.profile_image_url ? getFileUrl(user.profile_image_url) : null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6">
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-200 border-2 border-slate-300">
          {profileImageUrl && !imageError ? (
            <img 
              src={profileImageUrl}
              alt={user?.name || 'User'}
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
              {user?.name ? (
                <span className="text-white font-semibold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <UserIcon className="h-6 w-6 text-white" />
              )}
            </div>
          )}
        </div>
        <Button onClick={logout} variant="secondary" className="!px-2 !py-2">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default Header;
