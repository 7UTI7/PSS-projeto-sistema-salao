import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/AuthService.js';
import { AppError } from '../utils/AppError.js';

const passwordSchema = z.string().min(12).max(72)
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, 'Senha excede 72 bytes suportados pelo bcrypt.');
const emailSchema = z.string().email().max(254);
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
const resetSchema = z.object({ token: z.string().uuid(), password: passwordSchema });
const changeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
const adminCreateSchema = registerSchema.extend({ role: z.enum(['admin', 'colaborador']) });

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new AppError('Dados de entrada inválidos.', 400, 'VALIDATION_ERROR');
  return result.data;
}

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  async register(request: Request, response: Response): Promise<void> {
    const input = parseBody(registerSchema, request.body);
    await this.authService.register(input);
    response.status(202).json({ status: 'success', message: 'Se o cadastro for válido, enviaremos a confirmação por e-mail.' });
  }

  async createUser(request: Request, response: Response): Promise<void> {
    const input = parseBody(adminCreateSchema, request.body);
    await this.authService.createAccount({ ...input, mustChangePassword: true });
    response.status(202).json({ status: 'success', message: 'Conta criada; a confirmação será enviada por e-mail.' });
  }

  async listUsers(_request: Request, response: Response): Promise<void> {
    const data = await this.authService.listUsers();
    response.json({ status: 'success', data });
  }

  async deactivateUser(request: Request, response: Response): Promise<void> {
    const actor = request.user;
    if (!actor) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');
    const id = z.string().regex(/^[a-f\d]{24}$/i).safeParse(request.params['id']);
    if (!id.success) throw new AppError('Identificador inválido.', 400, 'INVALID_ID');
    await this.authService.deactivateUser(actor.id, id.data);
    response.status(204).send();
  }

  async login(request: Request, response: Response): Promise<void> {
    const input = parseBody(loginSchema, request.body);
    const result = await this.authService.login(input.email, input.password);
    response.json({ status: 'success', data: result });
  }

  async verifyEmail(request: Request, response: Response): Promise<void> {
    const token = z.string().uuid().safeParse(request.query['token']);
    if (!token.success) throw new AppError('Token inválido ou expirado.', 400, 'INVALID_TOKEN');
    await this.authService.verifyEmail(token.data);
    response.json({ status: 'success', message: 'E-mail confirmado.' });
  }

  async requestPasswordReset(request: Request, response: Response): Promise<void> {
    const input = parseBody(z.object({ email: emailSchema }), request.body);
    await this.authService.requestPasswordReset(input.email);
    response.status(202).json({ status: 'success', message: 'Se a conta existir, enviaremos instruções de redefinição.' });
  }

  resetPasswordPage(request: Request, response: Response): void {
    const token = z.string().uuid().safeParse(request.query['token']);
    if (!token.success) throw new AppError('Link inválido ou expirado.', 400, 'INVALID_TOKEN');

    response.type('html').send(`<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redefinir senha</title></head>
<body>
  <main>
    <h1>Redefinir senha</h1>
    <form method="post" action="/api/auth/reset-password">
      <input type="hidden" name="token" value="${token.data}">
      <label for="password">Nova senha</label>
      <input id="password" name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required>
      <button type="submit">Salvar senha</button>
    </form>
  </main>
</body>
</html>`);
  }

  async resetPassword(request: Request, response: Response): Promise<void> {
    const input = parseBody(resetSchema, request.body);
    await this.authService.resetPassword(input.token, input.password);
    response.json({ status: 'success', message: 'Senha redefinida.' });
  }

  async changePassword(request: Request, response: Response): Promise<void> {
    const user = request.user;
    if (!user) throw new AppError('Autenticação necessária.', 401, 'UNAUTHORIZED');
    const input = parseBody(changeSchema, request.body);
    await this.authService.changePassword(user.id, input.currentPassword, input.newPassword);
    response.json({ status: 'success', message: 'Senha alterada.' });
  }
}