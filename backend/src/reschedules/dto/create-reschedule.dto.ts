export class CreateRescheduleDto {
  booking_id: number;
  proposedDate: string; // ISO date string (yyyy-mm-dd)
  proposedTime: string; // e.g. '14:00'
  proposedDuration?: number;
  reason?: string;
}
