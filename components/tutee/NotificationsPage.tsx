import React from 'react';
import { Trash2, Check } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const NotificationsPage: React.FC = () => {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

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

  const groupNotifications = () => {
    const groups = {
      today: [] as any[],
      earlier: [] as any[],
    };

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    notifications.forEach(notif => {
      const notifDate = new Date(notif.created_at);
      notifDate.setHours(0, 0, 0, 0);

      if (notifDate.getTime() === now.getTime()) {
        groups.today.push(notif);
      } else {
        groups.earlier.push(notif);
      }
    });

    return groups;
  };

  const groups = groupNotifications();

  if (notifications.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 py-8 sm:py-10 md:py-12 text-center">
        <p className="text-sm sm:text-base md:text-lg text-slate-600">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4 lg:py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-6">
        <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-slate-800">Notifications</h1>
        <button
          onClick={() => markAllAsRead()}
          className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 active:text-blue-800 font-medium touch-manipulation px-2 py-1.5 sm:px-0 sm:py-0 rounded-md hover:bg-blue-50 active:bg-blue-100 sm:hover:bg-transparent sm:active:bg-transparent transition-colors min-h-[44px] sm:min-h-0 flex items-center justify-center sm:justify-end"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Mark all as read
        </button>
      </div>

      {groups.today.length > 0 && (
        <>
          <h2 className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg text-slate-900 mb-2 sm:mb-3">Today</h2>
          <div className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-4 sm:mb-5 md:mb-6">
            {groups.today.map((notif) => (
              <div
                key={notif.notification_id}
                className={`p-2.5 sm:p-3 md:p-4 rounded-lg border border-slate-200 shadow-sm ${
                  notif.is_read ? 'bg-white' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg text-slate-900 break-words leading-tight mb-1">{notif.title}</p>
                    <p className="text-xs sm:text-sm md:text-base text-slate-600 break-words leading-relaxed mb-1.5 sm:mb-2">{notif.message}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">
                      {formatDate(notif.created_at)}
                    </p>
                  </div>
                  <div className="flex items-start gap-1 sm:gap-1.5 flex-shrink-0 pt-0.5">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.notification_id)}
                        className="p-2 sm:p-2.5 text-slate-600 hover:text-blue-600 active:text-blue-700 rounded-md hover:bg-blue-50 active:bg-blue-100 touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition-colors"
                        title="Mark as read"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <Check className="h-4 w-4 sm:h-4 sm:w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.notification_id)}
                      className="p-2 sm:p-2.5 text-slate-600 hover:text-red-600 active:text-red-700 rounded-md hover:bg-red-50 active:bg-red-100 touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition-colors"
                      title="Delete notification"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Trash2 className="h-4 w-4 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {groups.earlier.length > 0 && (
        <>
          <h2 className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg text-slate-900 mb-2 sm:mb-3">Earlier</h2>
          <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
            {groups.earlier.map((notif) => (
              <div
                key={notif.notification_id}
                className={`p-2.5 sm:p-3 md:p-4 rounded-lg border border-slate-200 shadow-sm ${
                  notif.is_read ? 'bg-white' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg text-slate-900 break-words leading-tight mb-1">{notif.title}</p>
                    <p className="text-xs sm:text-sm md:text-base text-slate-600 break-words leading-relaxed mb-1.5 sm:mb-2">{notif.message}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">
                      {formatDate(notif.created_at)}
                    </p>
                  </div>
                  <div className="flex items-start gap-1 sm:gap-1.5 flex-shrink-0 pt-0.5">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.notification_id)}
                        className="p-2 sm:p-2.5 text-slate-600 hover:text-blue-600 active:text-blue-700 rounded-md hover:bg-blue-50 active:bg-blue-100 touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition-colors"
                        title="Mark as read"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <Check className="h-4 w-4 sm:h-4 sm:w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.notification_id)}
                      className="p-2 sm:p-2.5 text-slate-600 hover:text-red-600 active:text-red-700 rounded-md hover:bg-red-50 active:bg-red-100 touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition-colors"
                      title="Delete notification"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Trash2 className="h-4 w-4 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationsPage;