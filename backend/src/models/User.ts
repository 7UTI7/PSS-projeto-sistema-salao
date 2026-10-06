import { Schema, model, type HydratedDocument } from 'mongoose';

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
    name: { type: String, required: true, trim: true, maxlength: 120 },
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
  { timestamps: { createdAt: true, updatedAt: true }, versionKey: false },
);

export const User = model<UserFields>('User', userSchema);