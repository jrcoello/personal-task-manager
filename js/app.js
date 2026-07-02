// Estado y lógica de la aplicación.

let TASKS = [];
let workloadChart = null;
let currentBusinessTab = CONFIG.BUSINESSES[0];
let sortField = 'dueDate';
let sortDir = 'asc';

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheEls();
  populateSelects();
  bindEvents();
  await refresh();
}

function cacheEls() {
  els.tabs = document.querySelectorAll('.tab-btn');
  els.views = document.querySelectorAll('.view');
  els.statActive = document.getElementById('stat-active');
  els.statOverdue = document.getElementById('stat-overdue');
  els.statCompletedWeek = document.getElementById('stat-completed-week');
  els.statProgress = document.getElementById('stat-progress');
  els.overdueList = document.getElementById('overdue-list');
  els.chartCanvas = document.getElementById('chart-workload');
  els.businessTabs = document.getElementById('business-tabs');
  els.businessContent = document.getElementById('business-content');
  els.filterBusiness = document.getElementById('filter-business');
  els.filterStatus = document.getElementById('filter-status');
  els.filterPriority = document.getElementById('filter-priority');
  els.allTasksBody = document.getElementById('all-tasks-body');
  els.modalOverlay = document.getElementById('modal-overlay');
  els.formNewTask = document.getElementById('form-new-task');
  els.fieldBusiness = document.getElementById('field-business');
  els.fieldPriority = document.getElementById('field-priority');
  els.toast = document.getElementById('toast');
}

function populateSelects() {
  fillOptions(els.fieldBusiness, CONFIG.BUSINESSES);
  fillOptions(els.fieldPriority, CONFIG.PRIORITIES);
  fillOptions(els.filterBusiness, CONFIG.BUSINESSES, 'Todos los negocios');
  fillOptions(els.filterStatus, CONFIG.STATUSES, 'Todos los estatus');
  fillOptions(els.filterPriority, CONFIG.PRIORITIES, 'Todas las prioridades');
}

function fillOptions(select, values, placeholder) {
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.appendChild(opt);
  }
  values.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

function bindEvents() {
  els.tabs.forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  document.getElementById('btn-new-task').addEventListener('click', openModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  els.modalOverlay.addEventListener('click', (e) => { if (e.target === els.modalOverlay) closeModal(); });
  els.formNewTask.addEventListener('submit', handleCreateTask);

  els.filterBusiness.addEventListener('change', renderAllTasksView);
  els.filterStatus.addEventListener('change', renderAllTasksView);
  els.filterPriority.addEventListener('change', renderAllTasksView);

  document.querySelectorAll('.tasks-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortDir = 'asc';
      }
      renderAllTasksView();
    });
  });
}

function switchView(view) {
  els.tabs.forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  els.views.forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
}

async function refresh() {
  try {
    const records = await listTasks();
    TASKS = records.map(recordToTask);
    renderDashboard();
    renderBusinessView();
    renderAllTasksView();
  } catch (err) {
    showToast(err.message, true);
    console.error(err);
  }
}

function recordToTask(record) {
  const f = record.fields || {};
  return {
    id: record.id,
    name: f['Task Name'] || '(sin nombre)',
    business: f['Business'] || '',
    status: f['Task Status'] || 'Por hacer',
    priority: f['Priority'] || '',
    dueDate: f['Due Date'] || null,
    createdDate: f['Created Date'] || null,
    completedDate: f['Completed Date'] || null,
    notes: f['Notes'] || '',
  };
}

// ---------- Helpers de fecha ----------

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? 6 : day - 1; // lunes como inicio de semana
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOverdue(task) {
  return task.dueDate && task.status !== 'Completada' && task.dueDate < todayStr();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ---------- Dashboard ----------

function renderDashboard() {
  const active = TASKS.filter((t) => t.status !== 'Completada');
  const overdue = TASKS.filter(isOverdue);
  const weekStart = startOfWeek();
  const completedThisWeek = TASKS.filter((t) => {
    if (!t.completedDate) return false;
    return new Date(t.completedDate) >= weekStart;
  });
  const completedTotal = TASKS.filter((t) => t.status === 'Completada').length;
  const progressPct = TASKS.length ? Math.round((completedTotal / TASKS.length) * 100) : 0;

  els.statActive.textContent = active.length;
  els.statOverdue.textContent = overdue.length;
  els.statCompletedWeek.textContent = completedThisWeek.length;
  els.statProgress.textContent = `${progressPct}%`;

  renderOverdueList(overdue);
  renderWorkloadChart(active);
}

function renderOverdueList(overdue) {
  els.overdueList.innerHTML = '';
  if (!overdue.length) {
    els.overdueList.innerHTML = '<div class="empty-msg">No hay tareas atrasadas 🎉</div>';
    return;
  }
  overdue
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .forEach((t) => {
      const row = document.createElement('div');
      row.className = 'task-row';
      row.innerHTML = `
        <div>
          <div class="t-name">${escapeHtml(t.name)}</div>
          <div class="t-meta">${escapeHtml(t.business)} · vencía ${formatDate(t.dueDate)}</div>
        </div>
        ${priorityBadge(t.priority)}
      `;
      els.overdueList.appendChild(row);
    });
}

function renderWorkloadChart(activeTasks) {
  const counts = CONFIG.BUSINESSES.map(
    (b) => activeTasks.filter((t) => t.business === b).length
  );
  if (workloadChart) {
    workloadChart.data.datasets[0].data = counts;
    workloadChart.update();
    return;
  }
  workloadChart = new Chart(els.chartCanvas, {
    type: 'bar',
    data: {
      labels: CONFIG.BUSINESSES,
      datasets: [{
        label: 'Tareas activas',
        data: counts,
        backgroundColor: '#5b8def',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, color: '#9aa0ac' }, grid: { color: '#2c303a' } },
        x: { ticks: { color: '#9aa0ac' }, grid: { display: false } },
      },
    },
  });
}

// ---------- Vista por negocio ----------

function renderBusinessView() {
  els.businessTabs.innerHTML = '';
  CONFIG.BUSINESSES.forEach((b) => {
    const btn = document.createElement('button');
    btn.textContent = b;
    btn.className = b === currentBusinessTab ? 'active' : '';
    btn.addEventListener('click', () => {
      currentBusinessTab = b;
      renderBusinessView();
    });
    els.businessTabs.appendChild(btn);
  });

  const tasks = TASKS.filter((t) => t.business === currentBusinessTab);
  els.businessContent.innerHTML = '';
  const columns = document.createElement('div');
  columns.className = 'status-columns';

  CONFIG.STATUSES.forEach((status) => {
    const col = document.createElement('div');
    col.className = 'status-column';
    const group = tasks.filter((t) => t.status === status);
    col.innerHTML = `<h3>${status} (${group.length})</h3>`;
    const list = document.createElement('div');
    list.className = 'task-list';
    if (!group.length) {
      list.innerHTML = '<div class="empty-msg">Sin tareas</div>';
    } else {
      group
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
        .forEach((t) => list.appendChild(buildTaskRow(t)));
    }
    col.appendChild(list);
    columns.appendChild(col);
  });

  els.businessContent.appendChild(columns);
}

function buildTaskRow(t) {
  const row = document.createElement('div');
  row.className = 'task-row';
  const overdueTag = isOverdue(t) ? '<span class="badge badge-overdue">Atrasada</span>' : '';
  row.innerHTML = `
    <div>
      <div class="t-name">${escapeHtml(t.name)}</div>
      <div class="t-meta">${formatDate(t.dueDate)} ${overdueTag}</div>
    </div>
  `;
  const statusSelect = document.createElement('select');
  CONFIG.STATUSES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    opt.selected = s === t.status;
    statusSelect.appendChild(opt);
  });
  statusSelect.addEventListener('change', () => handleStatusChange(t, statusSelect.value));
  row.appendChild(statusSelect);
  return row;
}

async function handleStatusChange(task, newStatus) {
  const fields = { 'Task Status': newStatus };
  if (newStatus === 'Completada') {
    fields['Completed Date'] = todayStr();
  } else {
    fields['Completed Date'] = null;
  }
  try {
    await updateTask(task.id, fields);
    showToast('Tarea actualizada');
    await refresh();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------- Vista todas las tareas ----------

function renderAllTasksView() {
  let list = [...TASKS];
  const fb = els.filterBusiness.value;
  const fs = els.filterStatus.value;
  const fp = els.filterPriority.value;
  if (fb) list = list.filter((t) => t.business === fb);
  if (fs) list = list.filter((t) => t.status === fs);
  if (fp) list = list.filter((t) => t.priority === fp);

  list.sort((a, b) => {
    let av = a[sortField] || '';
    let bv = b[sortField] || '';
    if (sortField === 'dueDate') {
      av = av || '9999-99-99';
      bv = bv || '9999-99-99';
    }
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  document.querySelectorAll('.tasks-table th[data-sort]').forEach((th) => {
    const active = th.dataset.sort === sortField;
    th.classList.toggle('active', active);
    th.textContent = th.textContent.replace(/ [▲▼]$/, '');
    if (active) th.textContent += sortDir === 'asc' ? ' ▲' : ' ▼';
  });

  els.allTasksBody.innerHTML = '';
  if (!list.length) {
    els.allTasksBody.innerHTML = '<tr><td colspan="6" class="empty-msg">No hay tareas con estos filtros</td></tr>';
    return;
  }

  list.forEach((t) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td>${escapeHtml(t.business)}</td>
      <td>${escapeHtml(t.status)}</td>
      <td>${priorityBadge(t.priority)}</td>
      <td>${formatDate(t.dueDate)} ${isOverdue(t) ? '<span class="badge badge-overdue">Atrasada</span>' : ''}</td>
      <td class="row-actions"><button class="icon-btn" data-id="${t.id}" title="Eliminar">✕</button></td>
    `;
    tr.querySelector('.icon-btn').addEventListener('click', () => handleDeleteTask(t.id));
    els.allTasksBody.appendChild(tr);
  });
}

async function handleDeleteTask(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  try {
    await deleteTask(id);
    showToast('Tarea eliminada');
    await refresh();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------- Modal nueva tarea ----------

function openModal() {
  els.formNewTask.reset();
  els.modalOverlay.classList.add('open');
}

function closeModal() {
  els.modalOverlay.classList.remove('open');
}

async function handleCreateTask(e) {
  e.preventDefault();
  const fields = {
    'Task Name': document.getElementById('field-name').value.trim(),
    'Business': els.fieldBusiness.value,
    'Priority': els.fieldPriority.value,
    'Task Status': 'Por hacer',
  };
  const dueDate = document.getElementById('field-due-date').value;
  if (dueDate) fields['Due Date'] = dueDate;
  const notes = document.getElementById('field-notes').value.trim();
  if (notes) fields['Notes'] = notes;

  try {
    await createTask(fields);
    showToast('Tarea creada');
    closeModal();
    await refresh();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------- Utilidades UI ----------

function priorityBadge(priority) {
  const cls = { Alta: 'badge-alta', Media: 'badge-media', Baja: 'badge-baja' }[priority] || '';
  return priority ? `<span class="badge ${cls}">${priority}</span>` : '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let toastTimeout;
function showToast(message, isError) {
  clearTimeout(toastTimeout);
  els.toast.textContent = message;
  els.toast.classList.toggle('error', !!isError);
  els.toast.classList.add('show');
  toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 3000);
}
