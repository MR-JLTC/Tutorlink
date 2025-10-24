import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Bell, Settings, Key } from 'lucide-react';
import Button from '../ui/Button';
import ChangePasswordModal from '../auth/ChangePasswordModal';
import ChangePasswordVerification from '../auth/ChangePasswordVerification';

const TutorHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangePasswordVerification, setShowChangePasswordVerification] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

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
          
          {/* Settings Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5" />
            </button>
            
            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={() => {
                    setShowChangePasswordModal(true);
                    setShowSettingsDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <Key className="h-4 w-4" />
                  <span>Change Password</span>
                </button>
              </div>
            )}
          </div>
          
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
      
      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onSuccess={() => setShowChangePasswordVerification(true)}
      />

      {/* Change Password Verification */}
      {showChangePasswordVerification && (
        <ChangePasswordVerification
          onBack={() => {
            setShowChangePasswordVerification(false);
            setShowChangePasswordModal(false);
          }}
        />
      )}
    </header>
  );
};

export default TutorHeader;
