SMART STUDENT STUDY PLANNER (interface name: StudyFlow)
Design and Development of an Interactive Web Page Using HTML, CSS, and JavaScript

1. OBJECTIVE
A single-page web app that helps a student plan daily study tasks, track
progress, count down to examinations and stay focused with a Pomodoro timer.

2. FEATURES
- Dashboard: welcome, current date, total/completed/pending counts, completion
  percentage with progress bar, today's agenda, upcoming exams, focus timer. All values are calculated from the saved data.
- Tasks: add, edit, delete (with confirmation), complete/uncomplete; title,
  description, subject, date, due time, priority and estimated minutes.
  Overdue tasks are marked. Pending and completed tasks are listed separately.
- Subjects: Mathematics, Computer Science, Physics, English, Other. To add one,
  edit the SUBJECTS array at the top of script.js.
- Search (title, description, subject) that works together with filters
  (All, Today, Upcoming, Pending, Completed, Overdue, Subject, Priority) and
  sorting (date, priority, newest added). "Reset filters" clears everything.
- Focus timer: 25 / 5 / 15 minute modes (changeable in Settings), Start, Pause,
  Resume, Reset, progress bar and finish message (optional browser notification).
- Examination countdown: add, edit, delete; days remaining; past dates handled.
- Modern Minimal interface: white surfaces, green accent, circular timer and
  completion rings, priority badges, side navigation with icons.
- Light and dark theme, saved in the browser.
- Backup: export to JSON and import from JSON with validation and a warning.
- Responsive layout: sidebar on desktop, slide-in menu (Menu button) on tablets and phones.

3. TECHNOLOGIES
HTML5, CSS3 and vanilla JavaScript only. No frameworks, libraries, backend,
database, build tools or internet connection are needed.

4. FILE STRUCTURE
Smart-Student-Study-Planner/
  index.html   page structure (semantic HTML, dialogs, forms)
  style.css    styling, CSS variables, themes, responsive rules
  script.js    all application logic
  README.txt   this file

5. HOW TO RUN
Option A: double-click index.html (or drag it into Chrome, Edge or Firefox).
Option B (Visual Studio Code): File > Open Folder, choose
Smart-Student-Study-Planner, open index.html and run it from the Explorer by
right-click > "Reveal in File Explorer" and opening it in a browser. If you
have the "Live Server" extension, right-click index.html > "Open with Live
Server". Live Server is optional; no installation is required for the project.

6. HOW LOCALSTORAGE WORKS
Tasks, examinations, theme and settings are saved with localStorage under the
key "smartStudyPlanner.v1". The data stays in the CURRENT browser on THIS
computer. It is not cloud synchronisation: another browser or device will not
see it, and clearing site data removes it. Sample tasks load only on the very
first launch; if you delete everything, the planner stays empty. Use
Settings > "Reset to sample data" to bring the samples back.
If storage is blocked (for example some private modes) a warning is shown and
the app still works until the page is closed.

7. BACKUP AND RESTORE
Settings > Export backup downloads study-planner-backup-YYYY-MM-DD.json
(version number, export time, tasks, exams, timer settings, theme, display name).
Settings > Import backup lets you pick such a file. It is validated first,
invalid files are rejected without changes, and you must confirm before your
current data is replaced.

8. IMPLEMENTATION NOTES
- State lives in one object; every change calls save() then renderAll().
- User text is inserted with textContent (no unsafe innerHTML), no eval().
- The timer stores an end timestamp and recalculates remaining time on every
  tick, so it stays accurate if the browser delays timers or the tab sleeps.
  Only one interval can exist at a time.
- Event delegation handles Edit/Delete/checkbox buttons in task lists.
- Dates are handled as local YYYY-MM-DD strings to avoid time-zone errors.

9. KNOWN LIMITATIONS
- Needs a modern browser (uses <dialog>, Blob, FileReader, localStorage).
- Notifications need permission and may be blocked when opening the file
  directly from disk in some browsers; an on-page message always appears.
- Data is not shared between browsers or devices; use export/import.
