import { loadTasks, loadHistory, recycleCompletedTasks } from './store.js';
import { renderTasks, handleSave, closeModal, openModal, setEditingTaskId } from './tasks.js';
import { renderStats } from './stats.js';

let currentTab = 'tasks';

function populateDays() {
  const mSelect = document.getElementById('monthlyDaySelect');
  const hSelect = document.getElementById('halfYearlyDaySelect');
  if (mSelect && hSelect) {
    let options = '';
    for (let i = 1; i <= 31; i++) {
      options += `<option value="${i}">${i}日</option>`;
    }
    mSelect.innerHTML = options;
    hSelect.innerHTML = options;
  }
}

function initApp() {
  populateDays();
  loadTasks();
  loadHistory();
  recycleCompletedTasks();
  
  // Render initial view
  switchTab('tasks');

  // Setup Event Listeners
  setupNavigation();
  setupModalListeners();
  setupPWA();
}

function switchTab(tabId) {
  currentTab = tabId;
  const tasksView = document.getElementById('tasksView');
  const statsView = document.getElementById('statsView');
  const fab = document.getElementById('openModalBtn');

  // Update Nav Active State
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    if (item.dataset.tab === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  if (tabId === 'tasks') {
    tasksView.style.display = 'block';
    statsView.style.display = 'none';
    fab.style.display = 'flex';
    renderTasks();
  } else if (tabId === 'stats') {
    tasksView.style.display = 'none';
    statsView.style.display = 'block';
    fab.style.display = 'none';
    renderStats();
  }
}

function setupNavigation() {
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
    });
  });
}

function setupModalListeners() {
  // Modal buttons are handled in tasks.js except open which is handled via index.html or here
  const openModalBtn = document.getElementById('openModalBtn');
  if (openModalBtn) {
    openModalBtn.addEventListener('click', () => {
      setEditingTaskId(null);
      document.querySelector('.modal-content h2').textContent = 'New Task';
      openModal();
    });
  }
  
  const cancelBtn = document.getElementById('cancelTaskBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  
  const saveBtn = document.getElementById('saveTaskBtn');
  if (saveBtn) saveBtn.addEventListener('click', handleSave);

  const recurrenceSelect = document.getElementById('recurrenceSelect');
  if (recurrenceSelect) {
    recurrenceSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      const detailsDiv = document.getElementById('recurrenceDetails');
      const weeklyDay = document.getElementById('weeklyDaySelect');
      const monthlyDay = document.getElementById('monthlyDaySelect');
      const halfYearlyMonth = document.getElementById('halfYearlyMonthSelect');
      const halfYearlyDay = document.getElementById('halfYearlyDaySelect');

      if (detailsDiv && weeklyDay && monthlyDay && halfYearlyMonth && halfYearlyDay) {
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
      }
    });
  }

  const reminderToggle = document.getElementById('reminderToggle');
  if (reminderToggle) {
    reminderToggle.addEventListener('change', (e) => {
      document.getElementById('reminderTime').disabled = !e.target.checked;
    });
  }
}

// ==== PWA / A2HS Logic ====
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function setupPWA() {
  let deferredPrompt;
  const a2hsPrompt = document.getElementById('a2hsPrompt');
  const a2hsClose = document.getElementById('a2hsClose');
  const a2hsInstallBtn = document.getElementById('a2hsInstallBtn');

  function showA2HSPrompt() {
    if (!a2hsPrompt) return;
    a2hsPrompt.style.display = 'flex';
    setTimeout(() => {
      a2hsPrompt.classList.add('visible');
    }, 10);
  }

  if (a2hsClose) {
    a2hsClose.addEventListener('click', () => {
      a2hsPrompt.classList.remove('visible');
      setTimeout(() => { a2hsPrompt.style.display = 'none'; }, 300);
      localStorage.setItem('a2hs_dismissed_v2', 'true');
    });
  }

  if (!isStandalone() && !localStorage.getItem('a2hs_dismissed_v2')) {
    if (isIOS()) {
      setTimeout(showA2HSPrompt, 1500);
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!localStorage.getItem('a2hs_dismissed_v2')) {
      setTimeout(showA2HSPrompt, 1500);
    }
  });

  if (a2hsInstallBtn) {
    a2hsInstallBtn.addEventListener('click', async () => {
      a2hsPrompt.classList.remove('visible');
      setTimeout(() => { a2hsPrompt.style.display = 'none'; }, 300);
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          localStorage.setItem('a2hs_dismissed_v2', 'true');
        }
        deferredPrompt = null;
      }
    });
  }

  // Reminders Notification Request
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}

// Boot the app directly (module scripts are deferred by default, DOM is already ready)
initApp();
