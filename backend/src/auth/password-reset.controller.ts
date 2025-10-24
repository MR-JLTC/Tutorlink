import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';

export class RequestPasswordResetDto {
  email: string;
}

export class VerifyCodeAndResetPasswordDto {
  email: string;
  code: string;
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
