import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateTutorStatusDto {
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';
}
