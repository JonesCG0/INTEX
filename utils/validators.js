const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeText(value) {
  if (!hasText(value)) {
    return null;
  }
  return value.trim();
}

function sanitizeEmail(value) {
  const email = sanitizeText(value);
  if (!email) {
    return null;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email : null;
}

function sanitizePhone(value) {
  if (typeof value !== "string") {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

function sanitizeZip(value) {
  if (typeof value !== "string") {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length === 5 || digits.length === 9) {
    return digits;
  }
  return null;
}

function sanitizeISODate(value) {
  const dateValue = sanitizeText(value);
  if (!dateValue) {
    return null;
  }
  if (!ISO_DATE_REGEX.test(dateValue)) {
    return null;
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return dateValue;
}

function sanitizeInt(value, { min = null, max = null } = {}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }
  if (min !== null && parsed < min) {
    return null;
  }
  if (max !== null && parsed > max) {
    return null;
  }
  return parsed;
}

function sanitizeDecimal(value, { min = null, max = null } = {}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (min !== null && parsed < min) {
    return null;
  }
  if (max !== null && parsed > max) {
    return null;
  }
  return Number(parsed.toFixed(2));
}

module.exports = {
  hasText,
  sanitizeText,
  sanitizeEmail,
  sanitizePhone,
  sanitizeZip,
  sanitizeISODate,
  sanitizeInt,
  sanitizeDecimal,
};
