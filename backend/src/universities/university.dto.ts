import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CreateUniversityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  acronym?: string;

  @IsString()
  @IsNotEmpty()
  email_domain: string;

  @IsIn(['active', 'inactive'])
  status: 'active' | 'inactive';

  @IsString()
  @IsOptional()
  logo_url?: string;
}

export class UpdateUniversityDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  acronym?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  email_domain?: string;

  @IsIn(['active', 'inactive'])
  @IsOptional()
  status?: 'active' | 'inactive';

  @IsString()
  @IsOptional()
  logo_url?: string;
}
