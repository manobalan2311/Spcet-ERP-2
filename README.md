# College ERP Portal

College ERP website built with HTML, CSS, JavaScript, Node.js, a JSON application database, and optional MySQL login tables.

## Features

- Student login and create-account flow using register number and password.
- Student dashboard with unit test marks, semester marks, attendance, timetable, subject notes, AI assistance, profile editing, resume builder, fee receipts, and notifications.
- Professor login with subject-based access.
- Professors can update marks, update attendance, and upload notes for their assigned subjects.
- Local database file at `data/db.json` stores students, professors, accounts, notifications, notes, timetable, marks, attendance, and fee data.

## Run With MySQL

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Create a `.env` file in this project folder:

   ```env
   PORT=3000
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=college_erp
   DEFAULT_STUDENT_PASSWORD=student123
   DEFAULT_PROFESSOR_PASSWORD=professor123
   ```

3. Create and seed the MySQL login table:

   ```powershell
   npm.cmd run setup:mysql
   ```

4. Start the portal:

   ```powershell
   npm.cmd start
   ```

5. Open:

   ```text
   http://localhost:3000
   ```

Demo logins:

```text
Student: 22CSE001 / student123
Professor: PROF001 / professor123
```

## Database

The main application data is stored in `data/db.json` so the portal works immediately without installing a database server.

Optional MySQL login tables are created by `database/schema.sql` and `npm.cmd run setup:mysql`:

```sql
student_logins(student_id, register_number, password_hash, is_active, last_login_at)
professor_logins(professor_id, employee_id, password_hash, is_active, last_login_at)
```

Passwords are stored as SHA-256 hashes, not plain text.
