import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

export class EmailService {
  async sendActionLink(to: string, subject: string, actionUrl: string): Promise<void> {
    if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
      throw new AppError('Serviço de e-mail não configurado.', 503, 'EMAIL_UNAVAILABLE');
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === 'true',
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });

    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text: `Acesse o link a seguir. Ele é de uso único e expira em 15 minutos: ${actionUrl}`,
    });
  }
}