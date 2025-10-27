import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  GraduationCap, 
  Search, 
  CreditCard, 
  Star,
  User,
  Edit2,
} from 'lucide-react';
import { logoBase64 } from '../../assets/logo';
import { useAuth } from '../../hooks/useAuth';
import apiClient, { getFileUrl } from '../../services/api';
import { useToast } from '../ui/Toast';

const tuteeNavLinks = [
  { 
    to: '/tutee-dashboard/become-tutor', 
    icon: GraduationCap, 
    label: 'Become a Tutor',
    description: 'Apply to become a tutor by selecting subjects and uploading supporting documents like transcripts.',
  },
  { 
    to: '/tutee-dashboard/find-tutors', 
    icon: Search, 
    label: 'Find & Book Tutors',
    description: 'Browse tutors filtered by your course subjects, view their profiles, ratings, and availability to book a session.',
  },
  { 
    to: '/tutee-dashboard/payment', 
    icon: CreditCard, 
    label: 'Payment',
    description: 'View tutor payment information, upload proof of payment via GCash, and wait for tutor approval.',
  },
  { 
    to: '/tutee-dashboard/after-session', 
    icon: Star, 
    label: 'After Session',
    description: 'Leave feedback and rating for completed sessions to help future students make informed decisions.',
  },
];

const TuteeSidebar: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleMouseEnter = (to: string) => {
    setHoveredItem(to);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const id = setTimeout(() => {
      setShowTooltip(to);
    }, 500);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setShowTooltip(null);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Please select a valid image file.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiClient.post(`/users/${user?.user_id}/profile-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Update local storage with new profile image URL
      const updatedUser = { ...user, profile_image_url: response.data.profile_image_url };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Trigger re-render by reloading the page
      window.location.reload();
      
      notify('Profile image updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      notify('Failed to upload profile image. Please try again.', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <img src={logoBase64} alt="TutorLink Logo" className="h-10 w-auto object-contain" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">TutorLink</h1>
            <p className="text-xs text-slate-600 font-medium">Student Dashboard</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-4 space-y-1">
        {tuteeNavLinks.map(({ to, icon: Icon, label, description }) => {
          return (
            <div key={to} className="relative">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `block p-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
                onMouseEnter={() => handleMouseEnter(to)}
                onMouseLeave={handleMouseLeave}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-5 w-5 ${hoveredItem === to ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className="font-medium text-sm">{label}</span>
                </div>
              </NavLink>
            
              {/* Hover tooltip */}
              {showTooltip === to && (
                <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-4 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                  <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-2xl w-80">
                    <div className="relative">
                      {/* Arrow */}
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-2">
                        <div className="w-4 h-4 bg-white border-l-2 border-t-2 border-slate-200 rotate-45"></div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-slate-800 mb-2 leading-tight">{label}</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
      
      {/* Profile Section */}
      <div className="px-4 py-4 border-t border-slate-200">
        <div className="flex items-center space-x-3 group">
          <div className="relative">
            {user?.profile_image_url ? (
              <img 
                src={getFileUrl(user.profile_image_url)} 
                alt={user.name}
                className="h-12 w-12 rounded-full object-cover border-2 border-slate-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg border-2 border-slate-200"
              style={{ display: user?.profile_image_url ? 'none' : 'flex' }}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleProfileImageChange}
              disabled={isUploading}
              className="hidden"
              id="profile-image-input"
            />
            <label
              htmlFor="profile-image-input"
              className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
              title="Edit profile image"
            >
              <Edit2 className="h-3 w-3" />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-600 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default TuteeSidebar;
