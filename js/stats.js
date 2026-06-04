import { history, formatDate } from './store.js';

let chartInstance = null;

export function renderStats() {

  // Aggregate completion counts for the last 7 days
  const labels = [];
  const data = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    
    // label format: MM/DD
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);

    // count completions for this date
    const count = history.filter(h => {
      return formatDate(new Date(h.timestamp)) === dateStr;
    }).length;

    data.push(count);
  }

  // Draw chart
  const ctx = document.getElementById('completionChart');
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  // Assuming Chart.js is loaded globally via CDN
  if (window.Chart) {
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Completed Tasks',
          data: data,
          backgroundColor: '#7bc1e8',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // Render Top Tasks
  const topTasksContainer = document.getElementById('topTasksList');
  if (topTasksContainer) {
    topTasksContainer.innerHTML = '';
    
    const taskCounts = {};
    history.forEach(h => {
      if (!taskCounts[h.taskTitle]) taskCounts[h.taskTitle] = 0;
      taskCounts[h.taskTitle]++;
    });

    const sorted = Object.entries(taskCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (sorted.length === 0) {
      topTasksContainer.innerHTML = '<li style="text-align: center; color: var(--color-text-muted); padding: 1rem;">No data yet. Get started!</li>';
    } else {
      sorted.forEach(([title, count]) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '0.5rem 0';
        li.style.borderBottom = '1px solid var(--color-border)';
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        
        const countSpan = document.createElement('span');
        countSpan.textContent = count + (count === 1 ? ' time' : ' times');
        countSpan.style.color = 'var(--color-primary)';
        countSpan.style.fontWeight = 'bold';
        
        li.appendChild(titleSpan);
        li.appendChild(countSpan);
        topTasksContainer.appendChild(li);
      });
    }
  }
}
