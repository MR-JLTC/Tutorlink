import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FileText, 
  User, 
  Calendar, 
  MessageSquare, 
  DollarSign,
  CheckCircle,
  Lock,
  X,
  Clock
} from 'lucide-react';
import { logoBase64 } from '../../assets/logo';
import { useVerification } from '../../context/VerificationContext';

const tutorNavLinks = [
  { 
    to: '/tutor-dashboard/application', 
    icon: FileText, 
    label: 'Application & Verification',
    description: 'Submit your credentials, certificates, and supporting documents for admin review and approval to start tutoring.',
    requiresApproval: false,
    isFirstStep: true
  },
  { 
    to: '/tutor-dashboard/profile', 
    icon: User, 
    label: 'Profile Setup',
    description: 'Complete your tutor profile with bio, subjects, profile photo, and GCash payment details for students to see.',
    requiresApproval: false,
    isFirstStep: false
  },
  { 
    to: '/tutor-dashboard/availability', 
    icon: Calendar, 
    label: 'Availability Scheduling',
    description: 'Set your weekly schedule and time slots when you\'re available for tutoring sessions.',
    requiresApproval: true,
    isFirstStep: false
  },
  { 
    to: '/tutor-dashboard/sessions', 
    icon: MessageSquare, 
    label: 'Session Handling',
    description: 'Manage incoming booking requests, accept or decline sessions, and communicate with students.',
    requiresApproval: true,
    isFirstStep: false
  },
  { 
    to: '/tutor-dashboard/earnings', 
    icon: DollarSign, 
    label: 'Earnings & History',
    description: 'View your payment history, track completed sessions, and monitor your tutoring income.',
    requiresApproval: true,
    isFirstStep: false
  },
];

const TutorSidebar: React.FC = () => {
  const { isVerified, applicationStatus, isLoading } = useVerification();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (to: string) => {
    setHoveredItem(to);
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Add a small delay before showing tooltip
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-slate-200">
        <img src={logoBase64} alt="TutorLink Logo" className="h-12 object-contain" />
      </div>
      
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Tutor Dashboard</h2>
        <p className="text-sm text-slate-600">Manage your tutoring profile</p>
      </div>
      
      <nav className="flex-1 px-3 py-4 space-y-1">
        {tutorNavLinks.map(({ to, icon: Icon, label, description, requiresApproval, isFirstStep }) => {
          const isLocked = requiresApproval && !isVerified;
          
          return (
            <div key={to} className="relative">
              {isLocked ? (
                <div className="block p-3 rounded-lg transition-all duration-200 group cursor-not-allowed opacity-50">
                  <div className="flex items-center space-x-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                    <span className="font-medium text-sm text-slate-400">{label}</span>
                    <Lock className="h-4 w-4 text-slate-400 ml-auto" />
                  </div>
                </div>
              ) : (
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
                    {isFirstStep && (
                      <div className="ml-auto">
                        {applicationStatus === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    )}
                  </div>
                </NavLink>
              )}
            
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
      
      {/* Status indicators */}
      <div className="px-4 py-3 border-t border-slate-200">
        <div className="flex items-center space-x-2 text-sm">
          {applicationStatus === 'approved' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
          <span className="text-slate-600">Tutor Account</span>
        </div>
      </div>
    </aside>
  );
};

export default TutorSidebar;
