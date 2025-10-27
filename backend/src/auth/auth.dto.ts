import { IsEmail, IsNotEmpty, IsString, MinLength, IsInt, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsOptional()
  @IsInt()
  university_id?: number;

  @IsOptional()
  @IsString()
  user_type?: 'tutor' | 'tutee' | 'admin';

  @IsOptional()
  @IsInt()
  year_level?: number; // Change to number

  @IsOptional()
  @IsInt()
  course_id?: number;

  @IsOptional()
  @IsString()
  course_name?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  gcash_number?: string;
}

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
