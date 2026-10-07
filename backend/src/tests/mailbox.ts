export interface SentEmail {
  to: string;
  subject: string;
  actionUrl: string;
}

export const mailbox: SentEmail[] = [];

export function tokenFromLastEmail(): string {
  const last = mailbox.at(-1);
  if (!last) throw new Error('Nenhum e-mail capturado.');
  const token = new URL(last.actionUrl).searchParams.get('token');
  if (!token) throw new Error('E-mail sem token.');
  return token;
}
