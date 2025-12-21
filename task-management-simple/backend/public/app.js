/**
 * Vanilla JS frontend:
 * - Client-side validation (Name + Email required, Email format)
 * - Calls backend REST APIs to CRUD tasks
 */

const API_BASE = "/api/tasks";

const form = document.getElementById("taskForm");
const formTitle = document.getElementById("formTitle");
const taskIdEl = document.getElementById("taskId");

const nameEl = document.getElementById("name");
const emailEl = document.getElementById("email");
const websiteEl = document.getElementById("website");
const phoneEl = document.getElementById("phone");
const notesEl = document.getElementById("notes");

const nameErrorEl = document.getElementById("nameError");
const emailErrorEl = document.getElementById("emailError");

const cancelEditBtn = document.getElementById("cancelEditBtn");
const refreshBtn = document.getElementById("refreshBtn");
const tasksTbody = document.getElementById("tasksTbody");

const toast = document.getElementById("toast");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.classList.remove("hidden", "success", "error");
  toast.classList.add(type);
  // Auto-hide after a short delay
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toast.classList.add("hidden"), 2500);
}

function clearErrors() {
  nameErrorEl.textContent = "";
  emailErrorEl.textContent = "";
}

function validateForm() {
  clearErrors();
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();

  let ok = true;
  if (!name) {
    nameErrorEl.textContent = "Name is required.";
    ok = false;
  }
  if (!email) {
    emailErrorEl.textContent = "Email is required.";
    ok = false;
  } else if (!EMAIL_REGEX.test(email)) {
    emailErrorEl.textContent = "Email is not valid.";
    ok = false;
  }
  return ok;
}

function setEditMode(task) {
  taskIdEl.value = String(task.id);
  nameEl.value = task.name || "";
  emailEl.value = task.email || "";
  websiteEl.value = task.website || "";
  phoneEl.value = task.phone || "";
  notesEl.value = task.notes || "";
  formTitle.textContent = "Edit Task";
  cancelEditBtn.classList.remove("hidden");
}

function resetForm() {
  taskIdEl.value = "";
  form.reset();
  clearErrors();
  formTitle.textContent = "Add Task";
  cancelEditBtn.classList.add("hidden");
}

async function apiRequest(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  // Try to parse JSON response (even for error responses)
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data?.errors?.name ||
      data?.errors?.email ||
      data?.message ||
      `Request failed with status ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function sanitize(text) {
  // Prevent HTML injection in table
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function renderTasks(tasks) {
  if (!tasks || tasks.length === 0) {
    tasksTbody.innerHTML = `<tr><td colspan="6" class="muted">No tasks found.</td></tr>`;
    return;
  }

  tasksTbody.innerHTML = tasks
    .map((t) => {
      const website = t.website
        ? `<a href="${sanitize(t.website)}" target="_blank" rel="noreferrer">${sanitize(
            t.website
          )}</a>`
        : '<span class="muted">—</span>';

      return `
        <tr>
          <td>${sanitize(t.name)}</td>
          <td>${sanitize(t.email)}</td>
          <td>${website}</td>
          <td>${t.phone ? sanitize(t.phone) : '<span class="muted">—</span>'}</td>
          <td>${t.notes ? sanitize(t.notes) : '<span class="muted">—</span>'}</td>
          <td>
            <div class="rowActions">
              <button class="btn" data-action="edit" data-id="${t.id}">Edit</button>
              <button class="btn danger" data-action="delete" data-id="${t.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

let cachedTasks = [];

async function loadTasks() {
  tasksTbody.innerHTML = `<tr><td colspan="6" class="muted">Loading...</td></tr>`;
  const result = await apiRequest(API_BASE, { method: "GET" });
  cachedTasks = result.data || [];
  renderTasks(cachedTasks);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const payload = {
    name: nameEl.value.trim(),
    email: emailEl.value.trim(),
    website: websiteEl.value.trim(),
    phone: phoneEl.value.trim(),
    notes: notesEl.value.trim()
  };

  try {
    const id = taskIdEl.value.trim();
    if (id) {
      await apiRequest(`${API_BASE}/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showToast("Task updated.", "success");
    } else {
      await apiRequest(API_BASE, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast("Task created.", "success");
    }

    resetForm();
    await loadTasks();
  } catch (err) {
    showToast(err.message || "Something went wrong.", "error");
  }
});

cancelEditBtn.addEventListener("click", () => resetForm());
refreshBtn.addEventListener("click", () => loadTasks());

tasksTbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);
  const task = cachedTasks.find((t) => Number(t.id) === id);
  if (!task) return;

  if (action === "edit") {
    setEditMode(task);
    return;
  }

  if (action === "delete") {
    const ok = window.confirm("Are you sure you want to delete this task?");
    if (!ok) return;

    try {
      await apiRequest(`${API_BASE}/${encodeURIComponent(String(id))}`, {
        method: "DELETE"
      });
      showToast("Task deleted.", "success");
      await loadTasks();
      // If you were editing the same task, reset the form
      if (taskIdEl.value && Number(taskIdEl.value) === id) resetForm();
    } catch (err) {
      showToast(err.message || "Delete failed.", "error");
    }
  }
});

// Initialize
resetForm();
loadTasks().catch((err) => showToast(err.message || "Failed to load tasks.", "error"));

