import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { Bell } from 'lucide-react';

interface UpcomingSessionsProps {
  className?: string;
}

const UpcomingSessions: React.FC<UpcomingSessionsProps> = ({ className = '' }) => {
  const { notifications, isLoading, error } = useNotifications();
  const { user: authUser } = useAuth();
  const role = authUser?.role;

  // Filter only upcoming session notifications and sort by date
  const upcomingSessions = notifications
    .filter(n => n.type === 'upcoming_session' && n.metadata?.session_date)
    .sort((a, b) => {
      const dateA = new Date(a.metadata!.session_date!).getTime();
      const dateB = new Date(b.metadata!.session_date!).getTime();
      return dateA - dateB;
    });

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Upcoming Sessions</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Remove error handling since we want to show "No upcoming sessions" instead of error message

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Upcoming Sessions</h2>
      {upcomingSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Bell className="h-12 w-12 text-slate-300 mb-2" />
          <p className="text-gray-500">No upcoming sessions scheduled</p>
        </div>
      ) : (
        <div className="space-y-4">
          {upcomingSessions.map((session) => (
            <div
              key={session.notification_id}
              className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 rounded-r relative"
            >
              {!session.is_read && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
              )}
              <p className="font-medium text-gray-900">{session.metadata?.subject}</p>
              {/* Show the other participant's name: if the current user is a tutor, show the student name; otherwise show the tutor name */}
              {role === 'tutor' ? (
                session.metadata?.student_name ? (
                  <p className="text-sm text-gray-600">with {session.metadata.student_name}</p>
                ) : null
              ) : (
                session.metadata?.tutor_name ? (
                  <p className="text-sm text-gray-600">with {session.metadata.tutor_name}</p>
                ) : null
              )}
              <p className="text-sm text-gray-600">
                {new Date(session.metadata!.session_date!).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {session.metadata?.session_time && (
                <p className="text-sm text-gray-600">at {session.metadata.session_time}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UpcomingSessions;