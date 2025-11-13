import React, { useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

const HeaderNotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(dropdownRef, () => setShowDropdown(false), 'mousedown');

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
    <div className="relative" ref={dropdownRef}>
      <button
        className="p-2 rounded-full hover:bg-slate-100 relative"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <div
        className={`absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-50 transform transition-all duration-200 ease-in-out ${
          showDropdown
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-16 bg-slate-100 rounded"></div>
              <div className="h-16 bg-slate-100 rounded"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Bell className="h-12 w-12 text-slate-300 mb-2" />
              <p className="text-slate-500">No notifications</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
              {notifications.map(notification => (
                <div
                  key={notification.notification_id}
                  className={`p-3 rounded-lg transition-all duration-200 ${
                    notification.is_read ? 'bg-slate-50' : 'bg-blue-50'
                  } hover:shadow-md`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {notification.metadata?.session_date && (
                          <span className="mr-2">
                            {new Date(notification.metadata.session_date).toLocaleDateString()}
                          </span>
                        )}
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.notification_id);
                        }}
                        className="ml-2 text-xs text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
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
    </div>
  );
};

export default HeaderNotificationBell;