
const db = require("../db");

/**
 * Delete a user and all dependent records to satisfy foreign key constraints.
 * Everything runs inside a single transaction so either all rows are removed
 * or none are touched.
 *
 * @param {number|string} rawUserId
 */
async function deleteUserWithRelations(rawUserId) {
  const userid = Number(rawUserId);

  if (!Number.isInteger(userid) || userid <= 0) {
    throw new Error("A valid userid must be provided for deletion.");
  }

  await db.transaction(async (trx) => {
    const registrationIds = await trx("registrations")
      .where({ userid })
      .pluck("registrationid");

    if (registrationIds.length > 0) {
      await trx("surveys").whereIn("registrationid", registrationIds).del();
    }

    await trx("registrations").where({ userid }).del();
    await trx("milestones").where({ userid }).del();
    await trx("donations").where({ userid }).del();

    await trx("users").where({ userid }).del();
  });
}

module.exports = {
  deleteUserWithRelations,
};
