import { Controller, Post, Body, HttpException, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordService } from './change-password.service';

export class RequestChangePasswordDto {
  currentPassword: string;
}

export class VerifyCodeAndChangePasswordDto {
  code: string;
  newPassword: string;
}

@Controller('auth/change-password')
@UseGuards(JwtAuthGuard)
export class ChangePasswordController {
  constructor(private readonly changePasswordService: ChangePasswordService) {}

  @Post('request')
  async requestChangePassword(
    @Request() req: any,
    @Body() requestChangePasswordDto: RequestChangePasswordDto
  ) {
    try {
      const userId = req.user.user_id;
      const result = await this.changePasswordService.requestChangePassword(
        userId,
        requestChangePasswordDto.currentPassword
      );
      return result;
    } catch (error) {
      throw new HttpException(
        {
          message: error.message || 'Failed to process password change request',
          statusCode: error.status || HttpStatus.BAD_REQUEST,
        },
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('verify-and-change')
  async verifyCodeAndChangePassword(
    @Request() req: any,
    @Body() verifyCodeAndChangePasswordDto: VerifyCodeAndChangePasswordDto
  ) {
    try {
      const userId = req.user.user_id;
      const result = await this.changePasswordService.verifyCodeAndChangePassword(
        userId,
        verifyCodeAndChangePasswordDto.code,
        verifyCodeAndChangePasswordDto.newPassword
      );
      return result;
    } catch (error) {
      throw new HttpException(
        {
          message: error.message || 'Failed to change password',
          statusCode: error.status || HttpStatus.BAD_REQUEST,
        },
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }
}
