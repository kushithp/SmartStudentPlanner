/* Smart Student Study Planner - vanilla JavaScript, no libraries.
   Sections: 1 Config, 2 Helpers, 3 Storage, 4 Data cleaning, 5 Tasks, 6 Exams,
   7 Filtering, 8 Rendering, 9 Timer, 10 Backup, 11 Dialogs/events, 12 Start-up */
(function () {
  'use strict';

  /* ===== 1. Config ===== */
  const STORAGE_KEY = 'smartStudyPlanner.v1';
  const BACKUP_VERSION = 1;
  // To add a subject, just add its name to this list.
  const SUBJECTS = ['Mathematics', 'Computer Science', 'Physics', 'English', 'Other'];
  const PRIORITIES = ['Low', 'Medium', 'High'];
  const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3 };
  const DEFAULT_SETTINGS = { name: 'Student', theme: 'light', focus: 25, short: 5, long: 15 };
  const MODE_LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };

  let state = { tasks: [], exams: [], settings: Object.assign({}, DEFAULT_SETTINGS) };
  let storageAvailable = true;
  const ui = { nav: 'dashboard', filters: { search: '', status: 'all', subject: 'all', priority: 'all', sort: 'date' } };

  /* ===== 2. Helpers ===== */
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const toDateStr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayStr = () => toDateStr(new Date());
  const parseDate = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toDateStr(parseDate(s)) === s;
  const isTimeStr = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const daysUntil = (s) => Math.round((parseDate(s) - parseDate(todayStr())) / 86400000);
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  const clampInt = (v, min, max, fallback) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : fallback; };
  const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  function formatDate(s) {
    const d = daysUntil(s);
    if (d === 0) return 'Today';
    if (d === 1) return 'Tomorrow';
    if (d === -1) return 'Yesterday';
    return parseDate(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // Safe element builder: text is always set with textContent, never innerHTML.
  function el(tag, opts, children) {
    const n = document.createElement(tag);
    Object.keys(opts || {}).forEach((k) => {
      const v = opts[k];
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'checked') n.checked = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v);
    });
    (children || []).forEach((c) => c && n.appendChild(c));
    return n;
  }

  function toast(message, type) {
    const t = el('div', { class: 'toast' + (type === 'error' ? ' error' : ''), text: message });
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function confirmBox(title, text, okLabel) {
    return new Promise((resolve) => {
      const dlg = $('confirmDialog');
      $('confirmTitle').textContent = title;
      $('confirmText').textContent = text;
      $('confirmOk').textContent = okLabel || 'Confirm';
      dlg.returnValue = '';
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
      dlg.showModal();
    });
  }

  /* ===== 3. Storage ===== */
  function showStorageBanner() {
    const b = $('storageBanner');
    b.textContent = 'Browser storage is unavailable, so changes will be lost when you close this page. Export a backup from Settings to keep your work.';
    b.hidden = false;
  }

  function save() {
    if (!storageAvailable) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { storageAvailable = false; showStorageBanner(); }
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); }
    catch (e) { storageAvailable = false; showStorageBanner(); }
    if (raw === null) { seedSampleData(); save(); return; } // first launch only
    try { state = sanitizeData(JSON.parse(raw)).data; }
    catch (e) {
      seedSampleData();
      toast('Saved data was unreadable, so sample data was loaded.', 'error');
    }
  }

  /* ===== 4. Data cleaning (used for localStorage and imports) ===== */
  function cleanTask(t) {
    if (!t || typeof t !== 'object') return null;
    const title = cleanText(t.title, 120);
    if (!title || !isDateStr(t.date)) return null;
    return {
      id: typeof t.id === 'string' && t.id ? t.id : uid(),
      title: title,
      description: cleanText(t.description, 400),
      subject: SUBJECTS.includes(t.subject) ? t.subject : 'Other',
      date: t.date,
      time: isTimeStr(t.time) ? t.time : '',
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'Medium',
      duration: clampInt(t.duration, 1, 600, 30),
      completed: t.completed === true,
      createdAt: Number.isFinite(t.createdAt) ? t.createdAt : Date.now()
    };
  }

  function cleanExam(e) {
    if (!e || typeof e !== 'object') return null;
    const name = cleanText(e.name, 80);
    if (!name || !isDateStr(e.date)) return null;
    return { id: typeof e.id === 'string' && e.id ? e.id : uid(), name: name, date: e.date };
  }

  function cleanSettings(s) {
    s = s && typeof s === 'object' ? s : {};
    return {
      name: cleanText(s.name, 30) || DEFAULT_SETTINGS.name,
      theme: s.theme === 'dark' ? 'dark' : 'light',
      focus: clampInt(s.focus, 1, 120, 25),
      short: clampInt(s.short, 1, 60, 5),
      long: clampInt(s.long, 1, 120, 15)
    };
  }

  // Throws if the structure is wrong; skips individual bad items and counts them.
  function sanitizeData(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Not a planner data object');
    if (!Array.isArray(obj.tasks)) throw new Error('Missing task list');
    if (obj.exams !== undefined && !Array.isArray(obj.exams)) throw new Error('Invalid exam list');
    const tasks = obj.tasks.map(cleanTask).filter(Boolean);
    const exams = (obj.exams || []).map(cleanExam).filter(Boolean);
    const skipped = obj.tasks.length - tasks.length + (obj.exams || []).length - exams.length;
    return { data: { tasks: tasks, exams: exams, settings: cleanSettings(obj.settings) }, skipped: skipped };
  }

  function seedSampleData() {
    const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return toDateStr(d); };
    const mk = (title, description, subject, offset, time, priority, duration, completed) =>
      ({ id: uid(), title, description, subject, date: day(offset), time, priority, duration, completed: !!completed, createdAt: Date.now() + state.tasks.length });
    const keep = state.settings;
    state = { tasks: [], exams: [], settings: Object.assign({}, DEFAULT_SETTINGS, { theme: keep.theme, name: keep.name }) };
    state.tasks.push(
      mk('Revise calculus integration', 'Integration by parts and substitution, chapter 6 problems.', 'Mathematics', 0, '18:00', 'High', 60),
      mk('Complete JavaScript DOM exercises', 'Event listeners and form validation practice.', 'Computer Science', 0, '20:00', 'Medium', 45),
      mk('Read the next physics chapter', 'Chapter on electromagnetic induction.', 'Physics', 1, '', 'Low', 40),
      mk('Prepare English assignment notes', 'Outline the essay and collect three quotations.', 'English', 2, '17:30', 'Medium', 50),
      mk('Submit physics lab report', 'Add the results table and error analysis.', 'Physics', -1, '23:00', 'High', 30),
      mk('Solve past paper questions', 'Section B of last year\'s mathematics paper.', 'Mathematics', -2, '', 'High', 90, true)
    );
    state.exams.push(
      { id: uid(), name: 'Mathematics mid-semester exam', date: day(12) },
      { id: uid(), name: 'Web development practical', date: day(21) }
    );
  }

  /* ===== 5. Task logic ===== */
  const findTask = (id) => state.tasks.find((t) => t.id === id);

  function isOverdue(t) {
    if (t.completed) return false;
    const today = todayStr();
    if (t.date < today) return true;
    if (t.date === today && t.time) { const n = new Date(); return t.time < pad(n.getHours()) + ':' + pad(n.getMinutes()); }
    return false;
  }

  function toggleTask(id) {
    const t = findTask(id); if (!t) return;
    t.completed = !t.completed; save(); renderAll();
    toast(t.completed ? 'Marked "' + t.title + '" as completed.' : 'Moved "' + t.title + '" back to pending.');
  }

  async function deleteTask(id) {
    const t = findTask(id); if (!t) return;
    if (!(await confirmBox('Delete task?', '"' + t.title + '" will be removed permanently.', 'Delete task'))) return;
    state.tasks = state.tasks.filter((x) => x.id !== id); save(); renderAll(); toast('Task deleted.');
  }

  /* ===== 6. Exam logic ===== */
  async function deleteExam(id) {
    const e = state.exams.find((x) => x.id === id); if (!e) return;
    if (!(await confirmBox('Delete examination?', '"' + e.name + '" will be removed.', 'Delete'))) return;
    state.exams = state.exams.filter((x) => x.id !== id); save(); renderAll(); toast('Examination deleted.');
  }

  /* ===== 7. Search, filters, sorting (all applied together) ===== */
  function getVisibleTasks() {
    const f = ui.filters, q = f.search.trim().toLowerCase(), today = todayStr();
    const list = state.tasks.filter((t) => {
      if (q && !(t.title + ' ' + t.description + ' ' + t.subject).toLowerCase().includes(q)) return false;
      if (f.subject !== 'all' && t.subject !== f.subject) return false;
      if (f.priority !== 'all' && t.priority !== f.priority) return false;
      switch (f.status) {
        case 'today': return t.date === today;
        case 'upcoming': return t.date > today && !t.completed;
        case 'completed': return t.completed;
        case 'pending': return !t.completed;
        case 'overdue': return isOverdue(t);
        default: return true;
      }
    });
    const byDate = (a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99'));
    if (f.sort === 'priority') list.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || byDate(a, b));
    else if (f.sort === 'created') list.sort((a, b) => b.createdAt - a.createdAt);
    else list.sort(byDate);
    return list;
  }

  const filtersAreDefault = () => { const f = ui.filters; return !f.search.trim() && f.status === 'all' && f.subject === 'all' && f.priority === 'all' && f.sort === 'date'; };

  /* ===== 8. Rendering ===== */
  function taskItem(t) {
    const subjIndex = Math.max(0, SUBJECTS.indexOf(t.subject)) % 5;
    const meta = el('div', { class: 'meta' }, [
      el('span', { class: 'chip s' + subjIndex, text: t.subject }),
      el('span', { class: 'chip ' + t.priority.toLowerCase(), text: t.priority + ' priority' }),
      el('span', { text: formatDate(t.date) + (t.time ? ' at ' + t.time : '') }),
      el('span', { text: t.duration + ' min' }),
      isOverdue(t) ? el('span', { class: 'tag-over', text: 'Overdue' }) : null
    ]);
    return el('li', { class: 'task' + (t.completed ? ' done' : ''), dataset: { id: t.id } }, [
      el('input', { type: 'checkbox', checked: t.completed, 'aria-label': 'Mark "' + t.title + '" as ' + (t.completed ? 'pending' : 'completed'), dataset: { action: 'toggle' } }),
      el('div', {}, [el('div', { class: 'task-title', text: t.title }), t.description ? el('div', { class: 'task-desc', text: t.description }) : null, meta]),
      el('div', { class: 'task-actions' }, [
        el('button', { type: 'button', class: 'btn sm', text: 'Edit', dataset: { action: 'edit' }, 'aria-label': 'Edit ' + t.title }),
        el('button', { type: 'button', class: 'btn sm ghost', text: 'Delete', dataset: { action: 'delete' }, 'aria-label': 'Delete ' + t.title })
      ])
    ]);
  }

  const emptyBox = (title, hint) => el('div', { class: 'empty' }, [el('strong', { text: title }), el('p', { text: hint })]);

  function renderStats() {
    const total = state.tasks.length, done = state.tasks.filter((t) => t.completed).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('statTotal').textContent = total; $('statDone').textContent = done; $('statPending').textContent = total - done;
    $('statPercent').textContent = pct + '%'; $('overallFill').style.strokeDashoffset = 100 - pct;
    $('overallBar').setAttribute('aria-valuenow', pct);
  }

  function renderAgenda() {
    const today = todayStr();
    const items = state.tasks.filter((t) => t.date === today).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    const list = $('agendaList'); list.replaceChildren();
    const mins = items.filter((t) => !t.completed).reduce((s, t) => s + t.duration, 0);
    $('agendaSummary').textContent = items.length ? items.filter((t) => !t.completed).length + ' left, about ' + mins + ' min' : '';
    if (!items.length) { list.appendChild(el('li', {}, [emptyBox('Nothing planned for today', 'Use "Add task" to schedule a study session.')])); return; }
    items.forEach((t) => list.appendChild(taskItem(t)));
  }

  function renderTaskGroups() {
    const box = $('taskGroups'); box.replaceChildren();
    const list = getVisibleTasks();
    const labels = { all: 'All tasks', today: 'Today', upcoming: 'Upcoming', pending: 'Pending', completed: 'Completed', overdue: 'Overdue' };
    const f = ui.filters, parts = [labels[f.status]];
    if (f.subject !== 'all') parts.push(f.subject);
    if (f.priority !== 'all') parts.push(f.priority + ' priority');
    if (f.search.trim()) parts.push('search "' + f.search.trim() + '"');
    $('filterSummary').textContent = 'Showing ' + list.length + ' of ' + state.tasks.length + ' tasks: ' + parts.join(', ');
    $('resetFilters').disabled = filtersAreDefault();
    if (!list.length) {
      box.appendChild(state.tasks.length
        ? emptyBox('No tasks match', 'Try a different search or reset the filters.')
        : emptyBox('No tasks yet', 'Click "Add task" to plan your first study session.'));
      return;
    }
    const addGroup = (title, items) => {
      if (!items.length) return;
      box.appendChild(el('h3', { text: title + ' (' + items.length + ')' }));
      const ul = el('ul', { class: 'task-list' }); items.forEach((t) => ul.appendChild(taskItem(t))); box.appendChild(ul);
    };
    addGroup('Pending', list.filter((t) => !t.completed));
    addGroup('Completed', list.filter((t) => t.completed));
  }

  function examRow(e, allowEdit) {
    const d = daysUntil(e.date);
    const text = d === 0 ? 'Today' : Math.abs(d);
    const unit = d === 0 ? '' : (Math.abs(d) === 1 ? 'day' : 'days') + (d < 0 ? ' ago' : ' left');
    return el('li', { class: 'exam' + (d < 0 ? ' past' : ''), dataset: { id: e.id } }, [
      el('div', {}, [el('strong', { text: e.name }), el('div', { class: 'small muted', text: parseDate(e.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (d < 0 ? ' (finished)' : '') }),
        allowEdit ? el('div', { class: 'task-actions' }, [
          el('button', { type: 'button', class: 'btn sm', text: 'Edit', dataset: { action: 'edit-exam' }, 'aria-label': 'Edit ' + e.name }),
          el('button', { type: 'button', class: 'btn sm ghost', text: 'Delete', dataset: { action: 'delete-exam' }, 'aria-label': 'Delete ' + e.name })]) : null]),
      el('div', { class: 'exam-days' }, [document.createTextNode(String(text)), el('small', { text: unit })])
    ]);
  }

  function renderExams() {
    const sorted = state.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
    const mini = $('examMini'), full = $('examList'); mini.replaceChildren(); full.replaceChildren();
    const upcoming = sorted.filter((e) => daysUntil(e.date) >= 0).slice(0, 3);
    if (!upcoming.length) mini.appendChild(el('li', {}, [emptyBox('No upcoming examinations', 'Add one from the Examinations page.')]));
    upcoming.forEach((e) => mini.appendChild(examRow(e, false)));
    if (!sorted.length) full.appendChild(el('li', {}, [emptyBox('No examinations added', 'Add an exam or deadline to see a live countdown.')]));
    sorted.forEach((e) => full.appendChild(examRow(e, true)));
  }

  function renderHeader() {
    const h = new Date().getHours();
    $('greeting').textContent = (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ', ' + state.settings.name;
    const left = state.tasks.filter((t) => t.date === todayStr() && !t.completed).length;
    $('subtitle').textContent = left ? 'You have ' + left + (left === 1 ? ' task' : ' tasks') + ' left to finish today.' : 'Nothing left on today\'s plan. Add a task or take a break.';
    $('today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function fillSelect(select, options, withAll, allLabel) {
    const current = select.value; select.replaceChildren();
    if (withAll) select.appendChild(el('option', { value: 'all', text: allLabel }));
    options.forEach((o) => select.appendChild(el('option', { value: o, text: o })));
    if (current && Array.from(select.options).some((o) => o.value === current)) select.value = current;
  }

  function renderTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    $('themeToggle').textContent = state.settings.theme === 'dark' ? 'Light theme' : 'Dark theme';
  }

  function renderNav() {
    document.querySelectorAll('#nav button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.nav === ui.nav));
    document.querySelectorAll('#nav button[aria-current]').forEach((b) => b.setAttribute('aria-current', 'page'));
    const view = { today: 'tasks', upcoming: 'tasks', timer: 'dashboard', backup: 'settings' }[ui.nav] || ui.nav;
    ['dashboard', 'tasks', 'exams', 'settings'].forEach((v) => { $('view-' + v).hidden = v !== view; });
    $('tasksHeading').textContent = ui.nav === 'today' ? "Today's plan" : ui.nav === 'upcoming' ? 'Upcoming tasks' : 'My tasks';
    $('fStatus').value = ui.filters.status;
  }

  function renderAll() {
    renderTheme(); renderHeader(); renderStats(); renderAgenda(); renderTaskGroups(); renderExams(); renderNav(); renderTimer();
  }

  function closeMenu() { $('sidebar').classList.remove('open'); $('menuBtn').setAttribute('aria-expanded', 'false'); }

  function goTo(key) {
    if (key === 'today' || key === 'upcoming') ui.filters.status = key;
    if (key === 'tasks') ui.filters.status = 'all';
    ui.nav = key; renderAll(); closeMenu();
    const target = key === 'timer' ? $('timerPanel') : key === 'backup' ? $('backupPanel') : null;
    if (target) { target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); } else window.scrollTo(0, 0);
  }

  /* ===== 9. Focus timer (end time based, so late browser timers stay accurate) ===== */
  const timer = { mode: 'focus', total: 0, remaining: 0, endAt: 0, running: false, intervalId: null, message: '' };

  function stopInterval() { if (timer.intervalId !== null) { clearInterval(timer.intervalId); timer.intervalId = null; } }

  function setTimerMode(mode) {
    stopInterval(); timer.mode = mode; timer.running = false; timer.message = '';
    timer.total = state.settings[mode] * 60000; timer.remaining = timer.total; renderTimer();
  }

  function startTimer() {
    if (timer.running || timer.remaining <= 0) return;
    stopInterval(); timer.running = true; timer.message = '';
    timer.endAt = Date.now() + timer.remaining;
    timer.intervalId = setInterval(tickTimer, 250); renderTimer();
  }

  function pauseTimer() {
    if (!timer.running) return;
    timer.remaining = Math.max(0, timer.endAt - Date.now());
    stopInterval(); timer.running = false; renderTimer();
  }

  function tickTimer() {
    timer.remaining = Math.max(0, timer.endAt - Date.now());
    if (timer.remaining === 0) finishTimer();
    renderTimer();
  }

  function finishTimer() {
    stopInterval(); timer.running = false;
    timer.message = timer.mode === 'focus' ? 'Focus session complete. Time for a break.' : 'Break finished. Ready to focus?';
    toast(timer.message);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Study Planner', { body: timer.message }); } catch (e) { /* fallback is the on-page message */ }
    }
  }

  function renderTimer() {
    const secs = Math.ceil(timer.remaining / 1000), text = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
    $('timerDisplay').textContent = text;
    const pct = timer.total ? Math.round((1 - timer.remaining / timer.total) * 100) : 0;
    $('timerFill').style.strokeDashoffset = 100 - pct; $('timerModeLabel').textContent = MODE_LABELS[timer.mode] + (timer.running ? ' (running)' : ''); $('timerBar').setAttribute('aria-valuenow', pct);
    $('timerStart').disabled = timer.running || timer.remaining <= 0;
    $('timerStart').textContent = timer.remaining < timer.total && timer.remaining > 0 ? 'Resume' : 'Start';
    $('timerPause').disabled = !timer.running;
    $('timerMsg').textContent = timer.message;
    document.querySelectorAll('#timerModes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === timer.mode)));
    document.title = timer.running ? text + ' ' + MODE_LABELS[timer.mode] + ' | Study Planner' : 'Smart Student Study Planner';
  }

  /* ===== 10. Backup and restore ===== */
  function exportBackup() {
    const payload = { app: 'Smart Student Study Planner', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tasks: state.tasks, exams: state.exams, settings: state.settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'study-planner-backup-' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup downloaded.');
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => toast('The file could not be read.', 'error');
    reader.onload = async () => {
      let parsed, result;
      try { parsed = JSON.parse(reader.result); } catch (e) { toast('That file is not valid JSON, so nothing was changed.', 'error'); return; }
      try {
        if (!parsed || typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) throw new Error('Unsupported backup version');
        result = sanitizeData(parsed);
      } catch (e) { toast('This is not a Study Planner backup file (' + e.message + '). Nothing was changed.', 'error'); return; }
      const d = result.data;
      const ok = await confirmBox('Replace current data?', 'This will replace your ' + state.tasks.length + ' tasks and ' + state.exams.length + ' examinations with ' + d.tasks.length + ' tasks and ' + d.exams.length + ' examinations from the backup.', 'Replace data');
      if (!ok) { toast('Import cancelled. Your data is unchanged.'); return; }
      state = d; save(); setTimerMode(timer.mode); renderAll();
      toast('Backup restored.' + (result.skipped ? ' ' + result.skipped + ' invalid item(s) were skipped.' : ''));
    };
    reader.readAsText(file);
  }

  /* ===== 11. Dialogs and events ===== */
  function setError(inputId, errId, msg) {
    $(errId).textContent = msg; $(inputId).parentElement.classList.toggle('invalid', !!msg);
    $(inputId).setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) $(inputId).setAttribute('aria-describedby', errId);
  }

  function openTaskDialog(id) {
    const t = id ? findTask(id) : null;
    $('taskDialogTitle').textContent = t ? 'Edit task' : 'Add task';
    $('taskId').value = t ? t.id : '';
    $('tTitle').value = t ? t.title : ''; $('tDesc').value = t ? t.description : '';
    $('tSubject').value = t ? t.subject : SUBJECTS[0]; $('tPriority').value = t ? t.priority : 'Medium';
    $('tDate').value = t ? t.date : todayStr(); $('tTime').value = t ? t.time : ''; $('tDuration').value = t ? t.duration : 30;
    ['Title:errTitle', 'Date:errDate', 'Duration:errDuration'].forEach((p) => { const a = p.split(':'); setError('t' + a[0], a[1], ''); });
    $('taskDialog').showModal(); $('tTitle').focus();
  }

  function submitTask(ev) {
    ev.preventDefault();
    const title = $('tTitle').value.trim(), date = $('tDate').value, duration = Number($('tDuration').value);
    const eTitle = !title ? 'Enter a task title.' : '';
    const eDate = !isDateStr(date) ? 'Choose a valid study date.' : '';
    const eDur = !(Number.isInteger(duration) && duration >= 1 && duration <= 600) ? 'Enter whole minutes between 1 and 600.' : '';
    setError('tTitle', 'errTitle', eTitle); setError('tDate', 'errDate', eDate); setError('tDuration', 'errDuration', eDur);
    if (eTitle || eDate || eDur) { toast('Please fix the highlighted fields.', 'error'); return; }
    const data = { title: title, description: $('tDesc').value.trim(), subject: $('tSubject').value, priority: $('tPriority').value, date: date, time: $('tTime').value, duration: duration };
    const id = $('taskId').value, existing = id ? findTask(id) : null;
    if (existing) { Object.assign(existing, data); toast('Task updated.'); }
    else { state.tasks.push(Object.assign({ id: uid(), completed: false, createdAt: Date.now() }, data)); toast('Task added.'); }
    save(); $('taskDialog').close(); renderAll();
  }

  function openExamDialog(id) {
    const e = id ? state.exams.find((x) => x.id === id) : null;
    $('examDialogTitle').textContent = e ? 'Edit examination' : 'Add examination';
    $('examId').value = e ? e.id : ''; $('eName').value = e ? e.name : ''; $('eDate').value = e ? e.date : '';
    setError('eName', 'errEName', ''); setError('eDate', 'errEDate', '');
    $('examDialog').showModal(); $('eName').focus();
  }

  function submitExam(ev) {
    ev.preventDefault();
    const name = $('eName').value.trim(), date = $('eDate').value;
    const en = name ? '' : 'Enter a name for the examination.', ed = isDateStr(date) ? '' : 'Choose a valid date.';
    setError('eName', 'errEName', en); setError('eDate', 'errEDate', ed);
    if (en || ed) { toast('Please fix the highlighted fields.', 'error'); return; }
    const id = $('examId').value, existing = state.exams.find((x) => x.id === id);
    if (existing) { existing.name = name; existing.date = date; toast('Examination updated.'); }
    else { state.exams.push({ id: uid(), name: name, date: date }); toast('Examination added.'); }
    save(); $('examDialog').close(); renderAll();
  }

  function submitSettings(ev) {
    ev.preventDefault();
    const vals = { focus: Number($('setFocus').value), short: Number($('setShort').value), long: Number($('setLong').value) };
    const bad = Object.keys(vals).some((k) => !Number.isInteger(vals[k]) || vals[k] < 1 || vals[k] > 120);
    $('settingsErr').textContent = bad ? 'Timer lengths must be whole minutes from 1 to 120.' : '';
    if (bad) return;
    state.settings = Object.assign(state.settings, vals, { name: $('setName').value.trim().slice(0, 30) || DEFAULT_SETTINGS.name });
    save(); if (!timer.running) setTimerMode(timer.mode); renderAll(); toast('Settings saved.');
  }

  function fillSettingsForm() {
    const s = state.settings; $('setName').value = s.name; $('setFocus').value = s.focus; $('setShort').value = s.short; $('setLong').value = s.long;
  }

  function bindEvents() {
    // Navigation (sidebar and any "Manage" links)
    document.addEventListener('click', (ev) => { const n = ev.target.closest('[data-nav]'); if (n) goTo(n.dataset.nav); });
    $('themeToggle').addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; save(); renderTheme(); });

    // Task list actions (event delegation on the whole page)
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-action]'); if (!btn || btn.type === 'checkbox') return;
      const row = btn.closest('[data-id]'); if (!row) return;
      const a = btn.dataset.action;
      if (a === 'edit') openTaskDialog(row.dataset.id);
      else if (a === 'delete') deleteTask(row.dataset.id);
      else if (a === 'edit-exam') openExamDialog(row.dataset.id);
      else if (a === 'delete-exam') deleteExam(row.dataset.id);
    });
    document.addEventListener('change', (ev) => { if (ev.target.dataset && ev.target.dataset.action === 'toggle') toggleTask(ev.target.closest('[data-id]').dataset.id); });

    // Search and filters
    $('searchInput').addEventListener('input', (ev) => { ui.filters.search = ev.target.value; if (!['tasks', 'today', 'upcoming'].includes(ui.nav)) ui.nav = 'tasks'; renderAll(); });
    [['fStatus', 'status'], ['fSubject', 'subject'], ['fPriority', 'priority'], ['fSort', 'sort']].forEach((p) => {
      $(p[0]).addEventListener('change', (ev) => {
        ui.filters[p[1]] = ev.target.value;
        if (p[1] === 'status') ui.nav = ['today', 'upcoming'].includes(ev.target.value) ? ev.target.value : 'tasks';
        renderAll();
      });
    });
    $('resetFilters').addEventListener('click', () => { ui.filters = { search: '', status: 'all', subject: 'all', priority: 'all', sort: 'date' }; $('searchInput').value = ''; ui.nav = 'tasks'; ['fSubject', 'fPriority', 'fSort'].forEach((i) => { $(i).selectedIndex = 0; }); renderAll(); });

    // Dialogs
    $('addTaskBtn').addEventListener('click', () => openTaskDialog());
    $('addTaskBtn2').addEventListener('click', () => openTaskDialog());
    $('menuBtn').addEventListener('click', () => { const open = $('sidebar').classList.toggle('open'); $('menuBtn').setAttribute('aria-expanded', String(open)); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeMenu(); });
    $('addExamBtn').addEventListener('click', () => openExamDialog());
    $('taskForm').addEventListener('submit', submitTask);
    $('examForm').addEventListener('submit', submitExam);
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

    // Timer
    $('timerStart').addEventListener('click', startTimer);
    $('timerPause').addEventListener('click', pauseTimer);
    $('timerReset').addEventListener('click', () => setTimerMode(timer.mode));
    $('timerModes').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-mode]'); if (b) setTimerMode(b.dataset.mode); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && timer.running) tickTimer(); });

    // Settings, backup, data
    $('settingsForm').addEventListener('submit', submitSettings);
    $('notifyBtn').addEventListener('click', () => {
      if (!('Notification' in window)) { toast('This browser does not support notifications. The timer will show an on-page message instead.', 'error'); return; }
      Notification.requestPermission().then((p) => toast(p === 'granted' ? 'Timer alerts enabled.' : 'Alerts not enabled. You will still see on-page messages.', p === 'granted' ? '' : 'error'));
    });
    $('exportBtn').addEventListener('click', exportBackup);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', (ev) => { importBackup(ev.target.files[0]); ev.target.value = ''; });
    $('sampleBtn').addEventListener('click', async () => {
      if (!(await confirmBox('Reset to sample data?', 'Your current tasks and examinations will be replaced by the sample set.', 'Replace with samples'))) return;
      seedSampleData(); save(); fillSettingsForm(); renderAll(); toast('Sample data restored.');
    });
    $('clearBtn').addEventListener('click', async () => {
      if (!(await confirmBox('Delete all data?', 'All tasks and examinations will be removed. Consider exporting a backup first.', 'Delete everything'))) return;
      state.tasks = []; state.exams = []; save(); renderAll(); toast('All tasks and examinations deleted.');
    });
    window.addEventListener('beforeunload', stopInterval);
  }

  /* ===== 12. Start-up ===== */
  function init() {
    load();
    fillSelect($('tSubject'), SUBJECTS, false);
    fillSelect($('fSubject'), SUBJECTS, true, 'All subjects');
    fillSettingsForm(); bindEvents(); setTimerMode('focus'); renderAll();
    setInterval(() => { renderHeader(); renderAgenda(); renderTaskGroups(); renderExams(); }, 60000); // keep date-based values fresh
  }
  document.addEventListener('DOMContentLoaded', init);
})();
