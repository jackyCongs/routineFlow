import { 
  tasks, saveTasks, recordCompletion, removeCompletionForToday, 
  isToday, formatDate, getDaysLeft, hasChildren, allChildrenCompletedToday, syncParentCompletion 
} from './store.js';

import { Task } from './store.js';

export let editingTaskId = null;
export function setEditingTaskId(id) {
  editingTaskId = id;
}

// ==== Rendering ====
export function buildTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task-item';
  if (task.parentId) li.classList.add('subtask');
  li.dataset.id = task.id;

  const daysLeft = getDaysLeft(task.targetDate);
  const kids = hasChildren(task.id);

  let isActive = daysLeft <= 0 || task.recurrence.type === 'none';

  if (kids) {
    li.classList.remove('active', 'inactive');
  } else {
    if (isActive) li.classList.add('active');
    else li.classList.add('inactive');
  }

  const rowDiv = document.createElement('div');
  rowDiv.className = 'task-row';

  if (kids) {
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

  let countdownBadge = null;
  if (!isActive) {
    countdownBadge = document.createElement('span');
    countdownBadge.className = 'countdown-badge';
    countdownBadge.textContent = `${daysLeft} days left`;
  }

  let foldedBadge = null;
  if (kids && task.isCollapsed) {
    const children = tasks.filter(t => t.parentId === task.id);
    let minDays = null;
    children.forEach(c => {
      const d = getDaysLeft(c.targetDate);
      if (minDays === null || d < minDays) minDays = d;
    });
    if (minDays !== null && minDays > 0) {
      foldedBadge = document.createElement('span');
      foldedBadge.className = 'countdown-badge folded-badge';
      foldedBadge.textContent = `Subtask in ${minDays} days`;
    }
  }

  if (kids) {
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

  rowDiv.appendChild(contentDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  editBtn.innerHTML = '✎';
  editBtn.title = 'Edit';
  editBtn.addEventListener('click', () => editTask(task.id));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn';
  deleteBtn.innerHTML = '✕';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', () => deleteTask(task.id));

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(deleteBtn);
  rowDiv.appendChild(actionsDiv);

  li.appendChild(rowDiv);

  if (kids && !task.isCollapsed) {
    const subList = document.createElement('ul');
    subList.className = 'subtask-list';
    
    const children = tasks.filter(t => t.parentId === task.id).sort((a, b) => a.order - b.order);
    children.forEach(child => subList.appendChild(buildTaskElement(child)));
    li.appendChild(subList);
  }

  return li;
}

export function renderTasks() {
  const container = document.getElementById('taskList');
  if (!container) return;
  container.innerHTML = '';

  // Before filtering: if a parent task was auto-completed because all its children
  // were done, but now all children will be hidden (completed non-recurring from a
  // previous day), clear the parent's completedDate so it reverts to a standalone task.
  tasks.forEach(t => {
    if (hasChildren(t.id) && t.completedDate && !isToday(t.completedDate)) {
      const children = tasks.filter(c => c.parentId === t.id);
      const allChildrenHidden = children.every(c =>
        c.recurrence.type === 'none' && c.completedDate && !isToday(c.completedDate)
      );
      if (allChildrenHidden) {
        t.completedDate = null;
        saveTasks(tasks);
      }
    }
  });

  const visibleTasks = tasks.filter(t => {
    if (t.recurrence.type === 'none') {
      // Non-recurring: hide if completed on a previous day (done is done)
      // Show if not completed, or completed today (so user can still uncheck)
      // But parent tasks whose children are all hidden should stay visible
      if (t.completedDate && !isToday(t.completedDate)) return false;
      return true;
    }
    return getDaysLeft(t.targetDate) <= 0 || (t.completedDate && isToday(t.completedDate)) || t.parentId !== null || hasChildren(t.id);
  });

  const roots = visibleTasks.filter(t => t.parentId === null).sort((a, b) => a.order - b.order);

  const ul = document.createElement('ul');
  ul.className = 'task-root';
  roots.forEach(root => ul.appendChild(buildTaskElement(root)));
  container.appendChild(ul);

  populateParentSelect();

  if (window.Sortable) {
    Sortable.create(ul, {
      animation: 150,
      delay: 800,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      handle: '.task-item',
      onStart: () => { if (navigator.vibrate) navigator.vibrate(30); },
      onEnd: (evt) => {
        reorderTask(evt.item.dataset.id, evt.newIndex, null);
      },
    });
    document.querySelectorAll('.subtask-list').forEach(subUl => {
      Sortable.create(subUl, {
        animation: 150,
        delay: 800,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        onStart: () => { if (navigator.vibrate) navigator.vibrate(30); },
        onEnd: (evt) => {
          const newParentId = evt.to.closest('li.task-item')?.dataset.id || null;
          reorderTask(evt.item.dataset.id, evt.newIndex, newParentId);
        },
      });
    });
  }
}

export function populateParentSelect() {
  const select = document.getElementById('parentSelect');
  if (!select) return;
  const prevValue = select.value;
  select.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'No Parent (Root Task)';
  select.appendChild(defaultOpt);
  tasks.filter(t => t.parentId === null).sort((a, b) => a.order - b.order).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.title;
    select.appendChild(opt);
  });
  select.value = prevValue;
}

export function toggleComplete(id, isChecked) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (isChecked) {
    task.completedDate = new Date().toISOString();
    recordCompletion(task.id, task.title);
  } else {
    task.completedDate = null;
    removeCompletionForToday(task.id);
  }
  if (task.parentId) syncParentCompletion(task.parentId);
  saveTasks(tasks);
  renderTasks();
}

export function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (!confirm(`Are you sure you want to delete '${task.title}'?`)) return;
  const toDelete = [id];
  let i = 0;
  while (i < toDelete.length) {
    const cur = toDelete[i];
    const children = tasks.filter(t => t.parentId === cur).map(t => t.id);
    toDelete.push(...children);
    i++;
  }
  // modify original tasks array via loop to maintain reference
  for (let j = tasks.length - 1; j >= 0; j--) {
    if (toDelete.includes(tasks[j].id)) tasks.splice(j, 1);
  }
  saveTasks(tasks);
  renderTasks();
}

export function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;

  document.getElementById('titleInput').value = task.title;
  document.getElementById('parentSelect').value = task.parentId || '';
  document.getElementById('recurrenceSelect').value = task.recurrence.type;

  if (task.recurrence.type === 'weekly') {
    document.getElementById('weeklyDaySelect').value = task.recurrence.dayOfWeek !== undefined ? task.recurrence.dayOfWeek : '';
  } else if (task.recurrence.type === 'monthly') {
    document.getElementById('monthlyDaySelect').value = task.recurrence.dayOfMonth !== undefined ? task.recurrence.dayOfMonth : '';
  } else if (task.recurrence.type === 'half-yearly') {
    document.getElementById('halfYearlyMonthSelect').value = task.recurrence.monthOffset !== undefined ? task.recurrence.monthOffset : '';
    document.getElementById('halfYearlyDaySelect').value = task.recurrence.dayOfMonth !== undefined ? task.recurrence.dayOfMonth : '';
  }
  document.getElementById('recurrenceSelect').dispatchEvent(new Event('change'));

  document.getElementById('reminderToggle').checked = !!task.reminderEnabled;
  document.getElementById('reminderTime').disabled = !task.reminderEnabled;
  document.getElementById('reminderTime').value = task.reminderTime || '';

  document.querySelector('.modal-content h2').textContent = 'Edit Task';

  const kids = hasChildren(id);
  if (kids) {
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

export function reorderTask(id, newIndex, newParentId) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.parentId = newParentId;
  const siblings = tasks.filter(t => t.parentId === newParentId && t.id !== id).sort((a, b) => a.order - b.order);
  siblings.splice(newIndex, 0, task);
  siblings.forEach((t, i) => t.order = i);
  saveTasks(tasks);
}

export function handleSave() {
  const titleInput = document.getElementById('titleInput');
  const parentSelect = document.getElementById('parentSelect');
  const recurrenceSelect = document.getElementById('recurrenceSelect');
  const reminderToggle = document.getElementById('reminderToggle');
  const reminderTimeInput = document.getElementById('reminderTime');

  const title = titleInput.value.trim();
  if (!title) return alert('Please enter a task title');

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

  if (reminderEnabled && !reminderTime) return alert('Please set a reminder time');

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

export function openModal() {
  const modal = document.getElementById('taskModal');
  modal.setAttribute('aria-hidden', 'false');
}

export function closeModal() {
  const modal = document.getElementById('taskModal');
  modal.setAttribute('aria-hidden', 'true');
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
  document.querySelector('.modal-content h2').textContent = 'New Task';
  
  document.getElementById('parentSelect').style.display = 'block';
  document.getElementById('recurrenceSelect').style.display = 'block';
  document.querySelector('.reminder-row').style.display = 'flex';
}
