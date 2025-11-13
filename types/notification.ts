export interface Notification {
  notification_id: string | number;
  user_id: string | number;
  booking_id?: string | number;
  title: string;
  message: string;
  type: 'upcoming_session' | 'booking_update' | 'payment' | 'system';
  is_read: boolean;
  created_at: string;
  scheduled_for?: string;
  metadata?: {
    session_date?: string;
    session_time?: string;
    tutor_name?: string;
  student_name?: string;
    subject?: string;
    course_name?: string;
    session_type?: string;
    location?: string;
  };
}

export interface NotificationTrigger {
  days_before: number;
  hours_before?: number;
  message_template: string;
}

export const SESSION_NOTIFICATION_TRIGGERS: NotificationTrigger[] = [
  { days_before: 3, message_template: "You have an upcoming session in 3 days" },
  { days_before: 2, message_template: "You have an upcoming session in 2 days" },
  { days_before: 1, message_template: "You have an upcoming session tomorrow" },
  { days_before: 0, hours_before: 12, message_template: "You have an upcoming session in 12 hours" },
  { days_before: 0, hours_before: 6, message_template: "You have an upcoming session in 6 hours" },
  { days_before: 0, hours_before: 1, message_template: "You have an upcoming session in 1 hour" }
];