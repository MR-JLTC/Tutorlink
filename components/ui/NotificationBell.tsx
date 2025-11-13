import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { BsBell, BsBellFill } from 'react-icons/bs';
import { Notification } from '../../types/notification';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, isLoading, refreshNotifications } = useNotifications();
  // Hide upcoming-session notifications from the header bell — they are shown
  // in-page via the UpcomingSessions component in the dashboard layouts.
  const visibleNotifications = notifications.filter(n => n.type !== 'upcoming_session');
  const visibleUnreadCount = visibleNotifications.filter(n => !n.is_read).length;
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="relative">
      <button 
        className="p-2 hover:bg-gray-100 rounded-full relative"
        onClick={async () => {
          const next = !showNotifications;
          setShowNotifications(next);
          if (next) {
            await refreshNotifications();
          }
        }}
      >
        {visibleUnreadCount > 0 ? <BsBellFill className="text-blue-500 w-6 h-6" /> : <BsBell className="w-6 h-6" />}
        {visibleUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center animate-pulse">
            {visibleUnreadCount}
          </span>
        )}
        {visibleNotifications.some(n => !n.is_read && n.type === 'payment') && (
          <span className="absolute bottom-0 left-0 w-3 h-3 bg-yellow-500 border-2 border-white rounded-full animate-pulse"></span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Notifications</h3>
            </div>
            {visibleNotifications.some(n => !n.is_read && n.type === 'payment') && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">
                  You have pending payment notifications
                </p>
              </div>
            )}
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-16 bg-gray-200 rounded"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <BsBell className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-gray-500">No notifications</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {visibleNotifications.map((notification: Notification) => (
                  <div 
                    key={notification.notification_id}
                    className={`p-3 rounded-lg ${
                      notification.is_read 
                        ? 'bg-gray-50' 
                        : notification.type === 'payment'
                        ? 'bg-yellow-50 border border-yellow-200'
                        : 'bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.type === 'payment' && !notification.is_read && (
                          <span className="inline-flex items-center justify-center w-2 h-2 mr-2 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                        {notification.message}
                      </p>
                      {notification.type === 'payment' && !notification.is_read && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
                          Payment Required
                        </span>
                      )}
                    </div>
                    {notification.metadata?.session_date && (
                      <p className="text-xs text-gray-600 mt-1">
                        Session: {new Date(notification.metadata.session_date).toLocaleDateString()}
                        {notification.metadata.session_time && ` at ${notification.metadata.session_time}`}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(notification.created_at)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {notification.type === 'payment' && !notification.is_read && (
                        <button
                          onClick={() => {
                            navigate('/tutee-dashboard/payment');
                            setShowNotifications(false);
                          }}
                          className="text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 px-3 py-1.5 rounded-md transition-colors"
                        >
                          Go to Payment
                        </button>
                      )}
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.notification_id)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};