import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  async sendVerificationCode(email: string): Promise<{ message: string }> {
    console.log('=== EMAIL VERIFICATION REQUEST DEBUG ===');
    console.log('Sending verification code to:', email);
    console.log('Email type:', typeof email);
    console.log('Email length:', email.length);

    // Validate email parameter
    if (!email || typeof email !== 'string') {
      console.log('❌ Invalid email parameter:', email);
      throw new BadRequestException('Email is required and must be a valid string');
    }

    // Trim and validate email
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      console.log('❌ Empty email after trimming');
      throw new BadRequestException('Email cannot be empty');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: trimmedEmail },
      select: ['user_id', 'name', 'email', 'status', 'is_verified', 'verification_code', 'verification_expires']
    });

    if (existingUser) {
      console.log('✅ User already exists:', {
        user_id: existingUser.user_id,
        name: existingUser.name,
        email: existingUser.email,
        status: existingUser.status,
        is_verified: existingUser.is_verified
      });

      // If user is already verified, don't send another code
      if (existingUser.is_verified) {
        console.log('⚠️ User is already verified, not sending new code');
        return { message: 'Email is already verified' };
      }

      // Generate new verification code
      const verificationCode = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Update user with new verification code
      await this.userRepository.update(existingUser.user_id, {
        verification_code: verificationCode,
        verification_expires: expiresAt
      });

      console.log('✅ Updated existing user with new verification code');
      console.log('Verification code:', verificationCode);
      console.log('Expires at:', expiresAt);

      // Send verification email
      await this.sendVerificationEmail(existingUser.name || 'User', trimmedEmail, verificationCode);
      
      console.log('=== EMAIL VERIFICATION SENT SUCCESSFULLY ===');
      return { message: 'Verification code sent to your email' };
    }

    // Generate verification code for new user
    const verificationCode = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    console.log('✅ Generating verification code for new user');
    console.log('Verification code:', verificationCode);
    console.log('Expires at:', expiresAt);

    // Create new user with verification code
    const newUser = this.userRepository.create({
      email: trimmedEmail,
      verification_code: verificationCode,
      verification_expires: expiresAt,
      is_verified: false,
      status: 'pending_verification'
    });

    await this.userRepository.save(newUser);

    console.log('✅ Created new user with verification code');
    console.log('New user ID:', newUser.user_id);

    // Send verification email
    await this.sendVerificationEmail('User', trimmedEmail, verificationCode);
    
    console.log('=== EMAIL VERIFICATION SENT SUCCESSFULLY ===');
    return { message: 'Verification code sent to your email' };
  }

  async getEmailVerificationStatus(email: string): Promise<{ is_verified: number; user_id?: number }> {
    console.log('=== EMAIL STATUS CHECK DEBUG ===');
    console.log('Checking verification status for:', email);
    console.log('Email type:', typeof email);
    console.log('Email length:', email.length);

    // Validate email parameter
    if (!email || typeof email !== 'string') {
      console.log('❌ Invalid email parameter:', email);
      throw new BadRequestException('Email is required and must be a valid string');
    }

    // Trim and validate email
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      console.log('❌ Empty email after trimming');
      throw new BadRequestException('Email cannot be empty');
    }

    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: trimmedEmail },
      select: ['user_id', 'name', 'email', 'status', 'is_verified']
    });

    if (!user) {
      console.log('❌ No user found with email:', trimmedEmail);
      return { is_verified: 0 };
    }

    console.log('✅ User found for status check:', {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      status: user.status,
      is_verified: user.is_verified
    });

    return { 
      is_verified: user.is_verified ? 1 : 0,
      user_id: user.user_id
    };
  }

  async verifyEmailCode(email: string, code: string): Promise<{ message: string; user_id: number }> {
    console.log('=== EMAIL VERIFICATION DEBUG ===');
    console.log('Verifying email:', email);
    console.log('Code:', code);
    console.log('Email type:', typeof email);
    console.log('Code type:', typeof code);

    // Validate parameters
    if (!email || typeof email !== 'string') {
      console.log('❌ Invalid email parameter:', email);
      throw new BadRequestException('Email is required and must be a valid string');
    }

    if (!code || typeof code !== 'string') {
      console.log('❌ Invalid code parameter:', code);
      throw new BadRequestException('Verification code is required and must be a string');
    }

    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      console.log('❌ Empty email after trimming');
      throw new BadRequestException('Email cannot be empty');
    }

    if (!trimmedCode) {
      console.log('❌ Empty code after trimming');
      throw new BadRequestException('Verification code cannot be empty');
    }

    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: trimmedEmail },
      select: ['user_id', 'name', 'email', 'status', 'is_verified', 'verification_code', 'verification_expires']
    });

    if (!user) {
      console.log('❌ No user found with email:', trimmedEmail);
      throw new NotFoundException('User not found with this email address');
    }

    console.log('✅ User found for verification:', {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      status: user.status,
      is_verified: user.is_verified,
      verification_code: user.verification_code,
      verification_expires: user.verification_expires
    });

    // Check if already verified
    if (user.is_verified) {
      console.log('⚠️ User is already verified');
      return { message: 'Email is already verified', user_id: user.user_id };
    }

    // Check if verification code exists
    if (!user.verification_code) {
      console.log('❌ No verification code found for user');
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    // Check if verification code is expired
    if (user.verification_expires && new Date() > user.verification_expires) {
      console.log('❌ Verification code has expired');
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    // Verify the code
    if (user.verification_code !== trimmedCode) {
      console.log('❌ Verification code does not match');
      console.log('Expected:', user.verification_code);
      console.log('Received:', trimmedCode);
      throw new BadRequestException('Invalid verification code');
    }

    // Mark email as verified
    await this.userRepository.update(user.user_id, {
      is_verified: true,
      verification_code: null,
      verification_expires: null,
      status: 'active'
    });

    console.log('✅ Email verification successful');
    console.log('Updated user status to verified');

    return { 
      message: 'Email verified successfully', 
      user_id: user.user_id 
    };
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  private async sendVerificationEmail(name: string, email: string, verificationCode: string): Promise<void> {
    try {
      console.log('=== SENDING VERIFICATION EMAIL ===');
      console.log('To:', email);
      console.log('Name:', name);
      console.log('Code:', verificationCode);

      const transporter = require('nodemailer').createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });

      if (!process.env.GMAIL_APP_PASSWORD) {
        console.log('❌ GMAIL_APP_PASSWORD is not set!');
        throw new Error('Email service not configured');
      }

      const mailOptions = {
        from: `"TUTORLINK" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'TutorLink - Email Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4f46e5; margin: 0;">TutorLink</h1>
              <h2 style="color: #374151; margin: 10px 0;">Email Verification</h2>
            </div>
            
            <div style="background-color: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Hello ${name || 'User'}!
              </p>
              
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Thank you for registering with TutorLink! To complete your tutor application, please verify your email address using the code below:
              </p>
              
              <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h3 style="color: #4f46e5; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 0; font-family: 'Courier New', monospace;">
                  ${verificationCode}
                </h3>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                This code will expire in 15 minutes. If you didn't request this verification, please ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2024 TutorLink. All rights reserved.
              </p>
            </div>
          </div>
        `
      };

      console.log('Mail options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent successfully');
      console.log('Message ID:', result.messageId);
      
    } catch (error) {
      console.log('❌ Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }
}
