// Connecting to the database so we can run Queryies
const db = require("../db");
const { participantSelectColumns } = require("../utils/participantsModel");

// Get the participants and display them on the participants/index page
exports.getAllParticipants = async (req, res) => {
  try {
    const participants = await db("users")
      .select(participantSelectColumns)
      .orderBy("userid");
    res.render("participants/index", {
      participants,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch participants error:", err);
    res.status(500).send("Server error");
  }
};

// Get a single participant and show their details
exports.getParticipantById = async (req, res) => {
  try {
    const participant = await db("users")
      .select(participantSelectColumns)
      .where({ userid: req.params.id })
      .first();

    if (!participant) {
      return res.status(404).send("Participant not found");
    }

    res.render("participants/show", {
      participant,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Fetch participant error:", err);
    res.status(500).send("Server error");
  }
};

// Create a new participant
exports.createParticipant = async (req, res) => {
  // Add your create logic here
  res.redirect("/participants");
};

// Update a participants information
exports.updateParticipant = async (req, res) => {
  // Add your update logic here
  res.redirect(`/participants/${req.params.id}`);
};

// Delete a participant
exports.deleteParticipant = async (req, res) => {
  try {
    await db("users").where({ userid: req.params.id }).del();
    res.redirect("/participants");
  } catch (err) {
    console.error("Delete participant error:", err);
    res.status(500).send("Server error");
  }
};
