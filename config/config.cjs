
// sequelize-cli config — loaded by `npx sequelize-cli db:migrate` etc.
// Per Neon best practices: migrations must use the DIRECT (non-pooled) connection,
// because PgBouncer in transaction mode doesn't support session-level SET or
// prepared statements that migration tools rely on.
// DATABASE_URL_UNPOOLED is the direct connection; falls back to DATABASE_URL for
// local Postgres where pooling is irrelevant.

require("dotenv").config();

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env");
}

// Localhost connections skip SSL; any remote host (RDS, Neon, etc.) uses SSL.
const isLocal =
  databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

const dialectOptions = isLocal
  ? {}
  : {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  };

module.exports = {
  development: {
    url: databaseUrl,
    dialect: "postgres",
    dialectOptions,
    logging: console.log,
  },
  test: {
    url: databaseUrl,
    dialect: "postgres",
    dialectOptions,
    logging: false,
  },
  production: {
    url: databaseUrl,
    dialect: "postgres",
    dialectOptions,
    logging: false,
  },
};


// npm run migrate:local      # Neon dev  (your laptop)
// npm run migrate:dev        # Neon dev  (EC2 staging)
// npm run migrate:prod       # RDS prod  (EC2 production — careful!)
// npm run migrate:undo:local
// npm run migrate:undo:dev
// npm run migrate:undo:prod
