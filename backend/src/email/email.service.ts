import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;
  private gmailUser: string;

  constructor() {
    // Configure nodemailer transporter using Gmail SMTP with App Password
    // Ensure you set process.env.GMAIL_APP_PASSWORD
    this.gmailUser = process.env.GMAIL_USER || 'darkages38@gmail.com';
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailAppPassword) {
      // eslint-disable-next-line no-console
      console.error('GMAIL_APP_PASSWORD is not set. Configure a Gmail App Password and export it as env.');
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: this.gmailUser,
        pass: gmailAppPassword,
      },
    });

    // Optional: verify transporter on startup for clearer diagnostics
    this.transporter.verify().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Email transporter verification failed:', err);
    });
  }

  async sendContactEmail(contactData: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<boolean> {
    try {
      const mailOptions = {
        from: `${this.gmailUser}`,
        to: `${this.gmailUser}`,
        replyTo: `${contactData.name} <${contactData.email}>`,
        subject: `Contact Form: ${contactData.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0ea5e9;">New Contact Form Submission</h2>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${contactData.name}</p>
              <p><strong>Email:</strong> ${contactData.email}</p>
              <p><strong>Subject:</strong> ${contactData.subject}</p>
            </div>
            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h3 style="color: #334155; margin-top: 0;">Message:</h3>
              <p style="line-height: 1.6; color: #475569;">${contactData.message.replace(/\n/g, '<br>')}</p>
            </div>
            <div style="margin-top: 20px; padding: 15px; background-color: #f1f5f9; border-radius: 8px;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                This message was sent from the TutorLink contact form.
              </p>
            </div>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }
}
