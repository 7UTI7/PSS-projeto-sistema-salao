// Política de senha forte: uma única definição usada pelos DTOs e pelo bootstrap do admin.
import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
/** Limite efetivo do bcrypt: bytes além do 72º são ignorados no hash. */
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_RULES_MESSAGE =
  `A senha deve ter de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_BYTES} caracteres, com letra maiúscula, ` +
  'letra minúscula, número e caractere especial.';

/** Cada regra é testada isoladamente para que a mensagem de erro aponte o que faltou. */
const rules: ReadonlyArray<{ test: RegExp; message: string }> = [
  { test: /\p{Ll}/u, message: 'A senha deve conter pelo menos uma letra minúscula.' },
  { test: /\p{Lu}/u, message: 'A senha deve conter pelo menos uma letra maiúscula.' },
  { test: /\p{Nd}/u, message: 'A senha deve conter pelo menos um número.' },
  { test: /[^\p{L}\p{Nd}\s]/u, message: 'A senha deve conter pelo menos um caractere especial (ex.: ! @ # $ %).' },
];

export function passwordViolations(password: string): string[] {
  const violations: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) violations.push(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    violations.push(`A senha excede ${PASSWORD_MAX_BYTES} bytes suportados pelo bcrypt.`);
  }
  for (const rule of rules) if (!rule.test.test(password)) violations.push(rule.message);
  return violations;
}

export const strongPasswordSchema = z.string().superRefine((password, context) => {
  for (const message of passwordViolations(password)) context.addIssue({ code: 'custom', message });
});
