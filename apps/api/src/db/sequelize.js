import { Sequelize } from "sequelize";
import { env } from "../config/env.js";

export const sequelize = new Sequelize(env.databaseUrl, {
  logging: false,
  dialect: "postgres"
});
