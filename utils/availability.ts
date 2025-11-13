interface TutorAvailability {
  day_of_week: string;
  start_time: string;
  end_time: string;
}

export const isTimeWithinAvailability = (
  timeToCheck: string,
  dayOfWeek: string,
  availability: TutorAvailability[]
): boolean => {
  const dayAvailability = availability.find(a => a.day_of_week.toLowerCase() === dayOfWeek.toLowerCase());
  if (!dayAvailability) return false;

  const checkTime = new Date(`1970-01-01T${timeToCheck}`);
  const startTime = new Date(`1970-01-01T${dayAvailability.start_time}`);
  const endTime = new Date(`1970-01-01T${dayAvailability.end_time}`);

  return checkTime >= startTime && checkTime <= endTime;
};

export const getAvailableTimeSlots = (
  dayOfWeek: string,
  availability: TutorAvailability[],
  interval: number = 30
): string[] => {
  const dayAvailability = availability.find(a => a.day_of_week.toLowerCase() === dayOfWeek.toLowerCase());
  if (!dayAvailability) return [];

  const slots: string[] = [];
  const startTime = new Date(`1970-01-01T${dayAvailability.start_time}`);
  const endTime = new Date(`1970-01-01T${dayAvailability.end_time}`);

  let currentTime = new Date(startTime);
  while (currentTime <= endTime) {
    slots.push(currentTime.toTimeString().substring(0, 5));
    currentTime.setMinutes(currentTime.getMinutes() + interval);
  }

  return slots;
};