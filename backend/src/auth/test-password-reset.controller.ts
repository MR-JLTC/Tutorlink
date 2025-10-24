import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';

export class TestPasswordResetDto {
  email: string;
}

@Controller('auth/test-password-reset')
export class TestPasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('debug')
  async debugPasswordReset(@Body() testPasswordResetDto: TestPasswordResetDto) {
    try {
      console.log('=== DEBUG PASSWORD RESET ===');
      console.log('Email received:', testPasswordResetDto.email);
      
      const result = await this.passwordResetService.requestPasswordReset(
        testPasswordResetDto.email
      );
      
      console.log('Result:', result);
      console.log('=== END DEBUG ===');
      
      return {
        success: true,
        message: 'Debug completed - check server logs',
        result
      };
    } catch (error) {
      console.log('=== DEBUG ERROR ===');
      console.log('Error:', error.message);
      console.log('=== END DEBUG ERROR ===');
      
      throw new HttpException(
        {
          message: error.message || 'Debug failed',
          statusCode: error.status || HttpStatus.BAD_REQUEST,
        },
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }
}
