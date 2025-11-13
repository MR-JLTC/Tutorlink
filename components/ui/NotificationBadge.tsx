import React from 'react';

interface NotificationBadgeProps {
  show: boolean;
  count?: number;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ show, count }) => {
  if (!show) return null;

  return (
    <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse">
      {count !== undefined && count > 0 && (
        <span className="absolute -top-1 -right-1 text-xs text-white font-bold">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
  );
};

export default NotificationBadge;