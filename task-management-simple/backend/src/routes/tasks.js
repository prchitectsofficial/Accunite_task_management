/**
 * REST APIs for tasks:
 * - POST   /api/tasks        add task
 * - GET    /api/tasks        get all tasks
 * - PUT    /api/tasks/:id    update task
 * - DELETE /api/tasks/:id    delete task
 */

const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../utils/asyncHandler");
const { validateTaskPayload } = require("../middleware/validateTask");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, name, email, website, phone, notes, created_at, updated_at FROM tasks ORDER BY created_at DESC"
    );
    res.json({ data: rows });
  })
);

router.post(
  "/",
  validateTaskPayload,
  asyncHandler(async (req, res) => {
    const { name, email, website, phone, notes } = req.validatedTask;

    const [result] = await pool.query(
      "INSERT INTO tasks (name, email, website, phone, notes) VALUES (?, ?, ?, ?, ?)",
      [name, email, website, phone, notes]
    );

    const insertedId = result.insertId;
    const [rows] = await pool.query(
      "SELECT id, name, email, website, phone, notes, created_at, updated_at FROM tasks WHERE id = ?",
      [insertedId]
    );

    res.status(201).json({ message: "Task created", data: rows[0] });
  })
);

router.put(
  "/:id",
  validateTaskPayload,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid task id." });
    }

    const { name, email, website, phone, notes } = req.validatedTask;

    const [result] = await pool.query(
      "UPDATE tasks SET name = ?, email = ?, website = ?, phone = ?, notes = ? WHERE id = ?",
      [name, email, website, phone, notes, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    const [rows] = await pool.query(
      "SELECT id, name, email, website, phone, notes, created_at, updated_at FROM tasks WHERE id = ?",
      [id]
    );
    return res.json({ message: "Task updated", data: rows[0] });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid task id." });
    }

    const [result] = await pool.query("DELETE FROM tasks WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Task not found." });
    }

    return res.json({ message: "Task deleted" });
  })
);

module.exports = { tasksRouter: router };

