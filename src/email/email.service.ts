import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}
  /**
   * Sends a verification code to the user's email address.
   * @param to - The recipient's email address.
   * @param name - The recipient's name.
   * @param code - The verification code to be sent.
   */
  async sendRandomCode(to: string, name: string, code: string): Promise<void> {
    await this.mailerService.sendMail({
      to,
      template: 'verify-code',
      subject: 'رمز التحقق من بريدك الإلكتروني',
      context: {
        name,
        code,
      },
    });
  }
  async send_reset_password_success(
    to: string,
    name: string,
    supportLink: string,
    loginLink: string,
    subject: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject,
      template: './reset-pass',
      context: {
        name,
        supportLink,
        loginLink,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }
}
