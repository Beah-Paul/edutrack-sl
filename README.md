# EduTrack SL — School Management System

Offline-first PWA for managing school operations in Sierra Leone.

## Files
- `index.html` — Main app UI
- `app.js` — All app logic (students, attendance, grades, fees, teachers, reports, notifications)
- `service-worker.js` — Offline caching
- `manifest.json` — PWA manifest (installable on phone)
- `google-apps-script.js` — Backend script for Google Sheets sync

---

## Features
| Module | What it does |
|---|---|
| Dashboard | Overview stats, recent activity, sync status |
| Students | Register students, search, edit, delete |
| Attendance | Daily mark (Present/Absent/Late), history, class filter |
| Exam Grades | Enter CA + Exam scores, auto grade (A1–F9), class average |
| Fee Payments | Record payments, track collection rate, receipts |
| Teachers | Staff profiles, subjects, qualifications |
| Reports | Attendance, grade & fee reports by class, CSV export |
| Notifications | Quick alerts (exam, fee, absence), notification log |
| Settings | School info, Google Sheets URL, data export |

---

## Setup

### 1. Run the app locally
```bash
python -m http.server 8000
# Open http://localhost:8000
```

### 2. Setup Google Sheets sync (optional)
1. Go to https://script.google.com → New Project
2. Paste contents of `google-apps-script.js`
3. Click **Deploy → New Deployment**
4. Type: **Web App**
5. Execute as: **Me**
6. Who has access: **Anyone**
7. Click **Deploy** and copy the URL
8. In the app, go to **Settings → Google Sheets Sync** and paste the URL

### 3. Install on phone (PWA)
- Serve from a real server (localhost or hosting)
- Open in Chrome on Android → tap "Add to Home Screen"
- App works fully offline after first load

---

## Offline Use
- All data stored in IndexedDB (browser local storage)
- Works completely offline — add students, mark attendance, record grades
- Auto-syncs to Google Sheets when back online
- Manual sync via the **↑↓ Sync** button in the top bar
