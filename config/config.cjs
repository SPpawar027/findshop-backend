
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env");
}

const isLocal = !databaseUrl.includes("rds.amazonaws.com") && databaseUrl.includes("localhost");
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