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
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
        <button
          onClick={() => markAllAsRead()}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Mark all as read
        </button>
      </div>

      {groups.today.length > 0 && (
        <>
          <h2 className="font-medium text-slate-900 mb-3">Today</h2>
          <div className="space-y-2 mb-6">
            {groups.today.map((notif) => (
              <div
                key={notif.notification_id}
                className={`p-4 rounded-lg border ${
                  notif.is_read ? 'bg-white' : 'bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{notif.title}</p>
                    <p className="text-slate-600 mt-1">{notif.message}</p>
                    <p className="text-sm text-slate-500 mt-2">
                      {formatDate(notif.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.notification_id)}
                        className="p-1 text-slate-600 hover:text-blue-600"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.notification_id)}
                      className="p-1 text-slate-600 hover:text-red-600"
                      title="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
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
          <h2 className="font-medium text-slate-900 mb-3">Earlier</h2>
          <div className="space-y-2">
            {groups.earlier.map((notif) => (
              <div
                key={notif.notification_id}
                className={`p-4 rounded-lg border ${
                  notif.is_read ? 'bg-white' : 'bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{notif.title}</p>
                    <p className="text-slate-600 mt-1">{notif.message}</p>
                    <p className="text-sm text-slate-500 mt-2">
                      {formatDate(notif.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.notification_id)}
                        className="p-1 text-slate-600 hover:text-blue-600"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.notification_id)}
                      className="p-1 text-slate-600 hover:text-red-600"
                      title="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
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