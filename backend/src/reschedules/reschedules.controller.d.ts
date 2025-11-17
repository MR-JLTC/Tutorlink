import { CreateRescheduleDto } from './dto/create-reschedule.dto';
export declare class ReschedulesController {
    propose(req: any, body: CreateRescheduleDto): Promise<any>;
    listByBooking(bookingId: string): Promise<any>;
    getOne(id: string): Promise<any>;
    accept(req: any, id: string): Promise<any>;
    reject(req: any, id: string): Promise<any>;
    cancel(req: any, id: string): Promise<any>;
}
