import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetController } from './password-reset.controller';
import { ChangePasswordService } from './change-password.service';
import { ChangePasswordController } from './change-password.controller';
import { TestPasswordResetController } from './test-password-reset.controller';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationController } from './email-verification.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../database/entities/user.entity';
import { PasswordResetToken } from '../database/entities/password-reset-token.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordResetToken]),
    UsersModule,
    EmailModule,
    PassportModule,
    JwtModule.register({
      secret: 'SECRET_KEY_REPLACE_IN_PROD', // Use environment variables in production
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController, PasswordResetController, ChangePasswordController, TestPasswordResetController, EmailVerificationController],
  providers: [AuthService, PasswordResetService, ChangePasswordService, EmailVerificationService, JwtStrategy],
})
export class AuthModule {}
