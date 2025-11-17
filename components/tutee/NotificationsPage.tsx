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
      <div className="p-6 text-center text-slate-600">
        <p>No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-4 md:p-6 -mx-2 sm:-mx-3 md:mx-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-3 md:gap-0 mb-4 sm:mb-5 md:mb-6">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Notifications</h1>
        <button
          onClick={() => markAllAsRead()}
          className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 active:text-blue-800 font-medium touch-manipulation w-full sm:w-auto text-left sm:text-right"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Mark all as read
        </button>
      </div>

      {groups.today.length > 0 && (
        <>
          <h2 className="font-medium text-sm sm:text-base md:text-lg text-slate-900 mb-2 sm:mb-3">Today</h2>
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-5 md:mb-6">
            {groups.today.map((notif) => (
              <div
                key={notif.notification_id}
                className={`p-3 sm:p-4 rounded-lg border -mx-2 sm:-mx-3 md:mx-0 ${
                  notif.is_read ? 'bg-white' : 'bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base md:text-lg text-slate-900 break-words">{notif.title}</p>
                    <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1 break-words">{notif.message}</p>
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-500 mt-1.5 sm:mt-2">
                      {formatDate(notif.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.notification_id)}
                        className="p-1.5 sm:p-2 text-slate-600 hover:text-blue-600 active:text-blue-700 rounded-md hover:bg-blue-50 active:bg-blue-100 touch-manipulation"
                        title="Mark as read"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.notification_id)}
                      className="p-1.5 sm:p-2 text-slate-600 hover:text-red-600 active:text-red-700 rounded-md hover:bg-red-50 active:bg-red-100 touch-manipulation"
                      title="Delete notification"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
          <h2 className="font-medium text-sm sm:text-base md:text-lg text-slate-900 mb-2 sm:mb-3">Earlier</h2>
          <div className="space-y-2 sm:space-y-3">
            {groups.earlier.map((notif) => (
              <div
                key={notif.notification_id}
                className={`p-3 sm:p-4 rounded-lg border -mx-2 sm:-mx-3 md:mx-0 ${
                  notif.is_read ? 'bg-white' : 'bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base md:text-lg text-slate-900 break-words">{notif.title}</p>
                    <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1 break-words">{notif.message}</p>
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-500 mt-1.5 sm:mt-2">
                      {formatDate(notif.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.notification_id)}
                        className="p-1.5 sm:p-2 text-slate-600 hover:text-blue-600 active:text-blue-700 rounded-md hover:bg-blue-50 active:bg-blue-100 touch-manipulation"
                        title="Mark as read"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.notification_id)}
                      className="p-1.5 sm:p-2 text-slate-600 hover:text-red-600 active:text-red-700 rounded-md hover:bg-red-50 active:bg-red-100 touch-manipulation"
                      title="Delete notification"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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