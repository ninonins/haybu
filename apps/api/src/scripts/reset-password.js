/**
 * Reset user password via CLI.
 * Usage: cd apps/api && node src/scripts/reset-password.js <email> <newPassword>
 * Example: node src/scripts/reset-password.js admin@haybu.local MyNewPass123
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(apiRoot);

// Load env BEFORE any config imports
import dotenv from "dotenv";
dotenv.config();

const { User } = await import("../db/models.js");
const { sequelize } = await import("../db/sequelize.js");
const bcrypt = (await import("bcryptjs")).default;

async function main() {
  const [email, newPassword] = process.argv.slice(2);
  if (!email || !newPassword) {
    console.error("Usage: node src/scripts/reset-password.js <email> <newPassword>");
    process.exit(1);
  }

  await sequelize.authenticate();
  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordHash = passwordHash;
  await user.save();
  console.log(`Password reset successfully for ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset failed:", err.message);
  process.exit(1);
});
