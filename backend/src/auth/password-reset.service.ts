import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { PasswordResetToken } from '../database/entities/password-reset-token.entity';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepository: Repository<PasswordResetToken>,
    private emailService: EmailService,
  ) {}

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    // Find user by email with explicit field selection
    const user = await this.userRepository.findOne({ 
      where: { email },
      select: ['user_id', 'name', 'email', 'status', 'is_verified']
    });
    if (!user) {
      throw new NotFoundException('User not found with this email address');
    }

    // Debug logging
    console.log('User found for password reset:', {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      status: user.status
    });

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry date to 15 minutes from now
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 15);

    // Invalidate any existing tokens for this user
    await this.passwordResetTokenRepository.update(
      { user_id: user.user_id, is_used: false },
      { is_used: true }
    );

    // Create new password reset token
    const passwordResetToken = this.passwordResetTokenRepository.create({
      user_id: user.user_id,
      changepasscode: verificationCode,
      expiry_date: expiryDate,
      is_used: false,
    });

    await this.passwordResetTokenRepository.save(passwordResetToken);

    // Send verification code via email
    console.log(`Attempting to send password reset email to: ${user.email}`);
    const displayName = user.name || 'User'; // Fallback if name is null/empty
    const emailSent = await this.sendPasswordResetEmail(displayName, user.email, verificationCode);
    
    if (!emailSent) {
      console.error(`Failed to send password reset email to: ${user.email}`);
      throw new BadRequestException('Failed to send verification code. Please check your email configuration and try again.');
    }
    
    console.log(`Password reset email sent successfully to: ${user.email}`);

    return {
      message: 'Verification code sent to your email address. Please check your inbox and spam folder.'
    };
  }

  async verifyCodeAndResetPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ message: string }> {
    // Find user by email with explicit field selection
    const user = await this.userRepository.findOne({ 
      where: { email },
      select: ['user_id', 'name', 'email', 'status', 'is_verified']
    });
    if (!user) {
      throw new NotFoundException('User not found with this email address');
    }

    // Find valid token
    const token = await this.passwordResetTokenRepository.findOne({
      where: {
        user_id: user.user_id,
        changepasscode: code,
        is_used: false,
      },
    });

    if (!token) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Check if token is expired
    if (new Date() > token.expiry_date) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await this.userRepository.update(user.user_id, {
      password: hashedPassword,
    });

    // Mark token as used
    await this.passwordResetTokenRepository.update(token.id, {
      is_used: true,
    });

    return {
      message: 'Password has been successfully reset. You can now log in with your new password.'
    };
  }

  private async sendPasswordResetEmail(
    name: string,
    email: string,
    verificationCode: string
  ): Promise<boolean> {
    try {
      // Debug logging
      console.log('Sending password reset email with details:', {
        name: name,
        email: email,
        verificationCode: verificationCode
      });
      // Create a new transporter for this service
      const gmailUser = process.env.GMAIL_USER || 'johnemmanuel.devera@bisu.edu.ph';
      const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

      if (!gmailAppPassword) {
        console.error('GMAIL_APP_PASSWORD is not set. Cannot send password reset email.');
        return false;
      }

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });

      const mailOptions = {
        from: `"TutorLink" <${gmailUser}>`,
        to: email,
        subject: '🔐 Password Reset Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">
            <div style="background-color: #0ea5e9; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
              <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your verification code is ready</p>
            </div>
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #1e293b; margin-top: 0;">Hello ${name || 'User'}!</h2>
              <p style="color: #475569; line-height: 1.6; font-size: 16px;">
                You requested to reset your password for your TutorLink account. 
                Use the verification code below to complete the password reset process.
              </p>
              <div style="background-color: #f0f9ff; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #0ea5e9; text-align: center;">
                <h3 style="color: #0ea5e9; margin-top: 0; margin-bottom: 15px;">Your Verification Code</h3>
                <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; display: inline-block; border: 2px dashed #0ea5e9;">
                  <span style="color: #0c4a6e; font-size: 32px; font-weight: bold; letter-spacing: 4px; font-family: 'Courier New', monospace;">${verificationCode}</span>
                </div>
              </div>
              <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <h3 style="color: #92400e; margin-top: 0;">⚠️ Important Security Information</h3>
                <ul style="color: #92400e; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>This code will expire in <strong>15 minutes</strong></li>
                  <li>Do not share this code with anyone</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>For security, this code can only be used once</li>
                </ul>
              </div>
              <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #334155; margin-top: 0;">Next Steps</h3>
                <ol style="color: #475569; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>Go back to the password reset page</li>
                  <li>Enter the verification code: <strong>${verificationCode}</strong></li>
                  <li>Create your new password</li>
                  <li>Log in with your new password</li>
                </ol>
              </div>
              <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 30px;">
                If you have any questions or didn't request this password reset, please contact our support team.
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
              <p>This email was sent from TutorLink - Connecting Minds, Building Futures</p>
            </div>
          </div>
        `,
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent successfully to ${email}`);
      console.log('Message ID:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response
      });
      return false;
    }
  }
}
