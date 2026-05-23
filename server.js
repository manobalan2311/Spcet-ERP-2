const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const mysql = require("mysql2/promise");
const { getMysqlConfig, loadEnvFile } = require("./config");

loadEnvFile();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = path.join(ROOT, "data", "db.json");
const MYSQL_CONFIG = {
  ...getMysqlConfig(),
  waitForConnections: true,
  connectionLimit: 10
};
const mysqlPool = mysql.createPool(MYSQL_CONFIG);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

async function readDb() {
  const raw = await fs.readFile(DB_PATH, "utf8");
  if (!raw || !raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in DB file:", e);
    return {};
  }
}

async function writeDb(db) {
  const tempPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tempPath, DB_PATH);
}

function publicStudent(student) {
  return { ...student };
}

function publicProfessor(professor) {
  return { ...professor };
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function findStudent(db, id) {
  return db.students.find((student) => student.id === id);
}

function findProfessor(db, id) {
  return (db.professors || []).find((professor) => professor.id === id);
}

function findSubject(student, subjectCode) {
  return student.subjects.find((subject) => subject.code === subjectCode);
}

function ensureDbCollections(db) {
  db.accounts ||= [];
  db.professors ||= [];
  db.students.forEach((student) => {
    student.subjects.forEach((subject) => {
      subject.notes ||= [];
    });
  });
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function safeCompareHash(firstHash, secondHash) {
  const first = Buffer.from(firstHash, "hex");
  const second = Buffer.from(secondHash, "hex");

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

async function findLogin(registerNumber, password) {
  const [rows] = await mysqlPool.execute(
    `
      SELECT student_id, register_number, password_hash
      FROM student_logins
      WHERE LOWER(register_number) = LOWER(?) AND is_active = 1
      LIMIT 1
    `,
    [registerNumber]
  );

  const login = rows[0];
  if (!login || !safeCompareHash(login.password_hash, hashPassword(password))) {
    return null;
  }

  await mysqlPool.execute(
    "UPDATE student_logins SET last_login_at = NOW() WHERE student_id = ?",
    [login.student_id]
  );

  return login;
}

async function findAccountLogin(role, identifier, password) {
  const db = await readDb();
  ensureDbCollections(db);
  const normalizedIdentifier = identifier.toLowerCase();
  const account = db.accounts.find(
    (item) =>
      item.role === role &&
      item.isActive !== false &&
      String(item.identifier).toLowerCase() === normalizedIdentifier
  );

  if (!account || !safeCompareHash(account.passwordHash, hashPassword(password))) {
    return null;
  }

  account.lastLoginAt = new Date().toISOString();
  await writeDb(db);
  return account;
}

function makeStudentFromRegistration(body) {
  const registerNumber = String(body.registerNumber || "").trim().toUpperCase();
  const name = String(body.name || "").trim();
  const department = String(body.department || "Computer Science and Engineering").trim();
  const semester = Number(body.semester || 1);

  return {
    id: `stu_${Date.now()}`,
    registerNumber,
    name,
    department,
    section: String(body.section || "A").trim(),
    semester: Number.isFinite(semester) ? semester : 1,
    academicYear: "2025-2026",
    cgpa: 0,
    targetCgpa: 8,
    profile: {
      fatherName: "",
      mobile: String(body.mobile || "").trim(),
      email: String(body.email || "").trim(),
      skills: "",
      interests: "",
      objective: "",
      projects: "",
      achievements: ""
    },
    subjects: [
      "CS601 Artificial Intelligence Dr. Meena S",
      "CS602 Compiler Design Prof. Raghavan P",
      "CS603 Web Technologies Ms. Kavya N",
      "CS604 Data Warehousing and Mining Dr. Daniel J",
      "CS605 Mobile Application Development Prof. Ismail K"
    ].map((line) => {
      const [code, ...rest] = line.split(" ");
      const faculty = rest.slice(-3).join(" ");
      const namePart = rest.slice(0, -3).join(" ");
      return {
        code,
        name: namePart,
        faculty,
        credits: code === "CS603" || code === "CS604" || code === "CS605" ? 3 : 4,
        targetGpa: 8,
        unitTests: [
          { name: "Unit Test 1", marks: 0, outOf: 50 },
          { name: "Unit Test 2", marks: 0, outOf: 50 }
        ],
        semesterExam: { internal: 0, external: 0, outOf: 100, gradePoint: 0, grade: "NA" },
        attendance: { held: 0, attended: 0, minimumPercent: 75 },
        notes: []
      };
    }),
    timetable: { updatedAt: new Date().toISOString(), rows: [] },
    fees: {
      semester: Number.isFinite(semester) ? semester : 1,
      total: 68500,
      paid: 0,
      currency: "INR",
      dueDate: "2026-06-10",
      status: "Pending",
      receipts: []
    }
  };
}

function nextReceiptId(fees) {
  const year = new Date().getFullYear();
  const count = (fees.receipts?.length || 0) + 1;
  return `RCPT-${year}-${String(count).padStart(4, "0")}`;
}

function attendancePercent(attendance) {
  if (!attendance.held) {
    return 100;
  }
  return Math.round((attendance.attended / attendance.held) * 1000) / 10;
}

function attendanceAdvice(subject) {
  const attendance = subject.attendance;
  const percent = attendancePercent(attendance);
  const minimum = attendance.minimumPercent;
  const required = minimum / 100;

  if (percent >= minimum) {
    const canMiss = Math.max(
      0,
      Math.floor((attendance.attended - required * attendance.held) / required)
    );
    return `${subject.name}: Attendance is ${percent}%. You can miss about ${canMiss} upcoming class${canMiss === 1 ? "" : "es"}, but attending regularly keeps your record safer.`;
  }

  const needed = Math.ceil(
    ((required * attendance.held) - attendance.attended) / (1 - required)
  );
  return `${subject.name}: Attendance is ${percent}%. Attend the next ${needed} class${needed === 1 ? "" : "es"} without absence to reach ${minimum}%.`;
}

function getWeakSubjects(student) {
  return student.subjects
    .map((subject) => {
      const unitAverage =
        subject.unitTests.reduce((sum, test) => sum + test.marks / test.outOf, 0) /
        subject.unitTests.length;
      return {
        subject,
        score: unitAverage * 0.65 + attendancePercent(subject.attendance) / 100 * 0.35
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((entry) => entry.subject);
}

function makeDoubtReply(student, message) {
  const text = message.toLowerCase();
  const weakSubjects = getWeakSubjects(student);
  const matchedSubject =
    student.subjects.find((subject) =>
      text.includes(subject.name.toLowerCase()) ||
      text.includes(subject.code.toLowerCase()) ||
      subject.name.toLowerCase().split(" ").some((word) => word.length > 4 && text.includes(word))
    ) || weakSubjects[0];

  const unitAverage = Math.round(
    matchedSubject.unitTests.reduce((sum, test) => sum + test.marks, 0) /
      matchedSubject.unitTests.reduce((sum, test) => sum + test.outOf, 0) *
      100
  );

  if (text.includes("attendance")) {
    return attendanceAdvice(matchedSubject);
  }

  if (text.includes("gpa") || text.includes("cgpa") || text.includes("grade")) {
    return `For ${matchedSubject.name}, your current grade point is ${matchedSubject.semesterExam.gradePoint}. To support a CGPA target of ${student.targetCgpa}, aim for ${matchedSubject.targetGpa}+ in this subject: revise unit-test mistakes, complete two previous semester question papers, and protect attendance above ${matchedSubject.attendance.minimumPercent}%.`;
  }

  return `For ${matchedSubject.name}, your unit-test average is about ${unitAverage}%. Start with the highest-weight topics, write one-page notes, then solve five short-answer questions before moving to long problems. Ask me a topic like "explain parsing" or "attendance in AI" and I will make it more specific.`;
}

function makeProjectReply(student, message) {
  const interests = student.profile.interests.toLowerCase();
  const text = `${message} ${interests}`.toLowerCase();

  const ideas = [
    {
      match: ["ai", "artificial", "machine", "learning"],
      title: "AI Attendance Risk Predictor",
      stack: "HTML, CSS, JavaScript, Node, MySQL",
      detail: "Predict students who may fall below attendance requirements and recommend subject-wise recovery plans."
    },
    {
      match: ["web", "javascript", "frontend"],
      title: "Smart College ERP Dashboard",
      stack: "Vanilla JS, REST API, Chart components",
      detail: "Unify marks, timetable, fees, receipts, and HOD notifications in one responsive student portal."
    },
    {
      match: ["cloud", "database", "sql"],
      title: "Campus Document Vault",
      stack: "Node, MySQL, role-based access",
      detail: "Store bonafide certificates, fee receipts, resumes, and project documents with searchable metadata."
    },
    {
      match: ["mobile", "app", "android"],
      title: "Offline Timetable Companion",
      stack: "Progressive Web App, local storage, push notifications",
      detail: "Let students save class schedules offline and get reminders before lectures and deadlines."
    }
  ];

  const chosen = ideas.find((idea) => idea.match.some((word) => text.includes(word))) || ideas[0];
  return `${chosen.title}\n\nWhy it fits: ${chosen.detail}\nSuggested stack: ${chosen.stack}\nFirst milestone: build login, student database, and one dashboard card. Second milestone: add prediction or recommendation logic. Final milestone: test with sample student records and prepare a demo report.`;
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await parseBody(req);
      const role = body.role === "professor" ? "professor" : "student";
      const identifier = String(body.registerNumber || body.identifier || "").trim();
      const password = String(body.password || "");
      const account = await findAccountLogin(role, identifier, password);

      if (account) {
        const db = await readDb();
        ensureDbCollections(db);
        if (role === "professor") {
          const professor = findProfessor(db, account.userId);
          if (!professor) {
            return sendError(res, 404, "Professor profile data not found");
          }
          return sendJson(res, 200, { role, professor: publicProfessor(professor) });
        }

        const student = findStudent(db, account.userId);
        if (!student) {
          return sendError(res, 404, "Student profile data not found");
        }
        return sendJson(res, 200, { role, student: publicStudent(student) });
      }

      if (role === "professor") {
        return sendError(res, 401, "Invalid professor ID or password");
      }

      const login = await findLogin(identifier, password);
      if (!login) {
        return sendError(res, 401, "Invalid register number or password");
      }
      const db = await readDb();
      const student = findStudent(db, login.student_id);

      if (!student) {
        return sendError(res, 404, "Student profile data not found");
      }

      return sendJson(res, 200, { student: publicStudent(student) });
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await parseBody(req);
      const registerNumber = String(body.registerNumber || "").trim().toUpperCase();
      const password = String(body.password || "");
      const name = String(body.name || "").trim();

      if (!registerNumber || !password || !name) {
        return sendError(res, 400, "Name, register number, and password are required");
      }

      if (password.length < 6) {
        return sendError(res, 400, "Password must be at least 6 characters");
      }

      const db = await readDb();
      ensureDbCollections(db);
      const exists = db.accounts.some(
        (account) => account.role === "student" && account.identifier.toLowerCase() === registerNumber.toLowerCase()
      ) || db.students.some(
        (student) => student.registerNumber.toLowerCase() === registerNumber.toLowerCase()
      );

      if (exists) {
        return sendError(res, 409, "An account already exists for this register number");
      }

      const student = makeStudentFromRegistration({ ...body, registerNumber });
      db.students.push(student);
      db.accounts.push({
        id: `acct_${Date.now()}`,
        role: "student",
        userId: student.id,
        identifier: registerNumber,
        passwordHash: hashPassword(password),
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      });

      await writeDb(db);
      return sendJson(res, 201, { role: "student", student: publicStudent(student) });
    }

    const studentMatch = url.pathname.match(/^\/api\/students\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/);

    if (studentMatch) {
      const [, studentId, resource, extra] = studentMatch;
      const db = await readDb();
      const student = findStudent(db, studentId);

      if (!student) {
        return sendError(res, 404, "Student not found");
      }

      if (req.method === "GET" && !resource) {
        return sendJson(res, 200, { student: publicStudent(student) });
      }

      if (req.method === "PATCH" && resource === "profile") {
        const body = await parseBody(req);
        const profileFields = ["fatherName", "mobile", "email", "skills", "interests", "objective", "projects", "achievements"];
        profileFields.forEach((field) => {
          if (typeof body[field] === "string") {
            student.profile[field] = body[field].trim();
          }
        });

        if (Number.isInteger(Number(body.semester))) {
          student.semester = Number(body.semester);
        }

        await writeDb(db);
        return sendJson(res, 200, { student: publicStudent(student) });
      }

      if (req.method === "PATCH" && resource === "timetable") {
        const body = await parseBody(req);
        if (!Array.isArray(body.rows) || body.rows.length === 0) {
          return sendError(res, 400, "Timetable rows are required");
        }

        student.timetable = {
          updatedAt: new Date().toISOString(),
          rows: body.rows.slice(0, 80).map((row) => ({
            day: String(row.day || "").trim(),
            time: String(row.time || "").trim(),
            subject: String(row.subject || "").trim(),
            room: String(row.room || "").trim(),
            faculty: String(row.faculty || "").trim()
          })).filter((row) => row.day && row.time && row.subject)
        };

        await writeDb(db);
        return sendJson(res, 200, { student: publicStudent(student) });
      }

      if (req.method === "GET" && resource === "notes") {
        const notes = student.subjects.flatMap((subject) =>
          (subject.notes || []).map((note) => ({
            ...note,
            subjectCode: subject.code,
            subjectName: subject.name
          }))
        );
        return sendJson(res, 200, { notes });
      }

      if (req.method === "POST" && resource === "fees" && extra === "pay") {
        const body = await parseBody(req);
        const amount = Number(body.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
          return sendError(res, 400, "Enter a valid payment amount");
        }

        const balance = Math.max(0, student.fees.total - student.fees.paid);
        if (amount > balance) {
          return sendError(res, 400, "Payment amount is greater than the pending balance");
        }

        const receipt = {
          id: nextReceiptId(student.fees),
          date: new Date().toISOString(),
          amount,
          method: String(body.method || "Online").trim(),
          transactionId: `TXN${Date.now()}${crypto.randomInt(100, 999)}`,
          semester: student.semester,
          status: "Paid"
        };

        student.fees.paid += amount;
        student.fees.status = student.fees.paid >= student.fees.total ? "Paid" : "Partially Paid";
        student.fees.receipts.unshift(receipt);

        await writeDb(db);
        return sendJson(res, 200, { receipt, student: publicStudent(student) });
      }
    }

    const professorMatch = url.pathname.match(/^\/api\/professors\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?$/);

    if (professorMatch) {
      const [, professorId, resource, studentId, subjectCode, action] = professorMatch;
      const db = await readDb();
      ensureDbCollections(db);
      const professor = findProfessor(db, professorId);

      if (!professor) {
        return sendError(res, 404, "Professor not found");
      }

      const allowedSubjectCodes = new Set(professor.subjectCodes || []);

      if (req.method === "GET" && !resource) {
        const students = db.students
          .map((student) => ({
            ...publicStudent(student),
            subjects: student.subjects.filter((subject) => allowedSubjectCodes.has(subject.code))
          }))
          .filter((student) => student.subjects.length > 0);

        return sendJson(res, 200, { professor: publicProfessor(professor), students });
      }

      if (resource === "students" && studentId && subjectCode) {
        const student = findStudent(db, studentId);
        if (!student) {
          return sendError(res, 404, "Student not found");
        }

        if (!allowedSubjectCodes.has(subjectCode)) {
          return sendError(res, 403, "This professor cannot manage the selected subject");
        }

        const subject = findSubject(student, subjectCode);
        if (!subject) {
          return sendError(res, 404, "Subject not found for student");
        }

        if (req.method === "PATCH" && action === "marks") {
          const body = await parseBody(req);
          const unit1 = Number(body.unit1);
          const unit2 = Number(body.unit2);
          const internal = Number(body.internal);
          const external = Number(body.external);
          const gradePoint = Number(body.gradePoint);

          if ([unit1, unit2, internal, external, gradePoint].some((value) => !Number.isFinite(value))) {
            return sendError(res, 400, "All marks and grade point values are required");
          }

          subject.unitTests[0].marks = Math.max(0, Math.min(unit1, subject.unitTests[0].outOf));
          subject.unitTests[1].marks = Math.max(0, Math.min(unit2, subject.unitTests[1].outOf));
          subject.semesterExam.internal = Math.max(0, Math.min(internal, 50));
          subject.semesterExam.external = Math.max(0, Math.min(external, subject.semesterExam.outOf));
          subject.semesterExam.gradePoint = Math.max(0, Math.min(gradePoint, 10));
          subject.semesterExam.grade = String(body.grade || subject.semesterExam.grade || "NA").trim().toUpperCase();

          await writeDb(db);
          return sendJson(res, 200, { student: publicStudent(student) });
        }

        if (req.method === "PATCH" && action === "attendance") {
          const body = await parseBody(req);
          const held = Number(body.held);
          const attended = Number(body.attended);

          if (!Number.isFinite(held) || !Number.isFinite(attended) || held < 0 || attended < 0 || attended > held) {
            return sendError(res, 400, "Attendance must be valid and attended cannot exceed held classes");
          }

          subject.attendance.held = Math.round(held);
          subject.attendance.attended = Math.round(attended);
          await writeDb(db);
          return sendJson(res, 200, { student: publicStudent(student) });
        }

        if (req.method === "POST" && action === "notes") {
          const body = await parseBody(req);
          const title = String(body.title || "").trim();
          const content = String(body.content || "").trim();

          if (!title || !content) {
            return sendError(res, 400, "Note title and content are required");
          }

          subject.notes ||= [];
          subject.notes.unshift({
            id: `note_${Date.now()}`,
            title,
            content,
            uploadedBy: professor.name,
            date: new Date().toISOString()
          });

          await writeDb(db);
          return sendJson(res, 201, { student: publicStudent(student) });
        }
      }
    }

    if (req.method === "GET" && url.pathname === "/api/notifications") {
      const department = url.searchParams.get("department");
      const db = await readDb();
      const notifications = db.notifications.filter(
        (item) => !department || item.department === department
      );
      return sendJson(res, 200, { notifications });
    }

    if (req.method === "POST" && url.pathname === "/api/assistant") {
      const body = await parseBody(req);
      const db = await readDb();
      const student = findStudent(db, body.studentId);

      if (!student) {
        return sendError(res, 404, "Student not found");
      }

      const mode = body.mode === "project" ? "project" : "doubt";
      const reply = mode === "project"
        ? makeProjectReply(student, String(body.message || ""))
        : makeDoubtReply(student, String(body.message || ""));

      return sendJson(res, 200, { reply });
    }

    return sendError(res, 404, "API route not found");
  } catch (error) {
    if (error.message === "Invalid JSON body") {
      return sendError(res, 400, error.message);
    }

    if (["ER_ACCESS_DENIED_ERROR", "ECONNREFUSED", "ER_BAD_DB_ERROR", "ER_NO_SUCH_TABLE"].includes(error.code)) {
      return sendError(
        res,
        503,
        "MySQL login database is not ready. Check .env credentials and run npm.cmd run setup:mysql."
      );
    }

    return sendError(res, 500, error.message || "Unexpected server error");
  }
}

async function serveStatic(req, res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>Page not found</p>");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  await serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`College ERP running at http://localhost:${PORT}`);
});
