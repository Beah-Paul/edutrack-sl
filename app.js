// ============================================================
//  EduTrack SL — Full School Management System
//  app.js — All logic: DB, Students, Attendance, Grades, Fees,
//           Teachers, Reports, Notifications, Settings, Sync
// ============================================================

let GOOGLE_SHEETS_URL =
  localStorage.getItem("gsheet_url") ||
  "https://script.google.com/macros/s/AKfycbyleYGf15FEOlk_5FQWCfhJ4zN_IOfd0zDR8IHazn18dXpy3V-CY21z_kaLRLSFqw1mXw/exec";
let db;
let settings = JSON.parse(localStorage.getItem("school_settings") || "{}");

// ─── DB SETUP ───────────────────────────────────────────────
const dbRequest = indexedDB.open("EduTrackSL", 1);

dbRequest.onerror = () => showToast("❌ DB Error. Please refresh.");

dbRequest.onsuccess = (e) => {
  db = e.target.result;
  console.log("DB ready");
  initApp();
};

dbRequest.onupgradeneeded = (e) => {
  db = e.target.result;
  const stores = [
    { name: "students", key: "id" },
    { name: "teachers", key: "id" },
    { name: "attendance", key: "id" },
    { name: "grades", key: "id" },
    { name: "fees", key: "id" },
    { name: "notifications", key: "id" },
  ];
  stores.forEach((s) => {
    if (!db.objectStoreNames.contains(s.name)) {
      const store = db.createObjectStore(s.name, {
        keyPath: s.key,
        autoIncrement: true,
      });
      store.createIndex("synced", "synced", { unique: false });
    }
  });
};

// ─── INIT ───────────────────────────────────────────────────
function initApp() {
  loadSettings();
  updateOnlineStatus();
  setTodayDate();
  updateDashboard();
  populateClassDropdowns();
  loadAttendance();
  if (navigator.onLine && GOOGLE_SHEETS_URL) syncAll();
}

function setTodayDate() {
  const today = new Date().toISOString().split("T")[0];
  const attDate = document.getElementById("attDate");
  if (attDate) attDate.value = today;
  const fDate = document.getElementById("f-date");
  if (fDate) fDate.value = today;
}

// ─── NAVIGATION ─────────────────────────────────────────────
const pageTitles = {
  dashboard: ["Dashboard", "Overview"],
  students: ["Students", "Manage enrolled students"],
  attendance: ["Attendance", "Mark & track daily attendance"],
  grades: ["Exam Grades", "Enter and review grades"],
  fees: ["Fee Payments", "Track school fee collection"],
  teachers: ["Teachers", "Teaching staff management"],
  reports: ["Reports", "Analytics & ministry reports"],
  notifications: ["Notifications", "Alerts & messages"],
  settings: ["Settings", "School & sync configuration"],
};

function showPage(name) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((n) => {
    if (n.getAttribute("onclick") && n.getAttribute("onclick").includes(name))
      n.classList.add("active");
  });
  const [title, crumb] = pageTitles[name] || [name, ""];
  document.getElementById("pageTitle").textContent = title;
  document.getElementById("pageBreadcrumb").textContent = crumb;

  if (name === "students") renderStudents();
  if (name === "attendance") {
    populateClassDropdowns();
    loadAttendance();
  }
  if (name === "grades") {
    populateClassDropdowns();
  }
  if (name === "fees") {
    populateFeeStudentDropdown();
    renderFees();
    updateFeeStats();
  }
  if (name === "teachers") renderTeachers();
  if (name === "reports") buildReports();
  if (name === "notifications") renderNotifications();
  if (name === "dashboard") updateDashboard();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

// ─── MODAL ──────────────────────────────────────────────────
function openModal(id) {
  if (id === "fee-modal") populateFeeStudentDropdown();
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  clearModalInputs(id);
}
function clearModalInputs(id) {
  document
    .querySelectorAll(`#${id} input, #${id} textarea`)
    .forEach((i) => (i.value = ""));
  document
    .querySelectorAll(`#${id} select`)
    .forEach((s) => (s.selectedIndex = 0));
  const editId = document.querySelector(`#${id} input[type=hidden]`);
  if (editId) editId.value = "";
}

// ─── TOAST ──────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

// ─── SETTINGS ───────────────────────────────────────────────
function loadSettings() {
  settings = JSON.parse(localStorage.getItem("school_settings") || "{}");
  if (settings.schoolName)
    document.getElementById("set-school-name").value = settings.schoolName;
  if (settings.location)
    document.getElementById("set-location").value = settings.location;
  if (settings.principal)
    document.getElementById("set-principal").value = settings.principal;
  if (settings.phone)
    document.getElementById("set-phone").value = settings.phone;
  if (settings.term) document.getElementById("set-term").value = settings.term;
  if (settings.year) document.getElementById("set-year").value = settings.year;
  if (settings.fee) document.getElementById("set-fee").value = settings.fee;
  const urlField = document.getElementById("set-gsheet-url");
  if (urlField) urlField.value = GOOGLE_SHEETS_URL;
}

function saveSettings() {
  settings = {
    schoolName: document.getElementById("set-school-name").value,
    location: document.getElementById("set-location").value,
    principal: document.getElementById("set-principal").value,
    phone: document.getElementById("set-phone").value,
    term: document.getElementById("set-term").value,
    year: document.getElementById("set-year").value,
    fee: document.getElementById("set-fee").value,
  };
  localStorage.setItem("school_settings", JSON.stringify(settings));
  showToast("✅ Settings saved!");
}

function saveGSheetURL() {
  GOOGLE_SHEETS_URL = document.getElementById("set-gsheet-url").value.trim();
  localStorage.setItem("gsheet_url", GOOGLE_SHEETS_URL);
  showToast("✅ URL saved!");
}

async function testConnection() {
  const res = document.getElementById("conn-result");
  res.textContent = "Testing...";
  if (!GOOGLE_SHEETS_URL) {
    res.textContent = "❌ No URL set.";
    return;
  }
  try {
    await fetch(GOOGLE_SHEETS_URL, {
      method: "GET",
      mode: "no-cors",
      redirect: "follow",
    });
    res.textContent = "✅ Connection successful!";
    res.style.color = "var(--green)";
  } catch (e) {
    res.textContent = "❌ Connection failed: " + e.message;
    res.style.color = "var(--red)";
  }
}

// ─── ONLINE STATUS ──────────────────────────────────────────
function updateOnlineStatus() {
  const badge = document.getElementById("statusBadge");
  if (navigator.onLine) {
    badge.textContent = "● Online";
    badge.className = "status-badge status-online";
  } else {
    badge.textContent = "● Offline";
    badge.className = "status-badge status-offline";
  }
}
window.addEventListener("online", () => {
  updateOnlineStatus();
  if (GOOGLE_SHEETS_URL) syncAll();
});
window.addEventListener("offline", updateOnlineStatus);

// ─── IDB HELPERS ────────────────────────────────────────────
function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbAdd(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readwrite");
    const req = tx
      .objectStore(store)
      .add({ ...data, synced: 0, timestamp: new Date().toISOString() });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbPut(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readwrite");
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbDelete(store, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readwrite");
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

// ─── CLASS DROPDOWNS ────────────────────────────────────────
const CLASSES = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
];

function populateClassDropdowns() {
  ["attClass", "gradeClass"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">All Classes</option>';
    CLASSES.forEach(
      (c) => (el.innerHTML += `<option value="${c}">${c}</option>`),
    );
    if (cur) el.value = cur;
  });
}

// ─── STUDENTS ───────────────────────────────────────────────
async function saveStudent() {
  const fname = document.getElementById("s-fname").value.trim();
  const lname = document.getElementById("s-lname").value.trim();
  const cls = document.getElementById("s-class").value;
  if (!fname || !lname || !cls) {
    showToast("⚠️ Fill required fields");
    return;
  }

  const student = {
    firstName: fname,
    lastName: lname,
    fullName: `${fname} ${lname}`,
    class: cls,
    gender: document.getElementById("s-gender").value,
    dob: document.getElementById("s-dob").value,
    parentName: document.getElementById("s-parent").value,
    parentPhone: document.getElementById("s-phone").value,
    address: document.getElementById("s-address").value,
    school: settings.schoolName || "School",
    admissionNo: "ADM" + Date.now(),
  };

  const editId = document.getElementById("s-edit-id").value;
  if (editId) {
    const all = await dbGetAll("students");
    const existing = all.find((s) => s.id == editId);
    if (existing) {
      await dbPut("students", { ...existing, ...student, synced: 0 });
    }
  } else {
    await dbAdd("students", student);
  }

  closeModal("student-modal");
  renderStudents();
  updateDashboard();
  showToast("✅ Student saved!");
  if (navigator.onLine && GOOGLE_SHEETS_URL) syncStore("students");
}

async function renderStudents() {
  const all = await dbGetAll("students");
  const fees = await dbGetAll("fees");
  const search = (
    document.getElementById("studentSearch")?.value || ""
  ).toLowerCase();
  const filtered = all.filter(
    (s) =>
      !search ||
      s.fullName.toLowerCase().includes(search) ||
      s.class.toLowerCase().includes(search),
  );

  document.getElementById("student-count").textContent =
    `${filtered.length} student${filtered.length !== 1 ? "s" : ""}`;

  const tbody = document.getElementById("studentTable");
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No students found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((s) => {
      const studentFees = fees.filter((f) => f.studentId == s.id);
      const paid = studentFees.reduce(
        (a, f) => a + (parseFloat(f.amountPaid) || 0),
        0,
      );
      const due = studentFees.reduce(
        (a, f) => a + (parseFloat(f.amountDue) || 0),
        0,
      );
      const feeStatus =
        due === 0
          ? '<span class="badge badge-yellow">No record</span>'
          : paid >= due
            ? '<span class="badge badge-green">Paid</span>'
            : paid > 0
              ? '<span class="badge badge-yellow">Partial</span>'
              : '<span class="badge badge-red">Unpaid</span>';
      return `<tr>
      <td><strong>${s.fullName}</strong><br><span class="text-muted">${s.admissionNo}</span></td>
      <td>${s.class}</td>
      <td>${s.gender || "—"}</td>
      <td>${s.parentPhone || s.parentName || "—"}</td>
      <td>${feeStatus}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editStudent(${s.id})">Edit</button>
        <button class="btn btn-sm btn-danger" style="margin-left:4px" onclick="deleteStudent(${s.id})">Del</button>
      </td>
    </tr>`;
    })
    .join("");
}

async function editStudent(id) {
  const all = await dbGetAll("students");
  const s = all.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("s-fname").value = s.firstName || "";
  document.getElementById("s-lname").value = s.lastName || "";
  document.getElementById("s-class").value = s.class || "";
  document.getElementById("s-gender").value = s.gender || "";
  document.getElementById("s-dob").value = s.dob || "";
  document.getElementById("s-parent").value = s.parentName || "";
  document.getElementById("s-phone").value = s.parentPhone || "";
  document.getElementById("s-address").value = s.address || "";
  document.getElementById("s-edit-id").value = id;
  openModal("student-modal");
}

async function deleteStudent(id) {
  if (!confirm("Delete this student? This cannot be undone.")) return;
  await dbDelete("students", id);
  renderStudents();
  updateDashboard();
  showToast("🗑 Student deleted");
}

// ─── ATTENDANCE ──────────────────────────────────────────────
async function loadAttendance() {
  const cls = document.getElementById("attClass")?.value || "";
  const date =
    document.getElementById("attDate")?.value ||
    new Date().toISOString().split("T")[0];
  const all = await dbGetAll("students");
  const attAll = await dbGetAll("attendance");

  const students = cls ? all.filter((s) => s.class === cls) : all;
  const todayAtt = attAll.filter(
    (a) => a.date === date && (!cls || a.class === cls),
  );

  const tbody = document.getElementById("attendanceTable");
  if (!students.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No students in selected class</td></tr>';
    updateAttCounts(0, 0, 0);
    return;
  }

  tbody.innerHTML = students
    .map((s, i) => {
      const existing = todayAtt.find((a) => a.studentId === s.id);
      const status = existing ? existing.status : "present";
      return `<tr id="att-row-${s.id}">
      <td>${i + 1}</td>
      <td><strong>${s.fullName}</strong></td>
      <td>${s.class}</td>
      <td>
        <div class="flex gap-8">
          <button class="att-btn ${status === "present" ? "present" : ""}" onclick="setAtt(${s.id},'present',this)">P</button>
          <button class="att-btn ${status === "absent" ? "absent" : ""}" onclick="setAtt(${s.id},'absent',this)">A</button>
          <button class="att-btn ${status === "late" ? "late" : ""}" onclick="setAtt(${s.id},'late',this)">L</button>
        </div>
      </td>
      <td><input type="text" placeholder="Note..." style="width:120px;padding:4px 6px" id="att-note-${s.id}" value="${existing ? existing.note || "" : ""}"/></td>
    </tr>`;
    })
    .join("");

  recountAtt();
  loadAttHistory();
}

function setAtt(studentId, status, btn) {
  const row = document.getElementById("att-row-" + studentId);
  row.querySelectorAll(".att-btn").forEach((b) => {
    b.className = "att-btn";
  });
  btn.classList.add(status);
  btn.dataset.status = status;
  recountAtt();
}

function recountAtt() {
  const rows = document.querySelectorAll('#attendanceTable tr[id^="att-row-"]');
  let p = 0,
    a = 0,
    l = 0;
  rows.forEach((row) => {
    const active = row.querySelector(
      ".att-btn.present, .att-btn.absent, .att-btn.late",
    );
    if (!active) {
      p++;
      return;
    }
    if (active.classList.contains("present")) p++;
    else if (active.classList.contains("absent")) a++;
    else if (active.classList.contains("late")) l++;
  });
  updateAttCounts(p, a, l);
}

function updateAttCounts(p, a, l) {
  document.getElementById("att-present-count").textContent = `Present: ${p}`;
  document.getElementById("att-absent-count").textContent = `Absent: ${a}`;
  document.getElementById("att-late-count").textContent = `Late: ${l}`;
}

function markAll(status) {
  document
    .querySelectorAll('#attendanceTable tr[id^="att-row-"]')
    .forEach((row) => {
      const btns = row.querySelectorAll(".att-btn");
      btns.forEach((b) => (b.className = "att-btn"));
      const target = [...btns].find(
        (b) =>
          b.textContent.trim()[0].toLowerCase() === status[0].toLowerCase(),
      );
      if (target) target.classList.add(status);
    });
  recountAtt();
}

async function saveAttendance() {
  const cls = document.getElementById("attClass").value;
  const date = document.getElementById("attDate").value;
  const all = await dbGetAll("students");
  const attAll = await dbGetAll("attendance");
  const students = cls ? all.filter((s) => s.class === cls) : all;

  for (const s of students) {
    const row = document.getElementById("att-row-" + s.id);
    if (!row) continue;
    const activeBtn = row.querySelector(
      ".att-btn.present, .att-btn.absent, .att-btn.late",
    );
    const status = activeBtn
      ? activeBtn.classList.contains("present")
        ? "present"
        : activeBtn.classList.contains("absent")
          ? "absent"
          : "late"
      : "present";
    const note = document.getElementById("att-note-" + s.id)?.value || "";

    const existing = attAll.find(
      (a) => a.studentId === s.id && a.date === date,
    );
    if (existing) {
      await dbPut("attendance", { ...existing, status, note, synced: 0 });
    } else {
      await dbAdd("attendance", {
        studentId: s.id,
        studentName: s.fullName,
        class: s.class,
        date,
        status,
        note,
      });
    }
  }

  showToast("✅ Attendance saved!");
  loadAttHistory();
  updateDashboard();
  if (navigator.onLine && GOOGLE_SHEETS_URL) syncStore("attendance");
}

async function loadAttHistory() {
  const attAll = await dbGetAll("attendance");
  const byDate = {};
  attAll.forEach((a) => {
    const key = a.date + "|" + (a.class || "All");
    if (!byDate[key])
      byDate[key] = {
        date: a.date,
        class: a.class || "All",
        p: 0,
        ab: 0,
        l: 0,
      };
    if (a.status === "present") byDate[key].p++;
    else if (a.status === "absent") byDate[key].ab++;
    else byDate[key].l++;
  });

  const rows = Object.values(byDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);
  const tbody = document.getElementById("attHistoryTable");
  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px">No records yet</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const total = r.p + r.ab + r.l;
      const rate = total ? Math.round((r.p / total) * 100) : 0;
      return `<tr>
      <td>${r.date}</td><td>${r.class}</td>
      <td><span class="color-green fw-600">${r.p}</span></td>
      <td><span class="color-red fw-600">${r.ab}</span></td>
      <td><span class="color-accent fw-600">${r.l}</span></td>
      <td>${rate}%</td>
    </tr>`;
    })
    .join("");
}

// ─── GRADES ──────────────────────────────────────────────────
async function loadGrades() {
  const cls = document.getElementById("gradeClass").value;
  const subject = document.getElementById("gradeSubject").value;
  const term = document.getElementById("gradeTerm").value;
  const tbody = document.getElementById("gradesTable");

  if (!cls || !subject) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Select class and subject</td></tr>';
    return;
  }

  const students = (await dbGetAll("students")).filter((s) => s.class === cls);
  const gradesAll = await dbGetAll("grades");

  if (!students.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No students in this class</td></tr>';
    return;
  }

  let totalScore = 0,
    gradeCount = 0;

  tbody.innerHTML = students
    .map((s) => {
      const existing = gradesAll.find(
        (g) => g.studentId === s.id && g.subject === subject && g.term === term,
      );
      const ca = existing ? existing.ca : "";
      const exam = existing ? existing.exam : "";
      const total = (parseFloat(ca) || 0) + (parseFloat(exam) || 0);
      if (ca !== "" && exam !== "") {
        totalScore += total;
        gradeCount++;
      }
      const grade = getGrade(total, ca !== "" || exam !== "");
      const remark = getRemark(total, ca !== "" || exam !== "");
      return `<tr>
      <td><strong>${s.fullName}</strong></td>
      <td><input type="number" class="grade-input" min="0" max="40" placeholder="0-40" value="${ca}" id="ca-${s.id}" onchange="calcRow(${s.id})"/></td>
      <td><input type="number" class="grade-input" min="0" max="60" placeholder="0-60" value="${exam}" id="ex-${s.id}" onchange="calcRow(${s.id})"/></td>
      <td id="tot-${s.id}" class="fw-600">${ca !== "" || exam !== "" ? total : "—"}</td>
      <td id="grd-${s.id}">${grade}</td>
      <td id="rem-${s.id}" class="${remark === "Excellent" ? "color-green" : remark === "Fail" ? "color-red" : ""}">${remark}</td>
    </tr>`;
    })
    .join("");

  const avg = gradeCount ? (totalScore / gradeCount).toFixed(1) : "—";
  document.getElementById("grade-avg-label").textContent = gradeCount
    ? `Class average: ${avg}`
    : "";
}

function calcRow(studentId) {
  const ca = parseFloat(document.getElementById("ca-" + studentId)?.value) || 0;
  const exam =
    parseFloat(document.getElementById("ex-" + studentId)?.value) || 0;
  const total = ca + exam;
  document.getElementById("tot-" + studentId).textContent = total;
  document.getElementById("grd-" + studentId).innerHTML = getGrade(total, true);
  const rem = getRemark(total, true);
  const remEl = document.getElementById("rem-" + studentId);
  remEl.textContent = rem;
  remEl.className =
    rem === "Excellent" ? "color-green" : rem === "Fail" ? "color-red" : "";
}

function getGrade(total, hasData) {
  if (!hasData) return "—";
  if (total >= 80) return '<span class="badge badge-green">A1</span>';
  if (total >= 70) return '<span class="badge badge-green">B2</span>';
  if (total >= 60) return '<span class="badge badge-blue">B3</span>';
  if (total >= 55) return '<span class="badge badge-blue">C4</span>';
  if (total >= 50) return '<span class="badge badge-blue">C5</span>';
  if (total >= 45) return '<span class="badge badge-yellow">C6</span>';
  if (total >= 40) return '<span class="badge badge-yellow">D7</span>';
  if (total >= 35) return '<span class="badge badge-red">E8</span>';
  return '<span class="badge badge-red">F9</span>';
}

function getRemark(total, hasData) {
  if (!hasData) return "—";
  if (total >= 75) return "Excellent";
  if (total >= 60) return "Very Good";
  if (total >= 50) return "Good";
  if (total >= 45) return "Average";
  if (total >= 40) return "Pass";
  return "Fail";
}

async function saveGrades() {
  const cls = document.getElementById("gradeClass").value;
  const subject = document.getElementById("gradeSubject").value;
  const term = document.getElementById("gradeTerm").value;
  if (!cls || !subject) {
    showToast("⚠️ Select class and subject first");
    return;
  }

  const students = (await dbGetAll("students")).filter((s) => s.class === cls);
  const gradesAll = await dbGetAll("grades");

  for (const s of students) {
    const caEl = document.getElementById("ca-" + s.id);
    const exEl = document.getElementById("ex-" + s.id);
    if (!caEl && !exEl) continue;
    const ca = caEl?.value || "";
    const exam = exEl?.value || "";
    if (ca === "" && exam === "") continue;

    const existing = gradesAll.find(
      (g) => g.studentId === s.id && g.subject === subject && g.term === term,
    );
    const gradeData = {
      studentId: s.id,
      studentName: s.fullName,
      class: cls,
      subject,
      term,
      ca,
      exam,
      total: (parseFloat(ca) || 0) + (parseFloat(exam) || 0),
    };
    if (existing)
      await dbPut("grades", { ...existing, ...gradeData, synced: 0 });
    else await dbAdd("grades", gradeData);
  }

  showToast("✅ Grades saved!");
  if (navigator.onLine && GOOGLE_SHEETS_URL) syncStore("grades");
}

// ─── FEES ────────────────────────────────────────────────────
async function populateFeeStudentDropdown() {
  const students = await dbGetAll("students");
  const sel = document.getElementById("f-student");
  if (!sel) return;
  sel.innerHTML =
    '<option value="">Select student</option>' +
    students
      .map((s) => `<option value="${s.id}">${s.fullName} (${s.class})</option>`)
      .join("");
}

async function saveFee() {
  const studentId = document.getElementById("f-student").value;
  if (!studentId) {
    showToast("⚠️ Select a student");
    return;
  }

  const students = await dbGetAll("students");
  const student = students.find((s) => s.id == studentId);

  const feeData = {
    studentId: parseInt(studentId),
    studentName: student?.fullName || "",
    class: student?.class || "",
    term: document.getElementById("f-term").value,
    amountDue: document.getElementById("f-due").value,
    amountPaid: document.getElementById("f-paid").value,
    date: document.getElementById("f-date").value,
    method: document.getElementById("f-method").value,
    notes: document.getElementById("f-notes").value,
    receiptNo: "RCP" + Date.now(),
  };

  await dbAdd("fees", feeData);
  closeModal("fee-modal");
  renderFees();
  updateFeeStats();
  updateDashboard();
  showToast("✅ Payment recorded!");
  if (navigator.onLine && GOOGLE_SHEETS_URL) syncStore("fees");
}

async function renderFees() {
  const fees = await dbGetAll("fees");
  const search = (
    document.getElementById("feeSearch")?.value || ""
  ).toLowerCase();
  const filtered = fees.filter(
    (f) => !search || f.studentName.toLowerCase().includes(search),
  );

  const tbody = document.getElementById("feeTable");
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">No payment records yet</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((f) => {
      const paid = parseFloat(f.amountPaid) || 0;
      const due = parseFloat(f.amountDue) || 0;
      const status =
        paid >= due
          ? '<span class="badge badge-green">Paid</span>'
          : paid > 0
            ? '<span class="badge badge-yellow">Partial</span>'
            : '<span class="badge badge-red">Unpaid</span>';
      return `<tr>
      <td><strong>${f.studentName}</strong></td>
      <td>${f.class}</td>
      <td>${f.term}</td>
      <td>Le ${Number(f.amountDue).toLocaleString()}</td>
      <td>Le ${Number(f.amountPaid).toLocaleString()}</td>
      <td>${f.date || "—"}</td>
      <td>${status}</td>
      <td><span class="text-muted" style="font-size:11px;font-family:var(--mono)">${f.receiptNo}</span></td>
    </tr>`;
    })
    .join("");
}

async function updateFeeStats() {
  const fees = await dbGetAll("fees");
  const expected = fees.reduce((a, f) => a + (parseFloat(f.amountDue) || 0), 0);
  const collected = fees.reduce(
    (a, f) => a + (parseFloat(f.amountPaid) || 0),
    0,
  );
  const outstanding = Math.max(0, expected - collected);
  const rate = expected ? Math.round((collected / expected) * 100) : 0;

  const fmt = (n) => "Le " + n.toLocaleString();
  document.getElementById("fee-expected").textContent = fmt(expected);
  document.getElementById("fee-collected").textContent = fmt(collected);
  document.getElementById("fee-outstanding").textContent = fmt(outstanding);
  document.getElementById("fee-rate").textContent = rate + "%";
}

// ─── TEACHERS ────────────────────────────────────────────────
async function saveTeacher() {
  const fname = document.getElementById("t-fname").value.trim();
  const lname = document.getElementById("t-lname").value.trim();
  if (!fname || !lname) {
    showToast("⚠️ Fill required fields");
    return;
  }

  const teacher = {
    firstName: fname,
    lastName: lname,
    fullName: `${fname} ${lname}`,
    subject: document.getElementById("t-subject").value,
    class: document.getElementById("t-class").value,
    phone: document.getElementById("t-phone").value,
    qualification: document.getElementById("t-qual").value,
    status: "Active",
  };

  const editId = document.getElementById("t-edit-id").value;
  if (editId) {
    const all = await dbGetAll("teachers");
    const existing = all.find((t) => t.id == editId);
    if (existing)
      await dbPut("teachers", { ...existing, ...teacher, synced: 0 });
  } else {
    await dbAdd("teachers", teacher);
  }

  closeModal("teacher-modal");
  renderTeachers();
  updateDashboard();
  showToast("✅ Teacher saved!");
  if (navigator.onLine && GOOGLE_SHEETS_URL) syncStore("teachers");
}

async function renderTeachers() {
  const all = await dbGetAll("teachers");
  const search = (
    document.getElementById("teacherSearch")?.value || ""
  ).toLowerCase();
  const filtered = all.filter(
    (t) => !search || t.fullName.toLowerCase().includes(search),
  );

  document.getElementById("teacher-count").textContent =
    `${filtered.length} teacher${filtered.length !== 1 ? "s" : ""}`;
  const tbody = document.getElementById("teacherTable");

  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No teachers yet</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (t) => `<tr>
    <td><strong>${t.fullName}</strong></td>
    <td>${t.subject || "—"}</td>
    <td>${t.class || "—"}</td>
    <td>${t.phone || "—"}</td>
    <td>${t.qualification || "—"}</td>
    <td><span class="badge badge-green">${t.status || "Active"}</span></td>
    <td>
      <button class="btn btn-sm btn-outline" onclick="editTeacher(${t.id})">Edit</button>
      <button class="btn btn-sm btn-danger" style="margin-left:4px" onclick="deleteTeacher(${t.id})">Del</button>
    </td>
  </tr>`,
    )
    .join("");
}

async function editTeacher(id) {
  const all = await dbGetAll("teachers");
  const t = all.find((x) => x.id === id);
  if (!t) return;
  document.getElementById("t-fname").value = t.firstName || "";
  document.getElementById("t-lname").value = t.lastName || "";
  document.getElementById("t-subject").value = t.subject || "";
  document.getElementById("t-class").value = t.class || "";
  document.getElementById("t-phone").value = t.phone || "";
  document.getElementById("t-qual").value = t.qualification || "";
  document.getElementById("t-edit-id").value = id;
  openModal("teacher-modal");
}

async function deleteTeacher(id) {
  if (!confirm("Delete this teacher?")) return;
  await dbDelete("teachers", id);
  renderTeachers();
  updateDashboard();
  showToast("🗑 Teacher deleted");
}

// ─── REPORTS ─────────────────────────────────────────────────
function switchReportTab(tab, el) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  ["summary", "attendance-report", "grade-report", "fee-report"].forEach(
    (t) => {
      document.getElementById("report-" + t).style.display =
        t === tab ? "" : "none";
    },
  );
  buildReports();
}

async function buildReports() {
  const students = await dbGetAll("students");
  const attAll = await dbGetAll("attendance");
  const gradesAll = await dbGetAll("grades");
  const fees = await dbGetAll("fees");

  // Summary stats
  document.getElementById("rep-students").textContent = students.length;

  if (attAll.length) {
    const byDate = {};
    attAll.forEach((a) => {
      if (!byDate[a.date]) byDate[a.date] = { p: 0, total: 0 };
      byDate[a.date].total++;
      if (a.status === "present") byDate[a.date].p++;
    });
    const rates = Object.values(byDate).map((d) =>
      d.total ? (d.p / d.total) * 100 : 0,
    );
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    document.getElementById("rep-att").textContent = Math.round(avg) + "%";
  } else {
    document.getElementById("rep-att").textContent = "—";
  }

  if (gradesAll.length) {
    const avg =
      gradesAll.reduce((a, g) => a + (parseFloat(g.total) || 0), 0) /
      gradesAll.length;
    document.getElementById("rep-grade").textContent = avg.toFixed(1);
  } else {
    document.getElementById("rep-grade").textContent = "—";
  }

  const collected = fees.reduce(
    (a, f) => a + (parseFloat(f.amountPaid) || 0),
    0,
  );
  const expected = fees.reduce((a, f) => a + (parseFloat(f.amountDue) || 0), 0);
  document.getElementById("rep-fee-rate").textContent = expected
    ? Math.round((collected / expected) * 100) + "%"
    : "—";

  // Overview
  const overviewEl = document.getElementById("report-overview-body");
  overviewEl.innerHTML = students.length
    ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div class="text-muted">Total Students</div><div class="fw-600" style="font-size:18px">${students.length}</div></div>
        <div><div class="text-muted">Classes</div><div class="fw-600" style="font-size:18px">${[...new Set(students.map((s) => s.class))].length}</div></div>
        <div><div class="text-muted">Attendance Records</div><div class="fw-600" style="font-size:18px">${attAll.length}</div></div>
        <div><div class="text-muted">Grade Records</div><div class="fw-600" style="font-size:18px">${gradesAll.length}</div></div>
      </div>`
    : '<div class="text-muted">No data yet</div>';

  // Attendance report by class
  const attByClass = {};
  attAll.forEach((a) => {
    if (!attByClass[a.class])
      attByClass[a.class] = { dates: {}, p: 0, ab: 0, l: 0 };
    attByClass[a.class].dates[a.date] = true;
    if (a.status === "present") attByClass[a.class].p++;
    else if (a.status === "absent") attByClass[a.class].ab++;
    else attByClass[a.class].l++;
  });
  const attTbody = document.getElementById("rep-att-table");
  const attClasses = Object.entries(attByClass);
  attTbody.innerHTML = attClasses.length
    ? attClasses
        .map(([cls, d]) => {
          const total = d.p + d.ab + d.l;
          const rate = total ? Math.round((d.p / total) * 100) : 0;
          return `<tr><td>${cls}</td><td>${Object.keys(d.dates).length}</td><td>${d.p}</td><td>${d.ab}</td><td>${rate}%</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No attendance data</td></tr>';

  // Grade report by subject
  const gradesBySubject = {};
  gradesAll.forEach((g) => {
    const key = g.subject + "|" + g.class;
    if (!gradesBySubject[key])
      gradesBySubject[key] = { subject: g.subject, class: g.class, scores: [] };
    if (g.total) gradesBySubject[key].scores.push(parseFloat(g.total));
  });
  const gradeTbody = document.getElementById("rep-grade-table");
  const gradeEntries = Object.values(gradesBySubject);
  gradeTbody.innerHTML = gradeEntries.length
    ? gradeEntries
        .map((g) => {
          const avg = g.scores.length
            ? (g.scores.reduce((a, b) => a + b, 0) / g.scores.length).toFixed(1)
            : "—";
          const high = g.scores.length ? Math.max(...g.scores) : "—";
          const low = g.scores.length ? Math.min(...g.scores) : "—";
          const passRate = g.scores.length
            ? Math.round(
                (g.scores.filter((s) => s >= 40).length / g.scores.length) *
                  100,
              ) + "%"
            : "—";
          return `<tr><td>${g.subject}</td><td>${g.class}</td><td>${g.scores.length}</td><td>${avg}</td><td>${high}</td><td>${low}</td><td>${passRate}</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No grade data</td></tr>';

  // Fee report by class
  const feeByClass = {};
  fees.forEach((f) => {
    if (!feeByClass[f.class])
      feeByClass[f.class] = { students: new Set(), expected: 0, collected: 0 };
    feeByClass[f.class].students.add(f.studentId);
    feeByClass[f.class].expected += parseFloat(f.amountDue) || 0;
    feeByClass[f.class].collected += parseFloat(f.amountPaid) || 0;
  });
  const feeTbody = document.getElementById("rep-fee-table");
  const feeEntries = Object.entries(feeByClass);
  feeTbody.innerHTML = feeEntries.length
    ? feeEntries
        .map(([cls, d]) => {
          const rate = d.expected
            ? Math.round((d.collected / d.expected) * 100) + "%"
            : "0%";
          return `<tr><td>${cls}</td><td>${d.students.size}</td><td>Le ${d.expected.toLocaleString()}</td><td>Le ${d.collected.toLocaleString()}</td><td>Le ${(d.expected - d.collected).toLocaleString()}</td><td>${rate}</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No fee data</td></tr>';
}

async function exportReport() {
  const students = await dbGetAll("students");
  const fees = await dbGetAll("fees");
  const attAll = await dbGetAll("attendance");

  let csv = "Student Name,Class,Gender,Parent Phone,Fee Paid,Fee Due\n";
  for (const s of students) {
    const sf = fees.filter((f) => f.studentId == s.id);
    const paid = sf.reduce((a, f) => a + (parseFloat(f.amountPaid) || 0), 0);
    const due = sf.reduce((a, f) => a + (parseFloat(f.amountDue) || 0), 0);
    csv += `"${s.fullName}","${s.class}","${s.gender || ""}","${s.parentPhone || ""}","${paid}","${due}"\n`;
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download =
    "school_report_" + new Date().toISOString().split("T")[0] + ".csv";
  a.click();
  showToast("📥 Report exported!");
}

// ─── NOTIFICATIONS ───────────────────────────────────────────
const quickMessages = {
  exam: {
    type: "Exam",
    message:
      "Reminder: Examinations are scheduled for next week. Please ensure your ward is prepared.",
  },
  fee: {
    type: "Fee",
    message:
      "Fee payment reminder: Please settle outstanding fees before the end of term.",
  },
  absent: {
    type: "Absence",
    message:
      "This is to inform you that your child was absent from school today.",
  },
  meeting: {
    type: "Meeting",
    message:
      "Parents/guardians are invited to attend a school meeting. Date and time to be communicated.",
  },
};

function quickAlert(type) {
  const q = quickMessages[type];
  document.getElementById("n-type").value = q.type;
  document.getElementById("n-message").value = q.message;
  openModal("notif-modal");
}

async function sendNotification() {
  const type = document.getElementById("n-type").value;
  const message = document.getElementById("n-message").value.trim();
  const recipients = document.getElementById("n-recipients").value;
  if (!message) {
    showToast("⚠️ Enter a message");
    return;
  }

  await dbAdd("notifications", {
    type,
    message,
    recipients,
    date: new Date().toLocaleDateString(),
    status: "Sent",
  });

  closeModal("notif-modal");
  renderNotifications();
  showToast("📨 Notification sent!");
  if (navigator.onLine && GOOGLE_SHEETS_URL) syncStore("notifications");
}

async function renderNotifications() {
  const all = await dbGetAll("notifications");
  const tbody = document.getElementById("notifTable");
  if (!all.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No notifications sent yet</td></tr>';
    return;
  }
  tbody.innerHTML = all
    .slice()
    .reverse()
    .map(
      (n) => `<tr>
    <td>${n.date}</td>
    <td><span class="badge badge-blue">${n.type}</span></td>
    <td style="max-width:240px">${n.message.substring(0, 80)}${n.message.length > 80 ? "..." : ""}</td>
    <td>${n.recipients}</td>
    <td><span class="badge badge-green">${n.status}</span></td>
  </tr>`,
    )
    .join("");
}

// ─── DASHBOARD ───────────────────────────────────────────────
async function updateDashboard() {
  const students = await dbGetAll("students");
  const teachers = await dbGetAll("teachers");
  const fees = await dbGetAll("fees");
  const attAll = await dbGetAll("attendance");

  document.getElementById("dash-students").textContent = students.length;
  document.getElementById("dash-teachers").textContent = teachers.length;

  const collected = fees.reduce(
    (a, f) => a + (parseFloat(f.amountPaid) || 0),
    0,
  );
  document.getElementById("dash-fees").textContent =
    "Le " + collected.toLocaleString();

  // Today's attendance rate
  const today = new Date().toISOString().split("T")[0];
  const todayAtt = attAll.filter((a) => a.date === today);
  if (todayAtt.length) {
    const present = todayAtt.filter((a) => a.status === "present").length;
    document.getElementById("dash-att").textContent =
      Math.round((present / todayAtt.length) * 100) + "%";
  } else {
    document.getElementById("dash-att").textContent = "—";
  }

  // Recent students
  const recentEl = document.getElementById("dash-recent-students");
  if (students.length) {
    recentEl.innerHTML = students
      .slice(-5)
      .reverse()
      .map(
        (s) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-bottom:1px solid var(--border)">
        <div>
          <strong style="font-size:13px">${s.fullName}</strong>
          <div class="text-muted">${s.class}</div>
        </div>
        <span class="badge badge-blue">${s.admissionNo}</span>
      </div>`,
      )
      .join("");
  } else {
    recentEl.innerHTML =
      '<div class="text-muted" style="padding:8px">No students yet</div>';
  }

  // Fee status
  const feeStatusEl = document.getElementById("dash-fee-status");
  const expected = fees.reduce((a, f) => a + (parseFloat(f.amountDue) || 0), 0);
  if (expected) {
    const rate = Math.round((collected / expected) * 100);
    feeStatusEl.innerHTML = `
      <div style="margin-bottom:8px;display:flex;justify-content:space-between;font-size:13px">
        <span>Collection Rate</span><strong>${rate}%</strong>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar" style="width:${rate}%;background:${rate > 70 ? "var(--green)" : rate > 40 ? "var(--accent)" : "var(--red)"}"></div>
      </div>
      <div class="text-muted" style="margin-top:6px">Le ${collected.toLocaleString()} of Le ${expected.toLocaleString()}</div>`;
  } else {
    feeStatusEl.innerHTML = '<div class="text-muted">No fee records</div>';
  }

  // Sync status
  const allStores = [
    "students",
    "teachers",
    "attendance",
    "grades",
    "fees",
    "notifications",
  ];
  let totalUnsynced = 0;
  for (const store of allStores) {
    const data = await dbGetAll(store);
    totalUnsynced += data.filter((d) => d.synced === 0).length;
  }
  const syncEl = document.getElementById("dash-sync-status");
  syncEl.innerHTML = totalUnsynced
    ? `<span class="badge badge-yellow">⏳ ${totalUnsynced} record(s) pending sync</span> <button class="btn btn-sm btn-outline" style="margin-left:8px" onclick="syncAll()">Sync Now</button>`
    : '<span class="badge badge-green">✅ All data synced</span>';
}

// ─── GOOGLE SHEETS SYNC ──────────────────────────────────────
async function syncStore(storeName) {
  if (!GOOGLE_SHEETS_URL) return;
  const all = await dbGetAll(storeName);
  const unsynced = all.filter((d) => d.synced === 0);
  if (!unsynced.length) return;

  for (const record of unsynced) {
    try {
      await fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        redirect: "follow",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ store: storeName, data: record }),
      });
      await dbPut(storeName, { ...record, synced: 1 });
    } catch (e) {
      console.error("Sync error:", e);
    }
  }
}

async function syncAll() {
  if (!navigator.onLine) {
    showToast("📴 Offline — sync when connected");
    return;
  }
  if (!GOOGLE_SHEETS_URL) {
    showToast("⚠️ No Google Sheets URL set in Settings");
    return;
  }
  showToast("🔄 Syncing...");
  const stores = [
    "students",
    "teachers",
    "attendance",
    "grades",
    "fees",
    "notifications",
  ];
  for (const s of stores) await syncStore(s);
  showToast("✅ All data synced!");
  updateDashboard();
}

// ─── DATA MANAGEMENT ─────────────────────────────────────────
async function exportAllData() {
  const data = {};
  for (const store of [
    "students",
    "teachers",
    "attendance",
    "grades",
    "fees",
    "notifications",
  ]) {
    data[store] = await dbGetAll(store);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download =
    "edutrack_backup_" + new Date().toISOString().split("T")[0] + ".json";
  a.click();
  showToast("📥 Data exported!");
}

async function clearAllData() {
  if (!confirm("⚠️ This will delete ALL local data permanently. Continue?"))
    return;
  if (!confirm("Are you absolutely sure? This CANNOT be undone.")) return;
  const stores = [
    "students",
    "teachers",
    "attendance",
    "grades",
    "fees",
    "notifications",
  ];
  for (const store of stores) {
    const tx = db.transaction([store], "readwrite");
    tx.objectStore(store).clear();
  }
  showToast("🗑 All data cleared");
  updateDashboard();
}
