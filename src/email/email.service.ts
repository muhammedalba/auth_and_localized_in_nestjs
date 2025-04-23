import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'مرحباً بك!',
      text: `مرحباً ${name}! يسعدنا انضمامك إلينا.`,
      html: `<b>مرحباً ${name}</b><br>يسعدنا انضمامك إلينا.`,
    });
  }
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
}
