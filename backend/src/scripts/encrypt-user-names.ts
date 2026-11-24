// Migração única: cifra os nomes de usuários que ainda estão em texto puro no banco.
// Idempotente: valores já no formato enc:v1: são ignorados, então pode ser rodada de novo.
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/user.model.js';
import { encryptField, isEncrypted } from '../shared/utils/field-encryption.js';

async function encryptUserNames(): Promise<void> {
  await connectDatabase();
  // Lê direto da coleção para enxergar o valor gravado, sem o getter que decifra.
  const users = await User.collection.find({}, { projection: { name: 1 } }).toArray();
  let migrated = 0;
  for (const user of users) {
    const stored: unknown = user['name'];
    if (typeof stored !== 'string' || isEncrypted(stored)) continue;
    await User.collection.updateOne({ _id: user._id }, { $set: { name: encryptField(stored) } });
    migrated += 1;
  }
  process.stdout.write(`Nomes cifrados: ${migrated} de ${users.length} usuário(s).\n`);
}

encryptUserNames()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Falha na migração.'}\n`);
    process.exitCode = 1;
  })
  .finally(async () => disconnectDatabase());
