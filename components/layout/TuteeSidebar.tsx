import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  GraduationCap, 
  Search, 
  CreditCard, 
  Star,
  User,
  Edit2,
  Bell
} from 'lucide-react';
import { logoBase64 } from '../../assets/logo';
import { useAuth } from '../../hooks/useAuth';
import { User as UserType } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import NotificationBadge from '../ui/NotificationBadge';
import apiClient, { getFileUrl } from '../../services/api';
import { useToast } from '../ui/Toast';
import { updateRoleUser } from '../../utils/authRole';

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
    to: '/tutee-dashboard/my-bookings',
    icon: Bell,
    label: 'My Bookings',
    description: 'View and manage your tutoring session bookings.',
  },
  {
    to: '/tutee-dashboard/upcoming-sessions',
    icon: User, // reuse simple icon; consider replacing with Calendar where available
    label: 'Upcoming Sessions',
    description: 'See your scheduled sessions in the next 30 days.',
    showUpcoming: true,
  },
  { 
    to: '/tutee-dashboard/payment', 
    icon: CreditCard, 
    label: 'Payment',
    description: 'View tutor payment information, upload proof of payment via GCash, and wait for tutor approval.',
    showNotification: true, // This will be used to conditionally show the notification dot
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
  const [hasPendingPayments, setHasPendingPayments] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState<number>(0);

  //OLD CODE HERE, BUG IS THE RED DOT IS STILL VISIBLE EVEN
  //AFTER THE PAYMENT IS CONFIRMED, THE RED DOT SHOULD BE HIDDEN
  // useEffect(() => {
  //   const checkPendingPayments = async () => {
  //     try {
  //       // Fetch both bookings and payments to check payment status
  //       const [bookingsResponse, paymentsResponse] = await Promise.all([
  //         apiClient.get('/users/me/bookings'),
  //         apiClient.get('/payments').catch(() => ({ data: [] })) // Don't fail if payments endpoint fails
  //       ]);

  //       // If the server returned an unexpected shape, clear pending flag
  //       if (!Array.isArray(bookingsResponse.data)) {
  //         console.warn('checkPendingPayments: unexpected bookings response, clearing pending flag', bookingsResponse.data);
  //         setHasPendingPayments(false);
  //         return;
  //       }

  //       const allBookings = bookingsResponse.data || [];
  //       const allPayments = paymentsResponse.data || [];

  //       // Filter payments for current user (student)
  //       const userPayments = allPayments.filter((p: any) => {
  //         if (user?.user_id) {
  //           return (p as any).student?.user?.user_id === user.user_id ||
  //                  (p as any).student_id === (user as any).student_id;
  //         }
  //         return false;
  //       });

  //       // Check for bookings that need payment (awaiting payment, payment pending, payment rejected)
  //       const relevantBookings = allBookings.filter((booking: any) => {
  //         const status = (booking?.status || '').toString().toLowerCase().trim();
  //         return (
  //           status === 'awaiting_payment' ||
  //           status === 'payment_pending' ||
  //           status === 'payment_rejected'
  //         );
  //       });

  //       // Check if any relevant booking has a payment that needs attention
  //       // Hide dot if payment status is 'admin_confirmed' or 'confirmed'
  //       let shouldShowDot = false;

  //       // Check each relevant booking - need to check ALL bookings before deciding
  //       for (const booking of relevantBookings) {
  //         // Find matching payment for this booking
  //         const matchingPayment = userPayments.find((p: any) => {
  //           return p.tutor_id === booking.tutor?.tutor_id &&
  //                  (p.subject === booking.subject || !p.subject);
  //         });
          
  //         if (matchingPayment) {
  //           // Payment exists - check its status
  //           const paymentStatus = (matchingPayment.status || '').toLowerCase().trim();
            
  //           // Debug logging (can be removed in production)
  //           console.log('[TuteeSidebar] Booking:', booking.id, 'Payment status:', paymentStatus, 'Payment ID:', matchingPayment.payment_id);
          
  //           // ❌ Hide dot for these statuses - payment is confirmed, no action needed
  //           if (paymentStatus === 'admin_confirmed' || paymentStatus === 'confirmed') {
  //             // This booking is confirmed, continue checking other bookings
  //             continue;
  //           }
          
  //           // ✅ Show dot for pending / rejected - payment needs attention
  //           if (paymentStatus === 'pending' || paymentStatus === 'rejected') {
  //             console.log('[TuteeSidebar] Found pending/rejected payment, showing dot');
  //             shouldShowDot = true;
  //             break; // Found one that needs attention, show dot immediately
  //           }
          
  //           // Unknown status - treat as needing attention to be safe
  //           console.log('[TuteeSidebar] Unknown payment status:', paymentStatus, 'showing dot to be safe');
  //           shouldShowDot = true;
  //           break;
  //         } else {
  //           // No payment entity exists yet - booking still needs payment
  //           console.log('[TuteeSidebar] No payment found for booking:', booking.id, 'showing dot');
  //           shouldShowDot = true;
  //           break; // Found one that needs attention, show dot immediately
  //         }
  //       }
        
  //       // Debug: log final decision
  //       if (relevantBookings.length > 0) {
  //         console.log('[TuteeSidebar] Relevant bookings:', relevantBookings.length, 'Should show dot:', shouldShowDot);
  //       }

  //       // Also check standalone payments (not necessarily linked to bookings yet)
  //       // Only show dot if they are pending or rejected, NOT if admin_confirmed or confirmed
  //       if (!shouldShowDot) {
  //         const standalonePendingPayments = userPayments.filter((p: any) => {
  //           const paymentStatus = (p.status || '').toLowerCase();
  //           // Only show dot for pending or rejected, NOT for admin_confirmed or confirmed
  //           return paymentStatus === 'pending' || paymentStatus === 'rejected';
  //         });

  //         if (standalonePendingPayments.length > 0) {
  //           shouldShowDot = true;
  //         }
  //       }

  //       setHasPendingPayments(shouldShowDot);
  //     } catch (error) {
  //       // On error we should not leave the badge stuck — clear it so the UI doesn't mislead the user
  //       console.error('Failed to check pending payments:', error);
  //       setHasPendingPayments(false);
  //     }
  //   };

  //   checkPendingPayments();
  //   // Check more frequently so the badge clears quickly after actions and also when the window regains focus
  //   const interval = setInterval(checkPendingPayments, 10000);
  //   const onFocus = () => checkPendingPayments();
  //   window.addEventListener('focus', onFocus);
  //   return () => {
  //     clearInterval(interval);
  //     window.removeEventListener('focus', onFocus);
  //   };
  // }, [user?.user_id]);
  
  useEffect(() => {
    const checkPendingPayments = async () => {
      try {
        const [bookingsResponse, paymentsResponse] = await Promise.all([
          apiClient.get('/users/me/bookings'),
          apiClient.get('/payments').catch(() => ({ data: [] }))
        ]);
  
        if (!Array.isArray(bookingsResponse.data)) {
          setHasPendingPayments(false);
          return;
        }
  
        const allBookings = bookingsResponse.data || [];
        const allPayments = paymentsResponse.data || [];
  
        // Filter payments for current user
        const userPayments = allPayments.filter((p: any) => {
          if (!user?.user_id) return false;
          return (
            p.student?.user?.user_id === user.user_id
          );
        });
  
        // Bookings that require payment attention
        const relevantBookings = allBookings.filter((booking: any) => {
          const status = (booking?.status || '').toLowerCase().trim();
          return (
            status === 'awaiting_payment' ||
            status === 'payment_pending' ||
            status === 'payment_rejected'
          );
        });
  
        let shouldShowDot = false;
  
        for (const booking of relevantBookings) {
          // Match payment by booking_id
          const matchingPayment = userPayments.find((p: any) => p.booking_id === booking.id);
  
          if (!matchingPayment) {
            // No payment yet → show dot
            shouldShowDot = true;
            break;
          }
  
          const paymentStatus = (matchingPayment.status || '').toLowerCase().trim();
  
          // Only show dot for 'pending' or 'rejected'
          if (paymentStatus === 'pending' || paymentStatus === 'rejected') {
            shouldShowDot = true;
            break;
          }
  
          // 'confirmed', 'admin_confirmed', 'refunded' → no dot
        }
  
        setHasPendingPayments(shouldShowDot);
  
      } catch (err) {
        console.error('Failed to check pending payments', err);
        setHasPendingPayments(false);
      }
    };
  
    checkPendingPayments();
    const interval = setInterval(checkPendingPayments, 8000);
    const onFocus = () => checkPendingPayments();
  
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.user_id]);
  
  

  // Fetch numeric upcoming sessions count for tutee and refresh on focus
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.user_id) {
        if (mounted) setUpcomingCount(0);
        return;
      }
      try {
        const res = await apiClient.get('/users/upcoming-sessions/list');
        const items = res.data?.data || [];
        if (mounted) setUpcomingCount(Array.isArray(items) ? items.length : 0);
      } catch (err) {
        console.error('Failed to load upcoming sessions count (tutee):', err);
        if (mounted) setUpcomingCount(0);
      }
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.user_id]);
  const { unreadCount, hasUpcomingSessions } = useNotifications();
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
      updateRoleUser(updatedUser as any);
      
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={logoBase64} alt="TutorLink Logo" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold text-slate-800">TutorLink</h1>
              <p className="text-xs text-slate-600 font-medium">Student Dashboard</p>
            </div>
          </div>
          {/* Removed notification bell and badge from tutee sidebar as requested */}
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-4 space-y-1">
  {tuteeNavLinks.map(({ to, icon: Icon, label, description, showNotification, showUpcoming }) => {
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
                <div className="flex items-center">
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${hoveredItem === to ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span className="font-medium text-sm">{label}</span>
                  </div>
                  {showNotification && hasPendingPayments && (
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-2" />
                  )}
                  {showUpcoming && upcomingCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                      {upcomingCount > 99 ? '99+' : upcomingCount}
                    </span>
                  )}
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
                          <div className="flex items-center space-x-2">
                            <h4 className="text-base font-semibold text-slate-800 mb-2 leading-tight">{label}</h4>
                            {showNotification && hasPendingPayments && (
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </div>
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
      
      {/* Profile Section - clickable to open profile page for viewing/editing */}
      <div className="px-4 py-4 border-t border-slate-200">
        <NavLink to="/tutee-dashboard/profile" className="flex items-center space-x-3 group hover:bg-slate-50 p-2 rounded-md">
          <div className="relative">
            {user?.profile_image_url ? (
              <img 
                src={getFileUrl(user.profile_image_url)} 
                alt={user.name}
                className="h-12 w-12 rounded-full object-cover border-2 border-slate-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg border-2 border-slate-200">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-600 truncate">{user?.email}</p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
};

export default TuteeSidebar;
