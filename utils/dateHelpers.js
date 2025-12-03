function normalizeDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatAsDateInput(value) {
  const parsed = normalizeDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
}

function formatAsDatetimeLocalInput(value) {
  const parsed = normalizeDate(value);
  if (!parsed) {
    return "";
  }
  const tzOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

module.exports = {
  formatAsDateInput,
  formatAsDatetimeLocalInput,
};
