require("dotenv").config();

const db = require("../db");
const { hashPassword } = require("../utils/passwords");

// Detect if password is already bcrypt hash
function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

// main migration 
async function migratePasswords() {
  console.log("Starting password hash migration...");
  // pulls all the users
  const users = await db("users").select("userid", "username", "password");

  let updated = 0; // count of new hases written
  let skipped = 0; // users already using bcrypt
  let warnings = 0; // users with missing/invalid passowrd values

  // skip if the password is already valid
  for (const user of users) {
    if (isBcryptHash(user.password)) {
      skipped += 1;
      continue;
    }

    if (typeof user.password !== "string" || !user.password.trim()) {
      warnings += 1;
      console.warn(
        `Skipping user ${user.userid} (${user.username}) due to missing password value`
      );
      continue;
    }

    const hashed = await hashPassword(user.password);
    await db("users").where({ userid: user.userid }).update({ password: hashed });
    updated += 1;
    console.log(`Updated password for user ${user.userid} (${user.username})`);
  }

  console.log("Password hash migration complete.");
  console.log(`Updated: ${updated}`);
  console.log(`Already hashed: ${skipped}`);
  console.log(`Warnings: ${warnings}`);
}

migratePasswords()
  .then(() => {
    return db.destroy();
  })
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Password migration failed:", err);
    db.destroy()
      .catch(() => {
        // Ignore destroy errors on failure path.
      })
      .finally(() => {
        process.exit(1);
      });
  });
