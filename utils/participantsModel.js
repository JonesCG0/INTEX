const PARTICIPANT_FIELD_MAP = {
  participantid: "userid",
  participantfirstname: "userfirstname",
  participantlastname: "userlastname",
  participantemail: "useremail",
  participantphone: "userphone",
  participantzip: "userzip",
  participantdob: "userdob",
  participantrole: "userrole",
  participantschooloremployer: "userschooloremployer",
  participantfieldofinterest: "userfieldofinterest",
};

const participantSelectColumns = Object.entries(PARTICIPANT_FIELD_MAP).map(
  ([alias, column]) => `${column} as ${alias}`
);

module.exports = {
  PARTICIPANT_FIELD_MAP,
  participantSelectColumns,
};
