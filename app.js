const state = {
  student: null,
  professor: null,
  professorStudents: [],
  role: "student",
  notifications: [],
  timetable: "Timetable",
  notes: "Subject Notes",
  doubtAi: "AI Doubts",
  profile: "Profile",
  resume: "Resume",
  professorStudentsLabel: "Manage Students",
  professorNotes: "Upload Notes"
};

const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const loginError = document.querySelector("#loginError");
const registerError = document.querySelector("#registerError");
const navItems = document.querySelectorAll(".nav-item");
const loginScreen = document.querySelector(".container");
const topEyebrow = document.querySelector(".eyebrow");

function setLoggedIn(payload) {
  state.role = payload.role || "student";
  state.student = payload.student || null;
  state.professor = payload.professor || null;
  localStorage.setItem("portalRole", state.role);
  localStorage.setItem("portalUserId", state.student?.id || state.professor?.id || "");
  if (state.role === "student" && state.student) {
    localStorage.setItem("studentId", state.student.id);
  }
  loginScreen.classList.add("is-hidden");
}
function renderIdentity() {
  const user = state.role === "professor" ? state.professor : state.student;
  if (!user) return;
  document.querySelector("#studentDept").textContent = state.role === "professor"
    ? user.designation
    : `Semester ${user.semester} / ${user.section}`;
  document.querySelector("#studentName").textContent = user.name;
  document.querySelector("#studentRegister").textContent = state.role === "professor" ? user.employeeId : user.registerNumber;
  document.querySelector("#studentInitials").textContent = initials(user.name);
  topEyebrow.textContent = state.role === "professor"
    ? `${user.department} / ${user.subjectCodes.length} subjects`
    : `${user.department} / Semester ${user.semester}`;
}

function renderNavigation() {
  navItems.forEach((item) => {
    const allowedRole = item.dataset.role;
    item.classList.toggle("is-hidden", Boolean(allowedRole && allowedRole !== state.role));
  });
}
 function renderDashboard() {
  if (state.role === "professor") {
    renderProfessorDashboard();
    return;
  }

  const student = state.student;

function renderProfessorDashboard() {
  const professor = state.professor;
  const subjectCount = professor.subjectCodes.length;
  const studentCount = state.professorStudents.length;
  const managedSubjects = state.professorStudents.reduce((sum, student) => sum + student.subjects.length, 0);

  document.querySelector("#dashboardStats").innerHTML = [
    statCard("Assigned Subjects", String(subjectCount), professor.subjectCodes.join(", ")),
    statCard("Students Visible", String(studentCount), "Only students in your subjects"),
    statCard("Subject Records", String(managedSubjects), "Marks and attendance can be updated"),
    statCard("Notes", "Ready", "Upload notes from the professor portal")
  ].join("");

  document.querySelector("#recommendations").innerHTML = `
    <article class="recommendation">
      <strong>Faculty workspace</strong>
      <p>Use Manage Students to update unit tests, semester marks, and attendance for your assigned subjects.</p>
    </article>
  `;
  document.querySelector("#dashboardNotifications").innerHTML = `
    <article class="notification-card">
      <header><strong>Professor Access</strong><span class="status-pill">Active</span></header>
      <p>Logged in as ${escapeHtml(professor.name)}. Subject ownership is enforced by the backend.</p>
      <small>${escapeHtml(professor.employeeId)}</small>
    </article>
  `;
}


function statCard(label, value, note) {
  return `
    <div class="stat-card">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
      <small>${escapeHtml(note)}</small>
    </div>
  `;
}

function renderNotes() {
  document.querySelector("#notesGrid").innerHTML = state.student.subjects.map((subject) => {
    const notes = subject.notes || [];
    return `
      <article class="note-card">
        <header>
          <div>
            <strong>${escapeHtml(subject.code)}</strong>
            <span>${escapeHtml(subject.name)}</span>
          </div>
          <span class="status-pill">${notes.length} note${notes.length === 1 ? "" : "s"}</span>
        </header>
        <div class="note-list">
          ${notes.map((note) => `
            <section>
              <h4>${escapeHtml(note.title)}</h4>
              <p>${escapeHtml(note.content)}</p>
              <small>${escapeHtml(note.uploadedBy)} / ${formatDate(note.date)}</small>
            </section>
          `).join("") || "<p class=\"muted-line\">No notes uploaded yet.</p>"}
        </div>
      </article>
    `;
  }).join("");
}

function renderFees() {

function renderProfessorStudents() {
  const container = document.querySelector("#professorStudentList");
  container.innerHTML = state.professorStudents.map((student) => `
    <article class="professor-card">
      <header>
        <div>
          <strong>${escapeHtml(student.name)}</strong>
          <span>${escapeHtml(student.registerNumber)} / Semester ${student.semester}</span>
        </div>
      </header>
      <div class="subject-grid">
        ${student.subjects.map((subject) => renderProfessorSubject(student, subject)).join("")}
      </div>
    </article>
  `).join("") || `<article class="notification-card"><p>No student records are assigned to this professor yet.</p></article>`;

  const select = document.querySelector("#noteForm select[name='studentSubject']");
  select.innerHTML = state.professorStudents.flatMap((student) =>
    student.subjects.map((subject) =>
      `<option value="${escapeHtml(`${student.id}|${subject.code}`)}">${escapeHtml(student.name)} - ${escapeHtml(subject.code)} ${escapeHtml(subject.name)}</option>`
    )
  ).join("");
}

function renderProfessorSubject(student, subject) {
  const [test1, test2] = subject.unitTests;
  return `
    <section class="subject-card professor-subject">
      <h4>${escapeHtml(subject.code)} ${escapeHtml(subject.name)}</h4>
      <form data-professor-form="marks" data-student="${escapeHtml(student.id)}" data-subject="${escapeHtml(subject.code)}" class="mini-form">
        <label>UT1<input name="unit1" type="number" min="0" max="${test1.outOf}" value="${test1.marks}" required></label>
        <label>UT2<input name="unit2" type="number" min="0" max="${test2.outOf}" value="${test2.marks}" required></label>
        <label>Internal<input name="internal" type="number" min="0" max="50" value="${subject.semesterExam.internal}" required></label>
        <label>External<input name="external" type="number" min="0" max="${subject.semesterExam.outOf}" value="${subject.semesterExam.external}" required></label>
        <label>Grade<input name="grade" value="${escapeHtml(subject.semesterExam.grade)}" required></label>
        <label>Point<input name="gradePoint" type="number" min="0" max="10" step="0.1" value="${subject.semesterExam.gradePoint}" required></label>
        <button class="primary-action" type="submit">Save Marks</button>
      </form>
      <form data-professor-form="attendance" data-student="${escapeHtml(student.id)}" data-subject="${escapeHtml(subject.code)}" class="mini-form attendance-mini">
        <label>Held<input name="held" type="number" min="0" value="${subject.attendance.held}" required></label>
        <label>Attended<input name="attended" type="number" min="0" value="${subject.attendance.attended}" required></label>
        <button class="ghost-action" type="submit">Save Attendance</button>
      </form>
    </section>
  `;
}


function renderAll() {
  renderNavigation();
  renderIdentity();
  renderDashboard();
  if (state.role === "professor") {
    renderProfessorStudents();
    showView("dashboard");
    return;
  }
  // Add these functions if they exist
  if (typeof renderMarks === "function") renderMarks();
  if (typeof renderTimetable === "function") renderTimetable();
  renderNotes();
  renderFees();
}

async function loadProfessorWorkspace(professorId) {
  const data = await api(`/api/professors/${professorId}`);
  state.professor = data.professor;
  state.professorStudents = data.students;
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString();
}


registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerError.textContent = "";

  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(registerForm)))
    });
    const noteData = await api(`/api/notifications?department=${encodeURIComponent(data.student.department)}`);
    state.notifications = noteData.notifications;
    setLoggedIn({ role: "student", student: data.student });
    showView("dashboard");
  } catch (error) {
    registerError.textContent = error.message;
  }
});

document.querySelector("#loginRole").addEventListener("change", (event) => {
  const isProfessor = event.target.value === "professor";
  document.querySelector("#identifierLabel").textContent = isProfessor ? "Professor ID" : "Register Number";
  document.querySelector("#registerNumber").value = isProfessor ? "PROF001" : "22CSE001";
  document.querySelector("#password").value = isProfessor ? "professor123" : "student123";
  document.querySelector("#showCreateAccount").classList.toggle("is-hidden", isProfessor);
});

document.querySelector("#showCreateAccount").addEventListener("click", () => {
  loginForm.classList.add("is-hidden");
  registerForm.classList.remove("is-hidden");
});

document.querySelector("#showLogin").addEventListener("click", () => {
  registerForm.classList.add("is-hidden");
  loginForm.classList.remove("is-hidden");
});


document.querySelector("#logoutButton")?.addEventListener("click", () => {
  localStorage.removeItem("studentId");
  localStorage.removeItem("portalRole");
  localStorage.removeItem("portalUserId");
  state.student = null;
  state.professor = null;
  state.professorStudents = [];
  loginScreen.classList.remove("is-hidden");
});

document.querySelector("#professorStudentList").addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-professor-form]");
  if (!form) {
    return;
  }

  event.preventDefault();
  const action = form.dataset.professorForm;
  const studentId = form.dataset.student;
  const subjectCode = form.dataset.subject;
  const payload = Object.fromEntries(new FormData(form));

  try {
    await api(`/api/professors/${state.professor.id}/students/${studentId}/${subjectCode}/${action}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await loadProfessorWorkspace(state.professor.id);
    renderDashboard();
    renderProfessorStudents();
  } catch (error) {
    alert(error.message);
  }
});

document.querySelector("#noteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const [studentId, subjectCode] = form.elements.studentSubject.value.split("|");
  const payload = Object.fromEntries(new FormData(form));

  try {
    await api(`/api/professors/${state.professor.id}/students/${studentId}/${subjectCode}/notes`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await loadProfessorWorkspace(state.professor.id);
    renderProfessorStudents();
    form.elements.title.value = "";
    form.elements.content.value = "";
    document.querySelector("#noteMessage").textContent = "Note uploaded.";
  } catch (error) {
    document.querySelector("#noteMessage").textContent = error.message;
  }
});

window.addEventListener("load", async () => {
  const studentId = localStorage.getItem("studentId");
  const role = localStorage.getItem("portalRole");
  const userId = localStorage.getItem("portalUserId");
  if (!role || !userId) {
    return;
  }
  try {
    if (role === "professor") {
      await loadProfessorWorkspace(userId);
      setLoggedIn({ role: "professor", professor: state.professor });
      showView("dashboard");
      return;
    }
    const data = await api(`/api/students/${userId}`);
    const noteData = await api(`/api/notifications?department=${encodeURIComponent(data.student.department)}`);
    state.notifications = noteData.notifications;
    setLoggedIn({ role: "student", student: data.student });
    showView("dashboard");
  } catch {
    localStorage.removeItem("studentId");
    localStorage.removeItem("portalRole");
    localStorage.removeItem("portalUserId");
  }
});
}}