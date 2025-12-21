/**
 * Express server:
 * - Serves REST APIs under /api
 * - Serves static frontend from /public
 */

require("dotenv").config();

const path = require("node:path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { tasksRouter } = require("./routes/tasks");

const app = express();

// Security headers (safe defaults)
app.use(helmet());

// Logs requests (useful for debugging)
app.use(morgan("dev"));

// If you serve frontend from the same origin, CORS isn't strictly needed.
// Keeping it enabled makes local dev easier if you host frontend separately.
app.use(cors({ origin: true }));

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// API routes
app.use("/api/tasks", tasksRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Static frontend
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Single-page fallback (optional)
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Central error handler (keep last)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
  res.status(status).json({ message: "Server error" });
});

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

