// ============================================================
//  EduTrack SL — Google Apps Script Backend
//  Paste this in script.google.com → New Project
//  Then Deploy → New Deployment → Web App → Anyone
// ============================================================

function doGet(e) {
  const store = e.parameter.store || 'students';
  try {
    const sheet = getOrCreateSheet(store);
    const data = sheetToJSON(sheet);
    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const store = payload.store;
    const record = payload.data;

    if (!store || !record) {
      return jsonResponse({ status: 'error', message: 'Missing store or data' });
    }

    const sheet = getOrCreateSheet(store);
    appendRecord(sheet, store, record);
    return jsonResponse({ status: 'success', store: store });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ── Sheet helpers ────────────────────────────────────────────
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    writeHeaders(sheet, name);
  }
  return sheet;
}

function writeHeaders(sheet, storeName) {
  const headers = {
    students:      ['ID','Full Name','First Name','Last Name','Class','Gender','DOB','Parent Name','Parent Phone','Address','Admission No','School','Timestamp'],
    teachers:      ['ID','Full Name','Subject','Class','Phone','Qualification','Status','Timestamp'],
    attendance:    ['ID','Student ID','Student Name','Class','Date','Status','Note','Timestamp'],
    grades:        ['ID','Student ID','Student Name','Class','Subject','Term','CA','Exam','Total','Timestamp'],
    fees:          ['ID','Student ID','Student Name','Class','Term','Amount Due','Amount Paid','Date','Method','Notes','Receipt No','Timestamp'],
    notifications: ['ID','Type','Message','Recipients','Date','Status','Timestamp'],
  };
  const h = headers[storeName] || ['ID','Data','Timestamp'];
  sheet.getRange(1, 1, 1, h.length).setValues([h]);
  sheet.getRange(1, 1, 1, h.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function appendRecord(sheet, storeName, record) {
  const mappers = {
    students: r => [r.id||'', r.fullName||'', r.firstName||'', r.lastName||'', r.class||'', r.gender||'', r.dob||'', r.parentName||'', r.parentPhone||'', r.address||'', r.admissionNo||'', r.school||'', r.timestamp||new Date().toISOString()],
    teachers: r => [r.id||'', r.fullName||'', r.subject||'', r.class||'', r.phone||'', r.qualification||'', r.status||'', r.timestamp||new Date().toISOString()],
    attendance: r => [r.id||'', r.studentId||'', r.studentName||'', r.class||'', r.date||'', r.status||'', r.note||'', r.timestamp||new Date().toISOString()],
    grades: r => [r.id||'', r.studentId||'', r.studentName||'', r.class||'', r.subject||'', r.term||'', r.ca||'', r.exam||'', r.total||'', r.timestamp||new Date().toISOString()],
    fees: r => [r.id||'', r.studentId||'', r.studentName||'', r.class||'', r.term||'', r.amountDue||'', r.amountPaid||'', r.date||'', r.method||'', r.notes||'', r.receiptNo||'', r.timestamp||new Date().toISOString()],
    notifications: r => [r.id||'', r.type||'', r.message||'', r.recipients||'', r.date||'', r.status||'', r.timestamp||new Date().toISOString()],
  };
  const row = mappers[storeName] ? mappers[storeName](record) : [JSON.stringify(record), new Date().toISOString()];
  sheet.appendRow(row);
}

function sheetToJSON(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Test function — run manually to verify ─────────────────
function testSetup() {
  const stores = ['students','teachers','attendance','grades','fees','notifications'];
  stores.forEach(s => getOrCreateSheet(s));
  Logger.log('All sheets created successfully!');
}
