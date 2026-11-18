// Envio de e-mails (links de confirmação e redefinição) via SMTP.
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { AppError } from './app-error.js';

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
    const safeActionUrl = actionUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      text: `Acesse o link a seguir. Ele é de uso único e expira em 15 minutos: ${actionUrl}`,
      html: `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f7f5fa;color:#292532;font-family:Arial,sans-serif">
  <main style="max-width:520px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e8e4ed;border-radius:16px">
    <h1 style="font-size:22px">Nicolle Neris Studio</h1>
    <p>Recebemos uma solicitação relacionada à sua conta.</p>
    <p><a href="${safeActionUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#7045a4;color:#fff;text-decoration:none">Acessar link seguro</a></p>
    <p>O link é de uso único e expira em 15 minutos. Se você não solicitou esta ação, ignore esta mensagem.</p>
    <p>Se o botão não funcionar, copie este endereço para o navegador:<br><a href="${safeActionUrl}">${safeActionUrl}</a></p>
  </main>
</body>
</html>`,
    });
  }
}