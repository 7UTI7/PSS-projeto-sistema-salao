// Cria os usuários do MongoDB local de homologação (uso único, logo após o primeiro start).
// Chamado por ops/local/mongo.sh setup. Usa a "localhost exception": sem nenhum usuário
// cadastrado, a primeira conta pode ser criada a partir da própria máquina; depois disso
// toda conexão exige autenticação.
import mongoose from 'mongoose';

type MongoSetting = 'MONGO_PORT' | 'MONGO_ADMIN_USER' | 'MONGO_ADMIN_PASSWORD' | 'MONGO_APP_USER' | 'MONGO_APP_PASSWORD' | 'MONGO_APP_DB';

function read(name: MongoSetting): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} ausente.`);
  return value;
}

async function createUsers(): Promise<void> {
  const port = read('MONGO_PORT');
  const adminUser = read('MONGO_ADMIN_USER');
  const adminPassword = read('MONGO_ADMIN_PASSWORD');
  const appUser = read('MONGO_APP_USER');
  const appDb = read('MONGO_APP_DB');

  const local = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
  await local.connect();
  // Administrador com nome próprio (não "admin"/"root"), só com papéis de gestão.
  await local.db('admin').command({
    createUser: adminUser,
    pwd: adminPassword,
    roles: [{ role: 'userAdminAnyDatabase', db: 'admin' }, { role: 'clusterAdmin', db: 'admin' }],
  });
  await local.close();

  const credentials = `${encodeURIComponent(adminUser)}:${encodeURIComponent(adminPassword)}`;
  const admin = new mongoose.mongo.MongoClient(`mongodb://${credentials}@127.0.0.1:${port}/?authSource=admin&directConnection=true`);
  await admin.connect();
  // Usuário da API: privilégio mínimo, leitura e escrita apenas no banco da aplicação.
  await admin.db(appDb).command({
    createUser: appUser,
    pwd: read('MONGO_APP_PASSWORD'),
    roles: [{ role: 'readWrite', db: appDb }],
  });
  await admin.close();
  process.stdout.write(`Usuários criados: ${adminUser} (gestão) e ${appUser} (readWrite em ${appDb}).\n`);
}

createUsers().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Falha ao criar usuários.'}\n`);
  process.exitCode = 1;
});
