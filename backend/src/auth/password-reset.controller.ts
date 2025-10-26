import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { PasswordResetService } from './password-reset.service';

export class RequestPasswordResetDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

export class VerifyCodeAndResetPasswordDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Verification code is required' })
  @IsString({ message: 'Verification code must be a string' })
  code: string;

  @IsNotEmpty({ message: 'New password is required' })
  @IsString({ message: 'New password must be a string' })
  @MinLength(7, { message: 'New password must be at least 7 characters long' })
  newPassword: string;
}

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('request')
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto) {
    try {
      console.log('=== CONTROLLER DEBUG ===');
      console.log('Received request body:', requestPasswordResetDto);
      console.log('Email from DTO:', requestPasswordResetDto.email);
      console.log('Email type:', typeof requestPasswordResetDto.email);
      console.log('Email length:', requestPasswordResetDto.email?.length);
      console.log('=== END CONTROLLER DEBUG ===');
      
      // Validate email in controller
      if (!requestPasswordResetDto.email) {
        throw new HttpException(
          {
            message: 'Email is required',
            statusCode: HttpStatus.BAD_REQUEST,
          },
          HttpStatus.BAD_REQUEST
        );
      }
      
      const result = await this.passwordResetService.requestPasswordReset(
        requestPasswordResetDto.email
      );
      return result;
    } catch (error) {
      console.log('Controller error:', error.message);
      throw new HttpException(
        {
          message: error.message || 'Failed to process password reset request',
          statusCode: error.status || HttpStatus.BAD_REQUEST,
        },
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('verify-and-reset')
  async verifyCodeAndResetPassword(@Body() verifyCodeAndResetPasswordDto: VerifyCodeAndResetPasswordDto) {
    try {
      console.log('=== VERIFY CONTROLLER DEBUG ===');
      console.log('Received verify request body:', verifyCodeAndResetPasswordDto);
      console.log('Email from DTO:', verifyCodeAndResetPasswordDto.email);
      console.log('Code from DTO:', verifyCodeAndResetPasswordDto.code);
      console.log('=== END VERIFY CONTROLLER DEBUG ===');
      
      // Validate required fields
      if (!verifyCodeAndResetPasswordDto.email) {
        throw new HttpException(
          {
            message: 'Email is required',
            statusCode: HttpStatus.BAD_REQUEST,
          },
          HttpStatus.BAD_REQUEST
        );
      }
      
      if (!verifyCodeAndResetPasswordDto.code) {
        throw new HttpException(
          {
            message: 'Verification code is required',
            statusCode: HttpStatus.BAD_REQUEST,
          },
          HttpStatus.BAD_REQUEST
        );
      }
      
      if (!verifyCodeAndResetPasswordDto.newPassword) {
        throw new HttpException(
          {
            message: 'New password is required',
            statusCode: HttpStatus.BAD_REQUEST,
          },
          HttpStatus.BAD_REQUEST
        );
      }
      
      const result = await this.passwordResetService.verifyCodeAndResetPassword(
        verifyCodeAndResetPasswordDto.email,
        verifyCodeAndResetPasswordDto.code,
        verifyCodeAndResetPasswordDto.newPassword
      );
      return result;
    } catch (error) {
      console.log('Verify controller error:', error.message);
      throw new HttpException(
        {
          message: error.message || 'Failed to reset password',
          statusCode: error.status || HttpStatus.BAD_REQUEST,
        },
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }
}
