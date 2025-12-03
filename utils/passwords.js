const bcrypt = require("bcrypt");

const DEFAULT_ROUNDS = (() => {
  const parsed = parseInt(process.env.BCRYPT_ROUNDS, 10);
  if (Number.isInteger(parsed) && parsed >= 4 && parsed <= 15) {
    return parsed;
  }
  return 10;
})();

async function hashPassword(plainText) {
  if (typeof plainText !== "string" || !plainText.trim()) {
    throw new Error("Cannot hash an empty password");
  }
  return bcrypt.hash(plainText.trim(), DEFAULT_ROUNDS);
}

async function verifyPassword(plainText, hashed) {
  if (typeof plainText !== "string" || !plainText.trim()) {
    return false;
  }
  if (typeof hashed !== "string" || !hashed) {
    return false;
  }
  return bcrypt.compare(plainText.trim(), hashed);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
