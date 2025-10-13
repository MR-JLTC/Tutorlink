import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { EmailService } from './email.service';

export class ContactDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  message: string;
}

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('contact')
  async sendContactEmail(@Body() contactData: ContactDto) {
    try {
      // Basic validation
      if (!contactData.name || !contactData.email || !contactData.subject || !contactData.message) {
        throw new HttpException('All fields are required', HttpStatus.BAD_REQUEST);
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactData.email)) {
        throw new HttpException('Invalid email format', HttpStatus.BAD_REQUEST);
      }

      const success = await this.emailService.sendContactEmail(contactData);
      
      if (success) {
        return { message: 'Email sent successfully' };
      } else {
        throw new HttpException('Failed to send email', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
