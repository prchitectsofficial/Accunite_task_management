/**
 * Server-side validation for task payloads.
 * - Name and Email are required
 * - Email must be valid
 */

const EMAIL_REGEX =
  // Simple, pragmatic email validation (works for most common cases)
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function validateTaskPayload(req, res, next) {
  const name = normalizeString(req.body?.name);
  const email = normalizeString(req.body?.email);

  const errors = {};
  if (!name) errors.name = "Name is required.";
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Email is not valid.";

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Validation error", errors });
  }

  // Store normalized fields so routes can trust them
  req.validatedTask = {
    name,
    email,
    website: normalizeString(req.body?.website) || null,
    phone: normalizeString(req.body?.phone) || null,
    notes: normalizeString(req.body?.notes) || null
  };

  return next();
}

module.exports = { validateTaskPayload };
