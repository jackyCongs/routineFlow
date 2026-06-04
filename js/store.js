// ==== State & Storage ====
const TASKS_KEY = 'routineFlow_tasks';
const HISTORY_KEY = 'routineFlow_history';

export let tasks = [];
export let history = []; // Array of { taskId, taskTitle, timestamp }

export class Task {
  constructor({ title, parentId = null, order = 0, recurrence = { type: 'none', interval: 1 }, reminderEnabled = false, reminderTime = null }) {
    this.id = 'task_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    this.title = title;
    this.parentId = parentId;
    this.order = order;
    this.recurrence = recurrence; 
    this.reminderEnabled = reminderEnabled;
    this.reminderTime = reminderTime;
    
    this.createdAt = new Date().toISOString();
    this.completedDate = null;
    this.targetDate = formatDate(new Date()); 
    this.lastRemindedDate = null; 
  }
}

export function saveTasks(tasksToSave) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasksToSave));
}

export function loadTasks() {
  const data = localStorage.getItem(TASKS_KEY);
  if (data) {
    try {
      tasks = JSON.parse(data);
    } catch (e) {
      tasks = [];
    }
  }
  return tasks;
}

export function saveHistory(historyToSave) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyToSave));
}

export function loadHistory() {
  const data = localStorage.getItem(HISTORY_KEY);
  if (data) {
    try {
      history = JSON.parse(data);
    } catch (e) {
      history = [];
    }
  }
  return history;
}

export function recordCompletion(taskId, taskTitle) {
  const record = {
    id: 'hist_' + Date.now(),
    taskId,
    taskTitle,
    timestamp: new Date().toISOString()
  };
  history.push(record);
  saveHistory(history);
}

export function removeCompletionForToday(taskId) {
  const todayStr = formatDate(new Date());
  // Find the most recent record for this task today and remove it
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].taskId === taskId && formatDate(new Date(history[i].timestamp)) === todayStr) {
      history.splice(i, 1);
      saveHistory(history);
      break;
    }
  }
}

// ==== Date Utilities ====
export function isToday(dateStr) {
  const today = new Date();
  return dateStr === formatDate(today);
}

export function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getDaysLeft(targetDateStr) {
  if (!targetDateStr) return 0;
  const targetDate = new Date(targetDateStr);
  targetDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = targetDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getNextDateForRule(lastDateObj, rule) {
  let nextDate = new Date(lastDateObj);
  if (rule.type === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (rule.type === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 1);
    while (nextDate.getDay() !== rule.dayOfWeek) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
  } else if (rule.type === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
    nextDate.setDate(rule.dayOfMonth);
  } else if (rule.type === 'half-yearly') {
    nextDate.setMonth(nextDate.getMonth() + 6);
    let targetMonth = nextDate.getMonth();
    let currentOffset = targetMonth % 6;
    if (currentOffset !== rule.monthOffset) {
      targetMonth = targetMonth - currentOffset + rule.monthOffset;
      if (targetMonth < nextDate.getMonth()) {
         targetMonth += 6;
      }
    }
    nextDate.setMonth(targetMonth);
    nextDate.setDate(rule.dayOfMonth);
  }
  return nextDate;
}

export function recycleCompletedTasks() {
  let changed = false;
  const today = new Date();
  const todayStr = formatDate(today);

  tasks.forEach(task => {
    if (task.completedDate && task.recurrence.type !== 'none') {
      const compDateStr = formatDate(new Date(task.completedDate));
      if (todayStr > compDateStr) {
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
