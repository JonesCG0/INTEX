const crypto = require("crypto");
const db = require("../db");
const donationConfig = require("../config/donations");
const { hashPassword } = require("./passwords");

const anonymousDonorId =
  Number(
    process.env.ANONYMOUS_DONOR_USERID ||
      donationConfig.anonymousDonorUserId ||
      0
  ) || null;

function getExecutor(trx) {
  return trx || db;
}

async function findUserByEmail(email, trx = null) {
  if (!email) {
    return null;
  }
  const executor = getExecutor(trx);
  return executor("users")
    .select("userid", "username", "useremail")
    .whereRaw("LOWER(useremail) = LOWER(?)", [email.toLowerCase()])
    .first();
}

async function findUserById(userid, trx = null) {
  if (!userid) {
    return null;
  }
  const executor = getExecutor(trx);
  return executor("users")
    .select("userid", "username", "useremail")
    .where({ userid })
    .first();
}

async function generateUniqueUsername(base, trx = null) {
  const executor = getExecutor(trx);
  const sanitizedBase =
    (base || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") || `donor${Date.now()}`;

  let attempt = sanitizedBase;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await executor("users")
      .select("userid")
      .where({ username: attempt })
      .first();
    if (!existing) {
      return attempt;
    }
    attempt = `${sanitizedBase}${counter}`;
    counter += 1;
  }
}

async function createSupportUser({ firstName, lastName, email }, trx = null) {
  const executor = getExecutor(trx);
  const usernameBase = email || `${firstName || "donor"}.${lastName || "supporter"}`;
  const username = await generateUniqueUsername(usernameBase, executor);
  const password = crypto.randomBytes(8).toString("hex");
  const passwordHash = await hashPassword(password);

  const [created] = await executor("users")
    .insert({
      username,
      password: passwordHash,
      userrole: "participant",
      userfirstname: firstName || null,
      userlastname: lastName || null,
      useremail: email || null,
      guardianemail: email || null,
    })
    .returning(["userid", "username", "useremail"]);

  return created;
}

async function findOrCreateSupportUser({ firstName, lastName, email }, trx = null) {
  const existing = await findUserByEmail(email, trx);
  if (existing) {
    return existing;
  }
  return createSupportUser({ firstName, lastName, email }, trx);
}

async function getAnonymousDonorUser(trx = null) {
  if (!anonymousDonorId) {
    throw new Error(
      "Anonymous donor user ID is not configured. Please set ANONYMOUS_DONOR_USERID in your environment."
    );
  }
  const user = await findUserById(anonymousDonorId, trx);
  if (!user) {
    throw new Error(
      `Anonymous donor user with ID ${anonymousDonorId} was not found in the database`
    );
  }
  return user;
}

async function recordDonation({ userid, amount, donationDate }, trx = null) {
  if (!userid) {
    throw new Error("A valid user ID is required to record a donation");
  }
  const executor = getExecutor(trx);
  const safeDate = donationDate || new Date().toISOString().slice(0, 10);

  const totalRow = await executor("donations")
    .where({ userid })
    .sum({ sum: "donationamount" })
    .first();

  const existingTotal = totalRow && totalRow.sum ? Number(totalRow.sum) : 0;
  const cumulativeTotal = Number((existingTotal + amount).toFixed(2));

  const [createdDonation] = await executor("donations")
    .insert({
      userid,
      donationdate: safeDate,
      donationamount: amount,
      totaldonations: cumulativeTotal,
    })
    .returning(["donationid", "userid", "donationamount", "donationdate", "totaldonations"]);

  return createdDonation;
}

module.exports = {
  findOrCreateSupportUser,
  findUserById,
  recordDonation,
  getAnonymousDonorUser,
};
