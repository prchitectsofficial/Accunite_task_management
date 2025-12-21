# Task Management Web Application (Simple)

यह एक **complete working** Task Management Web App है:
- **Backend**: Node.js + Express + MySQL (`mysql2`)
- **Frontend**: Simple HTML + CSS + Vanilla JavaScript (backend से serve होती है)
- **Features**: Add / List / Update / Delete tasks + client/server validation

## Folder Structure

```
task-management-simple/
  README.md
  .gitignore
  backend/
    package.json
    .env.example
    public/
      index.html
      styles.css
      app.js
    src/
      server.js
      db.js
      migrate.js
      middleware/
        validateTask.js
      routes/
        tasks.js
      utils/
        asyncHandler.js
      migrations/
        001_create_tasks.sql
```

## Requirements

- Node.js 18+ (recommended)
- MySQL 8+ (या MySQL compatible)

## Step-by-step: Local Run

### 1) Backend dependencies install करें

```bash
cd /workspace/task-management-simple/backend
npm install
```

### 2) MySQL में database बनाएं

MySQL shell में:

```sql
CREATE DATABASE task_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3) Environment variables सेट करें

`backend/.env.example` को copy करके `backend/.env` बनाएं:

```bash
cp .env.example .env
```

फिर `backend/.env` में अपने credentials भरें:

```env
PORT=5000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=task_manager
```

### 4) Migrations / Table schema चलाएं

आपके पास 2 तरीके हैं:

#### तरीका A (Recommended): `npm run migrate`

यह `src/migrations/*.sql` फाइलें order में execute करेगा:

```bash
npm run migrate
```

#### तरीका B: Manual SQL run

MySQL shell में यह फाइल execute करें:

```sql
-- file: backend/src/migrations/001_create_tasks.sql
CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  website VARCHAR(2048) NULL,
  phone VARCHAR(50) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_tasks_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5) Server start करें

```bash
npm start
```

अब browser में खोलें:
- `http://localhost:5000`

## REST API Endpoints

- **Add task**: `POST /api/tasks`
- **Get all tasks**: `GET /api/tasks`
- **Update task**: `PUT /api/tasks/:id`
- **Delete task**: `DELETE /api/tasks/:id`

## Validation Rules

- **Mandatory**:
  - `name` required
  - `email` required + format validation
- **Optional**:
  - `website`
  - `phone`
  - `notes`

Validation **frontend** (form) और **backend** (API) दोनों पर लागू है।

