// Criptografia de campo (coluna) em repouso com AES-256-GCM.
//
// Formato gravado no banco: enc:v1:<iv base64>:<tag base64>:<texto cifrado base64>
//  - iv: 12 bytes aleatórios por valor (o mesmo nome gera cifras diferentes);
//  - tag: 16 bytes de autenticação do GCM (qualquer alteração no banco é detectada).
// A chave (32 bytes) vem só da variável de ambiente DATA_ENCRYPTION_KEY; nunca do código.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_BYTES = 12;

const key = Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64');

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptField(plain: string): string {
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

/** Valores antigos ainda em texto puro (antes da migração) são devolvidos como estão. */
export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const [ivText, tagText, dataText] = stored.slice(PREFIX.length).split(':');
  if (!ivText || !tagText || dataText === undefined) throw new Error('Campo criptografado com formato inválido.');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64')), decipher.final()]).toString('utf8');
}
