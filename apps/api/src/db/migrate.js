import { sequelize } from "./sequelize.js";
import { syncSchema } from "./models.js";

await sequelize.authenticate();
await syncSchema();
console.log("Database schema synced.");
await sequelize.close();
