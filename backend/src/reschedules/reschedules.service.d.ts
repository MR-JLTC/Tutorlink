import { CreateRescheduleDto } from './dto/create-reschedule.dto';
import { BookingRequest } from '../database/entities/booking-request.entity';
export declare class ReschedulesService {
    propose(userId: number, dto: CreateRescheduleDto): Promise<any>;
    listByBooking(bookingId: number): Promise<Reschedule[]>;
    findById(id: number): Promise<any>;
    accept(userId: number, rescheduleId: number): Promise<any>;
    reject(userId: number, rescheduleId: number): Promise<any>;
    cancel(userId: number, rescheduleId: number): Promise<any>;
}

declare type Reschedule = any;
