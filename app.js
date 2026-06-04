// app.js – Task Manager core logic

// ==== Utility Functions ====
function generateId() {
  // Simple UUID‑like generator
  return '_' + Math.random().toString(36).substr(2, 9);
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// ==== Task Model ====
class Task {
  constructor({ id = generateId(), title, parentId = null, order = 0, recurrence = { type: 'none', interval: 1 }, completedDate = null, createdAt = new Date().toISOString(), reminderEnabled = false, reminderTime = null, lastRemindedDate = null, targetDate = null, isCollapsed = false }) {
    this.id = id;
    this.title = title;
    this.parentId = parentId;
    this.order = order;
    this.recurrence = recurrence;
    this.completedDate = completedDate;
    this.createdAt = createdAt;
    this.reminderEnabled = reminderEnabled;
    this.reminderTime = reminderTime;
    this.lastRemindedDate = lastRemindedDate;
    
    // Set initial targetDate if not provided
    if (!targetDate) {
      if (recurrence.type === 'none') {
        this.targetDate = formatDate(new Date());
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.targetDate = formatDate(getNextDateForRule(yesterday, recurrence));
      }
    } else {
      this.targetDate = targetDate;
    }
    
    this.isCollapsed = isCollapsed;
  }
}

// ==== Storage Layer ====
const STORAGE_KEY = 'task_manager_data';

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    const raw = JSON.parse(data);
    return raw.map(o => new Task(o));
  } catch (e) {
    console.error('Failed to parse tasks from storage', e);
    return [];
  }
}

let tasks = loadTasks();

// ==== Recurrence Logic ====
function getNextDateForRule(lastDateObj, rule) {
  let next = new Date(lastDateObj);
  next.setDate(next.getDate() + 1);

  let iterations = 0;
  while (iterations < 400) {
    if (rule.type === 'daily') {
      break;
    } else if (rule.type === 'weekly') {
      if (next.getDay() === parseInt(rule.dayOfWeek)) break;
    } else if (rule.type === 'monthly') {
      if (next.getDate() === parseInt(rule.dayOfMonth)) break;
    } else if (rule.type === 'half-yearly') {
      if (next.getDate() === parseInt(rule.dayOfMonth) && (next.getMonth() % 6) === parseInt(rule.monthOffset)) break;
    } else {
      break;
    }
    next.setDate(next.getDate() + 1);
    iterations++;
  }
  return next;
}

function recycleCompletedTasks() {
  let changed = false;
  const today = new Date();
  const todayStr = formatDate(today);

  tasks.forEach(task => {
    // If it's a completed recurring task, and today is strictly AFTER its completed date
    if (task.completedDate && task.recurrence.type !== 'none') {
      const compDateStr = formatDate(new Date(task.completedDate));
      if (todayStr > compDateStr) {
        // Recycle: clear completion, advance target date
        task.targetDate = formatDate(getNextDateForRule(new Date(task.completedDate), task.recurrence));
        task.completedDate = null;
        task.lastRemindedDate = null;
        changed = true;
      }
    }
  });

  if (changed) {
    saveTasks(tasks);
  }
}

// ==== Helper: check if task has children ====
function hasChildren(taskId) {
  return tasks.some(t => t.parentId === taskId);
}

// ==== Helper: check if all children are completed today ====
function allChildrenCompletedToday(taskId) {
  const children = tasks.filter(t => t.parentId === taskId);
  if (children.length === 0) return false;
  return children.every(c => c.completedDate && isToday(c.completedDate));
}

// ==== Helper: update parent completion based on children ====
function syncParentCompletion(parentId) {
  if (!parentId) return;
  const parent = tasks.find(t => t.id === parentId);
  if (!parent) return;
  if (allChildrenCompletedToday(parentId)) {
    parent.completedDate = new Date().toISOString();
  } else {
    parent.completedDate = null;
  }
}

// ==== Helper: days left ====
function getDaysLeft(targetDateStr) {
  if (!targetDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  const diff = target - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ==== Rendering ====
function buildTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task-item';
  if (task.parentId) li.classList.add('subtask');
  li.dataset.id = task.id;

  const daysLeft = getDaysLeft(task.targetDate);
  const hasKids = hasChildren(task.id);

  let isActive = daysLeft <= 0 || task.recurrence.type === 'none';

  if (hasKids) {
    // Parent tasks act as folders. They have no active/inactive state of their own.
    li.classList.remove('active', 'inactive');
  } else {
    if (isActive) {
      li.classList.add('active');
    } else {
      li.classList.add('inactive');
    }
  }

  const rowDiv = document.createElement('div');
  rowDiv.className = 'task-row';

  // Toggle fold on row click
  if (hasKids) {
    rowDiv.style.cursor = 'pointer';
    rowDiv.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
      task.isCollapsed = !task.isCollapsed;
      saveTasks(tasks);
      renderTasks();
    });
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'task-content';

  const titleContainer = document.createElement('div');
  titleContainer.style.display = 'flex';
  titleContainer.style.flexDirection = 'column';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'task-title';
  titleSpan.textContent = task.title;

  // Countdown badge for the task itself (if inactive)
  let countdownBadge = null;
  if (!isActive) {
    countdownBadge = document.createElement('span');
    countdownBadge.className = 'countdown-badge';
    countdownBadge.textContent = `距今还有 ${daysLeft} 天`;
  }

  // Folded subtask countdown badge
  let foldedBadge = null;
  if (hasKids && task.isCollapsed) {
    const children = tasks.filter(t => t.parentId === task.id);
    let minDays = null;
    children.forEach(c => {
      const d = getDaysLeft(c.targetDate);
      if (minDays === null || d < minDays) minDays = d;
    });
    if (minDays !== null && minDays > 0) {
      foldedBadge = document.createElement('span');
      foldedBadge.className = 'countdown-badge folded-badge';
      foldedBadge.textContent = `子任务最近还有 ${minDays} 天`;
    }
  }

  if (hasKids) {
    // Fold indicator arrow
    const arrow = document.createElement('span');
    arrow.className = 'fold-arrow';
    arrow.textContent = task.isCollapsed ? '▶' : '▼';
    contentDiv.appendChild(arrow);

    const allDone = allChildrenCompletedToday(task.id);
    if (allDone) titleSpan.classList.add('completed');
    
    titleContainer.appendChild(titleSpan);
    if (countdownBadge) titleContainer.appendChild(countdownBadge);
    if (foldedBadge) titleContainer.appendChild(foldedBadge);
    
    contentDiv.appendChild(titleContainer);
  } else {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!task.completedDate && isToday(task.completedDate);
    checkbox.addEventListener('change', () => toggleComplete(task.id, checkbox.checked));
    
    if (task.completedDate && isToday(task.completedDate)) titleSpan.classList.add('completed');
    
    contentDiv.appendChild(checkbox);
    titleContainer.appendChild(titleSpan);
    if (countdownBadge) titleContainer.appendChild(countdownBadge);
    
    contentDiv.appendChild(titleContainer);
  }

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  editBtn.title = '编辑任务';
  editBtn.addEventListener('click', (e) => { e.stopPropagation(); editTask(task.id); });

  const delBtn = document.createElement('button');
  delBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  delBtn.title = '删除任务';
  delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(delBtn);

  rowDiv.appendChild(contentDiv);
  rowDiv.appendChild(actionsDiv);
  li.appendChild(rowDiv);

  if (hasKids && !task.isCollapsed) {
    const children = tasks
      .filter(t => t.parentId === task.id)
      .sort((a, b) => a.order - b.order);
    if (children.length) {
      const sublist = document.createElement('ul');
      sublist.className = 'subtask-list';
      children.forEach(child => sublist.appendChild(buildTaskElement(child)));
      li.appendChild(sublist);
    }
  }

  return li;
}

function renderTasks() {
  const container = document.getElementById('taskList');
  container.innerHTML = '';

  // Filter out tasks that are completed on previous days (hide them)
  const visibleTasks = tasks.filter(t => {
    if (!t.completedDate) return true;
    return isToday(t.completedDate);
  });

  // Root tasks (parentId === null)
  const roots = visibleTasks
    .filter(t => t.parentId === null)
    .sort((a, b) => a.order - b.order);

  const ul = document.createElement('ul');
  ul.className = 'task-root';
  roots.forEach(root => ul.appendChild(buildTaskElement(root)));
  container.appendChild(ul);

  // Populate parent selector for new tasks
  populateParentSelect();

  // Init drag‑and‑drop ordering for root list
  if (window.Sortable) {
    Sortable.create(ul, {
      animation: 150,
      delay: 800,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      handle: '.task-item',
      onStart: () => { if (navigator.vibrate) navigator.vibrate(30); },
      onEnd: (evt) => {
        const movedId = evt.item.dataset.id;
        const newIndex = evt.newIndex;
        reorderTask(movedId, newIndex, null);
      },
    });
    // Sub‑task drag‑and‑drop (delegated per sublist)
    document.querySelectorAll('.subtask-list').forEach(subUl => {
      Sortable.create(subUl, {
        animation: 150,
        delay: 800,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        onStart: () => { if (navigator.vibrate) navigator.vibrate(30); },
        onEnd: (evt) => {
          const movedId = evt.item.dataset.id;
          const newIndex = evt.newIndex;
          const newParentId = evt.to.closest('li.task-item')?.dataset.id || null;
          reorderTask(movedId, newIndex, newParentId);
        },
      });
    });
  }
}

function populateParentSelect() {
  const select = document.getElementById('parentSelect');
  const prevValue = select.value;
  select.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '无父任务（主任务）';
  select.appendChild(defaultOpt);
  tasks
    .filter(t => t.parentId === null)
    .sort((a, b) => a.order - b.order)
    .forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.title;
      select.appendChild(opt);
    });
  select.value = prevValue;
}

// ==== Task Operations ====
function addTask() {
  const titleInput = document.getElementById('titleInput');
  const parentSelect = document.getElementById('parentSelect');
  const recurrenceSelect = document.getElementById('recurrenceSelect');

  const title = titleInput.value.trim();
  if (!title) return alert('请填写任务标题');

  const parentId = parentSelect.value || null;
  const recurrenceType = recurrenceSelect.value;
  const recurrence = recurrenceType === 'none' ? { type: 'none', interval: 1 } : { type: recurrenceType, interval: 1 };

  // Determine order – place at end of sibling list
  const siblings = tasks.filter(t => t.parentId === parentId);
  const order = siblings.length ? Math.max(...siblings.map(s => s.order)) + 1 : 0;

  const newTask = new Task({ title, parentId, order, recurrence });
  tasks.push(newTask);
  saveTasks(tasks);
  renderTasks();
  titleInput.value = '';
  recurrenceSelect.value = 'none';
}

function toggleComplete(id, isChecked) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (isChecked) {
    task.completedDate = new Date().toISOString();
  } else {
    task.completedDate = null;
  }
  // Auto-update parent completion status
  if (task.parentId) {
    syncParentCompletion(task.parentId);
  }
  saveTasks(tasks);
  renderTasks();
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (!confirm('确定要删除「' + task.title + '」吗？')) return;
  // Recursively delete children
  const toDelete = [id];
  let i = 0;
  while (i < toDelete.length) {
    const cur = toDelete[i];
    const children = tasks.filter(t => t.parentId === cur).map(t => t.id);
    toDelete.push(...children);
    i++;
  }
  tasks = tasks.filter(t => !toDelete.includes(t.id));
  saveTasks(tasks);
  renderTasks();
}

// ==== Edit: reuse modal ====
let editingTaskId = null; // null = add mode, string = edit mode

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;

  // Pre-fill modal fields
  document.getElementById('titleInput').value = task.title;
  document.getElementById('parentSelect').value = task.parentId || '';
  document.getElementById('recurrenceSelect').value = task.recurrence.type;

  // Pre-fill recurrence details
  if (task.recurrence.type === 'weekly') {
    document.getElementById('weeklyDaySelect').value = task.recurrence.dayOfWeek !== undefined ? task.recurrence.dayOfWeek : '';
  } else if (task.recurrence.type === 'monthly') {
    document.getElementById('monthlyDaySelect').value = task.recurrence.dayOfMonth !== undefined ? task.recurrence.dayOfMonth : '';
  } else if (task.recurrence.type === 'half-yearly') {
    document.getElementById('halfYearlyMonthSelect').value = task.recurrence.monthOffset !== undefined ? task.recurrence.monthOffset : '';
    document.getElementById('halfYearlyDaySelect').value = task.recurrence.dayOfMonth !== undefined ? task.recurrence.dayOfMonth : '';
  }
  // Trigger change to show the correct fields
  document.getElementById('recurrenceSelect').dispatchEvent(new Event('change'));

  document.getElementById('reminderToggle').checked = !!task.reminderEnabled;
  document.getElementById('reminderTime').disabled = !task.reminderEnabled;
  document.getElementById('reminderTime').value = task.reminderTime || '';

  // Update modal title
  document.querySelector('.modal-content h2').textContent = '编辑任务';

  const hasKids = hasChildren(id);
  if (hasKids) {
    document.getElementById('parentSelect').style.display = 'none';
    document.getElementById('recurrenceSelect').style.display = 'none';
    document.getElementById('recurrenceDetails').style.display = 'none';
    document.querySelector('.reminder-row').style.display = 'none';
  } else {
    document.getElementById('parentSelect').style.display = 'block';
    document.getElementById('recurrenceSelect').style.display = 'block';
    document.querySelector('.reminder-row').style.display = 'flex';
  }

  openModal();
}

function reorderTask(id, newIndex, newParentId) {
  // Update parent if changed
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.parentId = newParentId;
  // Re‑calculate order among new siblings
  const siblings = tasks.filter(t => t.parentId === newParentId && t.id !== id).sort((a, b) => a.order - b.order);
  siblings.splice(newIndex, 0, task);
  siblings.forEach((t, idx) => (t.order = idx));
  saveTasks(tasks);
  renderTasks();
}

// ==== Modal Control Functions ====
function openModal() {
  const modal = document.getElementById('taskModal');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  const modal = document.getElementById('taskModal');
  modal.setAttribute('aria-hidden', 'true');
  // Reset to add mode
  editingTaskId = null;
  document.getElementById('titleInput').value = '';
  document.getElementById('parentSelect').value = '';
  document.getElementById('recurrenceSelect').value = 'none';
  document.getElementById('weeklyDaySelect').value = '1';
  document.getElementById('monthlyDaySelect').value = '1';
  document.getElementById('halfYearlyMonthSelect').value = '0';
  document.getElementById('halfYearlyDaySelect').value = '1';
  document.getElementById('recurrenceSelect').dispatchEvent(new Event('change'));
  document.getElementById('reminderToggle').checked = false;
  document.getElementById('reminderTime').value = '';
  document.getElementById('reminderTime').disabled = true;
  document.querySelector('.modal-content h2').textContent = '新建任务';

  // Restore visibility of fields
  document.getElementById('parentSelect').style.display = 'block';
  document.getElementById('recurrenceSelect').style.display = 'block';
  document.querySelector('.reminder-row').style.display = 'flex';
}

function handleSave() {
  const titleInput = document.getElementById('titleInput');
  const parentSelect = document.getElementById('parentSelect');
  const recurrenceSelect = document.getElementById('recurrenceSelect');
  const reminderToggle = document.getElementById('reminderToggle');
  const reminderTimeInput = document.getElementById('reminderTime');

  const title = titleInput.value.trim();
  if (!title) return alert('请填写任务标题');

  const parentId = parentSelect.value || null;
  const recurrenceType = recurrenceSelect.value;
  let recurrence = { type: recurrenceType, interval: 1 };
  
  if (recurrenceType === 'weekly') {
    recurrence.dayOfWeek = parseInt(document.getElementById('weeklyDaySelect').value, 10);
  } else if (recurrenceType === 'monthly') {
    recurrence.dayOfMonth = parseInt(document.getElementById('monthlyDaySelect').value, 10);
  } else if (recurrenceType === 'half-yearly') {
    recurrence.monthOffset = parseInt(document.getElementById('halfYearlyMonthSelect').value, 10);
    recurrence.dayOfMonth = parseInt(document.getElementById('halfYearlyDaySelect').value, 10);
  } else if (recurrenceType === 'none') {
    recurrence = { type: 'none', interval: 1 };
  }

  const reminderEnabled = reminderToggle.checked;
  const reminderTime = reminderEnabled ? reminderTimeInput.value : null;

  if (reminderEnabled && !reminderTime) return alert('请设置提醒时间');

  if (editingTaskId) {
    const task = tasks.find(t => t.id === editingTaskId);
    if (task) {
      task.title = title;
      task.parentId = parentId;
      task.recurrence = recurrence;
      task.reminderEnabled = reminderEnabled;
      task.reminderTime = reminderTime;
    }
  } else {
    const siblings = tasks.filter(t => t.parentId === parentId);
    const order = siblings.length ? Math.max(...siblings.map(s => s.order)) + 1 : 0;
    const newTask = new Task({ title, parentId, order, recurrence, reminderEnabled, reminderTime });
    tasks.push(newTask);
  }

  saveTasks(tasks);
  renderTasks();
  closeModal();
}

// ==== Event Listeners ====
document.getElementById('openModalBtn').addEventListener('click', () => {
  editingTaskId = null;
  document.querySelector('.modal-content h2').textContent = '新建任务';
  openModal();
});
document.getElementById('cancelTaskBtn').addEventListener('click', closeModal);
document.getElementById('saveTaskBtn').addEventListener('click', handleSave);

// ==== Recurrence Details Toggle ====
document.getElementById('recurrenceSelect').addEventListener('change', (e) => {
  const type = e.target.value;
  const detailsDiv = document.getElementById('recurrenceDetails');
  const weeklyDay = document.getElementById('weeklyDaySelect');
  const monthlyDay = document.getElementById('monthlyDaySelect');
  const halfYearlyMonth = document.getElementById('halfYearlyMonthSelect');
  const halfYearlyDay = document.getElementById('halfYearlyDaySelect');

  // Hide all first
  detailsDiv.style.display = 'none';
  weeklyDay.style.display = 'none';
  monthlyDay.style.display = 'none';
  halfYearlyMonth.style.display = 'none';
  halfYearlyDay.style.display = 'none';

  if (type === 'weekly') {
    detailsDiv.style.display = 'flex';
    weeklyDay.style.display = 'block';
  } else if (type === 'monthly') {
    detailsDiv.style.display = 'flex';
    monthlyDay.style.display = 'block';
  } else if (type === 'half-yearly') {
    detailsDiv.style.display = 'flex';
    halfYearlyMonth.style.display = 'block';
    halfYearlyDay.style.display = 'block';
  }
});

// ==== Reminder Toggle: enable/disable time input ====
document.getElementById('reminderToggle').addEventListener('change', (e) => {
  document.getElementById('reminderTime').disabled = !e.target.checked;
});

// ==== Notification Permission ====
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ==== Reminder Checker (runs every 30s) ====
function checkReminders() {
  const now = new Date();
  const todayStr = now.toDateString();
  const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

  tasks.forEach(task => {
    if (!task.reminderEnabled || !task.reminderTime) return;
    // Skip if inactive (not yet due)
    if (getDaysLeft(task.targetDate) > 0) return;
    // Skip if already completed today
    if (task.completedDate && isToday(task.completedDate)) return;
    // Skip if already reminded today
    if (task.lastRemindedDate && new Date(task.lastRemindedDate).toDateString() === todayStr) return;
    // Check if it's time
    if (currentHHMM >= task.reminderTime) {
      task.lastRemindedDate = now.toISOString();
      saveTasks(tasks);
      // Send notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('RoutineFlow 提醒', {
          body: '「' + task.title + '」还没有完成哦！',
          icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>✅</text></svg>'
        });
      }
    }
  });
}

setInterval(checkReminders, 30000); // every 30 seconds

// ==== Populate Day Options (1-31) ====
function populateDays() {
  const mSelect = document.getElementById('monthlyDaySelect');
  const hSelect = document.getElementById('halfYearlyDaySelect');
  let options = '';
  for (let i = 1; i <= 31; i++) {
    options += `<option value="${i}">${i}日</option>`;
  }
  mSelect.innerHTML = options;
  hSelect.innerHTML = options;
}

// ==== Initial Load ====
populateDays();
recycleCompletedTasks();
renderTasks();
checkReminders(); // run once immediately
