// Modelo Mongoose dos usuários, perfis e dados de segurança de senha.
import { Schema, model, type HydratedDocument } from 'mongoose';
import { decryptField, encryptField } from '../shared/utils/field-encryption.js';

export const BCRYPT_ROUNDS = 12;
export const PASSWORD_MAX_AGE_DAYS = 90;

export type UserRole = 'admin' | 'colaborador';

export interface UserFields {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  lastPasswordChange: Date;
  mustChangePassword: boolean;
  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type UserDocument = HydratedDocument<UserFields>;

const userSchema = new Schema<UserFields>(
  {
    // Dado pessoal criptografado em repouso (AES-256-GCM). O tamanho máximo (120) é validado no DTO,
    // pois aqui o valor já está cifrado; o getter devolve o texto original para a aplicação.
    name: { type: String, required: true, set: encryptField, get: decryptField },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'colaborador'], default: 'colaborador', required: true },
    lastPasswordChange: { type: Date, default: Date.now, required: true },
    mustChangePassword: { type: Boolean, default: false, required: true },
    emailVerified: { type: Boolean, default: false, required: true },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: true }, versionKey: false, toJSON: { getters: true }, toObject: { getters: true } },
);

export const User = model<UserFields>('User', userSchema);