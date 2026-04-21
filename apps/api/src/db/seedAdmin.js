import { sequelize } from "./sequelize.js";
import { syncSchema } from "./models.js";
import { bootstrapAdmin } from "../modules/auth/service.js";

await sequelize.authenticate();
await syncSchema();
const user = await bootstrapAdmin();
console.log(`Admin ready: ${user.email}`);
await sequelize.close();
