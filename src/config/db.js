const pgpLib = require('pg-promise');

const resolveDbHost = () => {
  if (process.env.POSTGRES_HOST || process.env.PGHOST) {
    return process.env.POSTGRES_HOST || process.env.PGHOST;
  }

  if (process.env.NODE_ENV === 'test') {
    return '127.0.0.1';
  }

  return 'db';
};

const resolveDatabaseUrl = () => {
  if (process.env.DATABASE_INTERNAL_URL) {
    return process.env.DATABASE_INTERNAL_URL;
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  return null;
};

const pgp = pgpLib();

const buildDbConfig = () => {
  const connectionString = resolveDatabaseUrl();
  const sslRequested = process.env.DB_SSL === 'true';
  const sslConfig = sslRequested ? { rejectUnauthorized: false } : false;

  if (connectionString) {
    return {
      connectionString,
      ssl: sslConfig,
    };
  }

  return {
    host: resolveDbHost(),
    port: Number(process.env.POSTGRES_PORT || process.env.PGPORT) || 5432,
    database: process.env.POSTGRES_DB || process.env.PGDATABASE,
    user: process.env.POSTGRES_USER || process.env.PGUSER,
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD,
    ssl: sslConfig,
  };
};

const dbConfig = buildDbConfig();

const db = pgp(dbConfig);

db.connect()
  .then((obj) => {
    console.log('Database connection successful');
    obj.done();
  })
  .catch((error) => {
    console.log('ERROR:', error.message || error);
  });

module.exports = {
  db,
  pgp,
  resolveDbHost,
  resolveDatabaseUrl,
  buildDbConfig,
};
