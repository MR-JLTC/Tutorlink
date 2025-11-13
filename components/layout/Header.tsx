import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, User as UserIcon } from 'lucide-react';
import Button from '../ui/Button';
import { getFileUrl } from '../../services/api';
import apiClient from '../../services/api';
import { useNavigate } from 'react-router-dom';
import HeaderNotificationBell from '../ui/HeaderNotificationBell';
import { User } from '../../types';
import Modal from '../ui/Modal';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  // Modal-based profile view removed; navigation to /admin/profile instead

  const profileUrl = (user as any)?.profile_image_url;
  const profileImageUrl = profileUrl ? getFileUrl(profileUrl) : null;

  const openAdminDetails = () => {
    navigate('/admin/profile');
  };

  // Upload logic moved to AdminProfile page

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6">
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={openAdminDetails}
          title="View profile"
          className="h-10 w-10 rounded-full overflow-hidden bg-slate-200 border-2 border-slate-300 focus:outline-none"
        >
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
        </button>
        <HeaderNotificationBell />
        <Button onClick={logout} variant="secondary" className="!px-2 !py-2">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Modal removed in favor of routed /admin/profile page */}
    </header>
  );
};

export default Header;
