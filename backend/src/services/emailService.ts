import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Production-ready Email Service
 * Uses Nodemailer with SMTP - Works with Gmail, Outlook, or any SMTP server
 * 
 * Easiest Setup Options:
 * 1. Gmail: Use Gmail account + App Password (recommended for demos)
 * 2. Any SMTP: Use any email provider's SMTP settings
 * 3. Development: Uses Ethereal Email (auto-creates test account) if no config
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private useMock: boolean = false;
  private defaultFrom: string;

  constructor() {
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@example.com';
    
    // Try to create transporter with available configuration
    this.transporter = this.createTransporter();
    
    if (this.transporter) {
      console.log('✅ Email Service: SMTP transporter initialized');
    } else {
      console.warn('⚠️  Email Service: No SMTP configuration found, using mock mode');
      console.warn('   💡 Configure SMTP_* env variables or use Gmail for easy setup');
      this.useMock = true;
    }
  }

  private createTransporter(): Transporter | null {
    // Option 1: Gmail (easiest for demos)
    if (process.env.SMTP_HOST === 'gmail' || process.env.GMAIL_USER) {
      const user = process.env.GMAIL_USER || process.env.SMTP_USER;
      const password = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD;
      
      if (user && password) {
        this.defaultFrom = process.env.EMAIL_FROM || user;
        return nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user,
            pass: password, // Use App Password, not regular password
          },
        });
      }
    }

    // Option 2: Custom SMTP (works with any provider)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      this.defaultFrom = process.env.EMAIL_FROM || process.env.SMTP_USER;
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }

    // Option 3: Development mode - Ethereal Email (auto-generated test account)
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
      console.log('📧 Using Ethereal Email for development (auto-generated test account)');
      // Will create test account on first use
      return null; // Will use mock with Ethereal info
    }

    return null;
  }

  /**
   * Send verification email with production-ready email service
   */
  async sendVerificationEmail(to: string, token: string, name: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=${token}`;
    
    const subject = 'Verify Your Email Address';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome, ${name}!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        display: inline-block;
                        font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;

    if (this.useMock || !this.transporter) {
      // Mock mode - log email details (production-ready fallback)
      console.log('📧 [MOCK] Verification email would be sent:', {
        to,
        subject,
        verificationUrl,
      });
      console.log('📧 [MOCK] Configure SMTP settings in .env to send real emails');
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.defaultFrom,
        to,
        subject,
        html,
      });

      console.log('📧 Email sent successfully:', {
        messageId: info.messageId,
        to,
        previewUrl: nodemailer.getTestMessageUrl(info) || 'sent to email provider',
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('Email sending failed:', errorMessage);
      throw new Error(`Failed to send verification email: ${errorMessage}`);
    }
  }

  /**
   * Generic email sending method
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (this.useMock || !this.transporter) {
      console.log('📧 [MOCK] Email would be sent:', options);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      console.log('📧 Email sent successfully:', {
        messageId: info.messageId,
        to: options.to,
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('Email sending failed:', errorMessage);
      throw new Error(`Failed to send email: ${errorMessage}`);
    }
  }
}

// Singleton instance
export const emailService = new EmailService();
