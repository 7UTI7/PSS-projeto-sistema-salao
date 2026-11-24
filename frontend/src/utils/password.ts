/**
 * Política de senha forte, espelho de backend/src/shared/utils/password-policy.ts.
 * A validação aqui só melhora a experiência; quem garante a regra é a API.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_HINT =
  `${PASSWORD_MIN_LENGTH}+ caracteres, com maiúscula, minúscula, número e símbolo`;

/** Devolve a primeira regra violada, ou `null` quando a senha é forte. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (!/\p{Ll}/u.test(password)) return 'A senha precisa ter pelo menos uma letra minúscula.';
  if (!/\p{Lu}/u.test(password)) return 'A senha precisa ter pelo menos uma letra maiúscula.';
  if (!/\p{Nd}/u.test(password)) return 'A senha precisa ter pelo menos um número.';
  if (!/[^\p{L}\p{Nd}\s]/u.test(password)) return 'A senha precisa ter pelo menos um caractere especial (ex.: ! @ # $ %).';
  return null;
}
