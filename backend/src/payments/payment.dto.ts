import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdatePaymentDisputeDto {
  @IsIn(['none', 'open', 'under_review', 'resolved', 'rejected'])
  dispute_status: 'none' | 'open' | 'under_review' | 'resolved' | 'rejected';

  @IsString()
  @IsOptional()
  admin_note?: string;
}


