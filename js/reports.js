/**
 * Reporting & Analytics Module
 * Analytics dashboard, Daily Report, Weekly Summary, Monthly Pending.
 */

const Reports = {
  tab: 'analytics', // 'analytics' | 'daily' | 'weekly' | 'monthly'
  viewMode: null,

  filters: {
    workRequest: '',
    client: '',
    employee: '',
    dateFrom: '',
    dateTo: ''
  },

  dailyDate: '',
  weeklyDate: '',
  monthlyMonth: '',

  render() {
    if (!this.viewMode) this.viewMode = App.getPreferredViewMode('reports');
    if (!this.dailyDate) this.dailyDate = new Date().toISOString().slice(0, 10);
    if (!this.weeklyDate) this.weeklyDate = new Date().toISOString().slice(0, 10);
    if (!this.monthlyMonth) this.monthlyMonth = new Date().toISOString().slice(0, 7);

    const container = el('div', { class: 'page' });

    const header = el('div', { class: 'form-header-bar' });
    header.appendChild(el('h1', { text: 'Reports' }));

    const tabs = el('div', { class: 'admin-tabs' });
    const tabDefs = [
      { key: 'analytics', label: 'Analytics' },
      { key: 'daily', label: 'Daily Report' },
      { key: 'weekly', label: 'Weekly Summary' },
      { key: 'monthly', label: 'Monthly Pending' }
    ];
    tabDefs.forEach(t => {
      const btn = el('button', {
        class: 'btn ' + (this.tab === t.key ? 'btn-primary' : 'btn-ghost'),
        text: t.label
      });
      btn.addEventListener('click', () => { this.tab = t.key; App.handleRoute(); });
      tabs.appendChild(btn);
    });
    header.appendChild(tabs);
    container.appendChild(header);

    if (this.tab === 'analytics') {
      const entities = this.getAccessibleEntities();
      container.appendChild(el('div', { class: 'bento-grid' }, [
        this.renderWorkRequestVolume(entities),
        this.renderTaskCompletion(entities),
        this.renderBillingSummary(entities),
        this.renderDisbursementReport(entities),
        this.renderEntityPL(entities)
      ]));
    } else if (this.tab === 'daily') {
      container.appendChild(this.renderDailyReport());
    } else if (this.tab === 'weekly') {
      container.appendChild(this.renderWeeklySummary());
    } else {
      container.appendChild(this.renderMonthlyPending());
    }

    return container;
  },

  init() {},

  getAccessibleEntities() {
    return (Auth.user?.entities || []).map(e => e.toUpperCase());
  },

  filterByEntity(items, entities) {
    const upper = entities.map(e => e.toUpperCase());
    return items.filter(i => upper.includes(i.entity?.toUpperCase?.()));
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  daysBetween(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e - s;
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  },

  getMonday(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  },

  getWeekRange(dateStr) {
    const monday = this.getMonday(dateStr);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().slice(0, 10),
      end: sunday.toISOString().slice(0, 10)
    };
  },

  getMonthRange(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    const start = `${monthStr}-01`;
    const endDate = new Date(year, month, 0);
    const end = `${monthStr}-${String(endDate.getDate()).padStart(2, '0')}`;
    return { start, end };
  },

  // ============================================================
  // Common Components
  // ============================================================
  renderFilterBar(excludeDateRange) {
    const bar = el('div', { class: 'filters-bar' });
    const entities = this.getAccessibleEntities();

    // Work Request
    const wrSel = el('select', { class: 'form-select' });
    wrSel.appendChild(el('option', { value: '', text: 'All Work Requests' }));
    DB.getAll('workRequests').filter(wr => entities.includes(wr.entity?.toUpperCase?.())).forEach(wr => {
      wrSel.appendChild(el('option', { value: wr.id, text: wr.title }));
    });
    wrSel.value = this.filters.workRequest;
    wrSel.addEventListener('change', () => { this.filters.workRequest = wrSel.value; App.handleRoute(); });
    bar.appendChild(wrSel);

    // Client
    const clientSel = el('select', { class: 'form-select' });
    clientSel.appendChild(el('option', { value: '', text: 'All Clients' }));
    DB.getAll('clients').filter(c => entities.includes(c.entity?.toUpperCase?.())).forEach(c => {
      clientSel.appendChild(el('option', { value: c.id, text: c.name }));
    });
    clientSel.value = this.filters.client;
    clientSel.addEventListener('change', () => { this.filters.client = clientSel.value; App.handleRoute(); });
    bar.appendChild(clientSel);

    // Employee
    const empSel = el('select', { class: 'form-select' });
    empSel.appendChild(el('option', { value: '', text: 'All Employees' }));
    DB.getAll('users').forEach(u => {
      empSel.appendChild(el('option', { value: u.id, text: u.name }));
    });
    empSel.value = this.filters.employee;
    empSel.addEventListener('change', () => { this.filters.employee = empSel.value; App.handleRoute(); });
    bar.appendChild(empSel);

    // Due Date range
    if (!excludeDateRange) {
      bar.appendChild(el('span', { text: 'From:', style: 'font-size:0.875rem; color:var(--color-text-muted);' }));
      const fromInput = el('input', { type: 'date', class: 'form-select', value: this.filters.dateFrom });
      fromInput.addEventListener('change', () => { this.filters.dateFrom = fromInput.value; App.handleRoute(); });
      bar.appendChild(fromInput);

      bar.appendChild(el('span', { text: 'To:', style: 'font-size:0.875rem; color:var(--color-text-muted);' }));
      const toInput = el('input', { type: 'date', class: 'form-select', value: this.filters.dateTo });
      toInput.addEventListener('change', () => { this.filters.dateTo = toInput.value; App.handleRoute(); });
      bar.appendChild(toInput);
    }

    return bar;
  },

  renderViewModeToggle() {
    const toggle = el('div', { class: 'view-mode-toggle' });
    ['table', 'board', 'list'].forEach(mode => {
      const btn = el('button', { text: mode.charAt(0).toUpperCase() + mode.slice(1) });
      if (this.viewMode === mode) btn.classList.add('active');
      btn.addEventListener('click', () => {
        this.viewMode = mode;
        App.setPreferredViewMode('reports', mode);
        App.handleRoute();
      });
      toggle.appendChild(btn);
    });
    return toggle;
  },

  getFilteredTasks() {
    const entities = this.getAccessibleEntities();
    const wrs = DB.getAll('workRequests');
    let tasks = DB.getAll('tasks').filter(t => {
      const wr = wrs.find(w => w.id === t.workRequestId);
      return wr && entities.includes(wr.entity?.toUpperCase?.());
    });

    if (this.filters.workRequest) {
      tasks = tasks.filter(t => t.workRequestId === this.filters.workRequest);
    }
    if (this.filters.client) {
      tasks = tasks.filter(t => {
        const wr = wrs.find(w => w.id === t.workRequestId);
        return wr && wr.clientId === this.filters.client;
      });
    }
    if (this.filters.employee) {
      tasks = tasks.filter(t => (t.assigneeId || t.assignedTo) === this.filters.employee);
    }
    if (this.filters.dateFrom) {
      tasks = tasks.filter(t => !t.dueDate || t.dueDate >= this.filters.dateFrom);
    }
    if (this.filters.dateTo) {
      tasks = tasks.filter(t => !t.dueDate || t.dueDate <= this.filters.dateTo);
    }

    return tasks;
  },

  renderTaskTable(tasks) {
    const wrs = DB.getAll('workRequests');
    const clients = DB.getAll('clients');

    const table = el('table', { class: 'report-table' });
    table.appendChild(el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'Task' }),
        el('th', { text: 'Client' }),
        el('th', { text: 'Assignee' }),
        el('th', { text: 'Status' }),
        el('th', { text: 'Due Date' })
      ])
    ]));

    const tbody = el('tbody');
    tasks.forEach(t => {
      const wr = wrs.find(w => w.id === t.workRequestId);
      const client = wr ? clients.find(c => c.id === wr.clientId) : null;
      const assignee = DB.getById('users', t.assigneeId || t.assignedTo);
      tbody.appendChild(el('tr', {}, [
        el('td', { text: t.title }),
        el('td', { text: client?.name || '—' }),
        el('td', { text: assignee?.name || '—' }),
        el('td', { text: t.status }),
        el('td', { text: t.dueDate ? formatDate(t.dueDate) : '—' })
      ]));
    });
    table.appendChild(tbody);
    return table;
  },

  renderTaskBoard(tasks) {
    const statuses = ['Draft', 'Assigned', 'In Progress', 'For Review', 'Completed', 'Cancelled'];
    const wrs = DB.getAll('workRequests');
    const clients = DB.getAll('clients');

    const board = el('div', { class: 'board-view' });
    statuses.forEach(status => {
      const statusTasks = tasks.filter(t => t.status === status);
      const col = el('div', { class: 'board-column' });
      col.appendChild(el('div', { class: 'board-column-header', text: status + ' (' + statusTasks.length + ')' }));

      statusTasks.forEach(t => {
        const wr = wrs.find(w => w.id === t.workRequestId);
        const client = wr ? clients.find(c => c.id === wr.clientId) : null;
        const assignee = DB.getById('users', t.assigneeId || t.assignedTo);

        const card = el('div', { class: 'board-card' });
        card.appendChild(el('div', { class: 'board-card-title', text: t.title }));
        card.appendChild(el('div', { class: 'board-card-meta', text: (client?.name || '—') + ' • ' + (assignee?.name || '—') }));
        col.appendChild(card);
      });

      board.appendChild(col);
    });
    return board;
  },

  renderTaskList(tasks) {
    const list = el('div', { class: 'list-view' });
    const wrs = DB.getAll('workRequests');
    const clients = DB.getAll('clients');

    tasks.forEach(t => {
      const wr = wrs.find(w => w.id === t.workRequestId);
      const client = wr ? clients.find(c => c.id === wr.clientId) : null;
      const assignee = DB.getById('users', t.assigneeId || t.assignedTo);

      const item = el('div', { class: 'list-item' });
      const left = el('div');
      left.appendChild(el('div', { class: 'list-item-title', text: t.title }));
      left.appendChild(el('div', { class: 'list-item-meta', text: (client?.name || '—') + ' • ' + (assignee?.name || '—') + ' • Due ' + (t.dueDate ? formatDate(t.dueDate) : '—') }));
      item.appendChild(left);
      item.appendChild(el('span', { class: 'badge badge-info', text: t.status }));
      list.appendChild(item);
    });
    return list;
  },

  // ============================================================
  // Daily Report
  // ============================================================
  renderDailyReport() {
    const wrapper = el('div');

    const filters = this.renderFilterBar(true);
    const dateInput = el('input', { type: 'date', class: 'form-select', value: this.dailyDate });
    dateInput.addEventListener('change', () => { this.dailyDate = dateInput.value; App.handleRoute(); });
    filters.appendChild(el('span', { text: 'Date:', style: 'font-size:0.875rem; color:var(--color-text-muted);' }));
    filters.appendChild(dateInput);
    wrapper.appendChild(filters);

    wrapper.appendChild(this.renderViewModeToggle());

    const tasks = this.getFilteredTasks().filter(t => {
      const logs = t.timeLogs || [];
      return logs.some(l => l.date === this.dailyDate);
    });

    if (tasks.length === 0) {
      wrapper.appendChild(el('p', { class: 'empty-state', text: 'No tasks with time logs for ' + formatDate(this.dailyDate) + '.' }));
      return wrapper;
    }

    if (this.viewMode === 'table') {
      wrapper.appendChild(this.renderDailyTable(tasks));
    } else if (this.viewMode === 'board') {
      wrapper.appendChild(this.renderTaskBoard(tasks));
    } else {
      wrapper.appendChild(this.renderTaskList(tasks));
    }

    return wrapper;
  },

  renderDailyTable(tasks) {
    const wrs = DB.getAll('workRequests');
    const clients = DB.getAll('clients');

    const table = el('table', { class: 'report-table' });
    table.appendChild(el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'Employee' }),
        el('th', { text: 'Task' }),
        el('th', { text: 'Client' }),
        el('th', { text: 'Start Time' }),
        el('th', { text: 'End Time' }),
        el('th', { text: 'Hours' }),
        el('th', { text: 'Status' })
      ])
    ]));

    const tbody = el('tbody');
    tasks.forEach(t => {
      const wr = wrs.find(w => w.id === t.workRequestId);
      const client = wr ? clients.find(c => c.id === wr.clientId) : null;
      const logs = (t.timeLogs || []).filter(l => l.date === this.dailyDate);

      logs.forEach(log => {
        const user = DB.getById('users', log.userId || t.assigneeId || t.assignedTo);
        tbody.appendChild(el('tr', {}, [
          el('td', { text: user?.name || '—' }),
          el('td', { text: t.title }),
          el('td', { text: client?.name || '—' }),
          el('td', { text: log.startTime || '—' }),
          el('td', { text: log.endTime || '—' }),
          el('td', { text: String(log.hours || 0) }),
          el('td', { text: t.status })
        ]));
      });
    });

    table.appendChild(tbody);
    return table;
  },

  // ============================================================
  // Weekly Summary
  // ============================================================
  renderWeeklySummary() {
    const wrapper = el('div');

    const filters = this.renderFilterBar(true);
    const weekInput = el('input', { type: 'date', class: 'form-select', value: this.weeklyDate });
    weekInput.addEventListener('change', () => { this.weeklyDate = weekInput.value; App.handleRoute(); });
    filters.appendChild(el('span', { text: 'Week of:', style: 'font-size:0.875rem; color:var(--color-text-muted);' }));
    filters.appendChild(weekInput);
    wrapper.appendChild(filters);

    const { start, end } = this.getWeekRange(this.weeklyDate);
    const tasks = this.getFilteredTasks().filter(t => {
      if (!t.dueDate) return false;
      return t.dueDate >= start && t.dueDate <= end;
    });

    // Summary by employee
    const summary = {};
    DB.getAll('users').forEach(u => {
      summary[u.id] = { name: u.name, completed: 0, pending: 0, overdue: 0 };
    });
    summary['unassigned'] = { name: 'Unassigned', completed: 0, pending: 0, overdue: 0 };

    const today = this.today();
    tasks.forEach(t => {
      const empId = t.assigneeId || t.assignedTo || 'unassigned';
      if (!summary[empId]) {
        summary[empId] = { name: 'Unknown', completed: 0, pending: 0, overdue: 0 };
      }
      if (t.status === 'Completed') {
        summary[empId].completed++;
      } else if (t.status !== 'Cancelled') {
        summary[empId].pending++;
        if (t.dueDate < today) {
          summary[empId].overdue++;
        }
      }
    });

    const summaryRows = Object.values(summary).filter(s => s.completed > 0 || s.pending > 0);
    const periodLabel = formatDate(start) + ' – ' + formatDate(end);

    if (summaryRows.length === 0) {
      wrapper.appendChild(el('p', { class: 'empty-state', text: 'No tasks for the week of ' + periodLabel + '.' }));
    } else {
      const table = el('table', { class: 'report-table' });
      table.appendChild(el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Employee' }),
          el('th', { text: 'Completed' }),
          el('th', { text: 'Pending' }),
          el('th', { text: 'Overdue' })
        ])
      ]));
      const tbody = el('tbody');
      summaryRows.forEach(s => {
        tbody.appendChild(el('tr', {}, [
          el('td', { text: s.name }),
          el('td', { text: String(s.completed) }),
          el('td', { text: String(s.pending) }),
          el('td', { text: String(s.overdue), style: s.overdue > 0 ? 'color:var(--color-danger); font-weight:600;' : '' })
        ]));
      });
      table.appendChild(tbody);
      wrapper.appendChild(table);
    }

    wrapper.appendChild(el('h3', { text: 'Tasks', style: 'margin-top:var(--spacing-lg);' }));
    wrapper.appendChild(this.renderViewModeToggle());

    if (tasks.length === 0) {
      wrapper.appendChild(el('p', { class: 'empty-state', text: 'No tasks to display for this week.' }));
    } else if (this.viewMode === 'table') {
      wrapper.appendChild(this.renderTaskTable(tasks));
    } else if (this.viewMode === 'board') {
      wrapper.appendChild(this.renderTaskBoard(tasks));
    } else {
      wrapper.appendChild(this.renderTaskList(tasks));
    }

    return wrapper;
  },

  // ============================================================
  // Monthly Pending
  // ============================================================
  renderMonthlyPending() {
    const wrapper = el('div');

    const filters = this.renderFilterBar(true);
    const monthInput = el('input', { type: 'month', class: 'form-select', value: this.monthlyMonth });
    monthInput.addEventListener('change', () => { this.monthlyMonth = monthInput.value; App.handleRoute(); });
    filters.appendChild(el('span', { text: 'Month:', style: 'font-size:0.875rem; color:var(--color-text-muted);' }));
    filters.appendChild(monthInput);
    wrapper.appendChild(filters);

    wrapper.appendChild(this.renderViewModeToggle());

    const { start, end } = this.getMonthRange(this.monthlyMonth);
    const tasks = this.getFilteredTasks().filter(t => {
      if (t.status === 'Completed' || t.status === 'Cancelled') return false;
      if (!t.dueDate) return false;
      return t.dueDate >= start && t.dueDate <= end;
    });

    if (tasks.length === 0) {
      wrapper.appendChild(el('p', { class: 'empty-state', text: 'No pending tasks for ' + this.monthlyMonth + '.' }));
    } else if (this.viewMode === 'table') {
      wrapper.appendChild(this.renderPendingTable(tasks));
    } else if (this.viewMode === 'board') {
      wrapper.appendChild(this.renderTaskBoard(tasks));
    } else {
      wrapper.appendChild(this.renderTaskList(tasks));
    }

    // Retainer templates due this month
    const [year, month] = this.monthlyMonth.split('-').map(Number);
    const entities = this.getAccessibleEntities();
    const retainerTemplates = DB.getAll('retainerTemplates').filter(rt => {
      if (!entities.includes(rt.entity?.toUpperCase?.())) return false;
      if (rt.schedule === 'monthly') return true;
      if (rt.schedule === 'quarterly') return month % 3 === 0;
      return false;
    });

    const retainerSection = el('div', { style: 'margin-top:var(--spacing-xl);' });
    retainerSection.appendChild(el('h3', { text: 'Recurring Retainer Tasks Due This Month' }));

    if (retainerTemplates.length === 0) {
      retainerSection.appendChild(el('p', { class: 'empty-state', text: 'No retainer templates due this month.' }));
    } else {
      const rtTable = el('table', { class: 'report-table' });
      rtTable.appendChild(el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Template' }),
          el('th', { text: 'Client' }),
          el('th', { text: 'Schedule' }),
          el('th', { text: 'PF Amount' }),
          el('th', { text: 'Tasks' })
        ])
      ]));
      const rtBody = el('tbody');
      const clients = DB.getAll('clients');
      retainerTemplates.forEach(rt => {
        const client = clients.find(c => c.id === rt.clientId);
        rtBody.appendChild(el('tr', {}, [
          el('td', { text: rt.name }),
          el('td', { text: client?.name || '—' }),
          el('td', { text: rt.schedule }),
          el('td', { class: 'num', text: formatPHP(rt.pfAmount || 0) }),
          el('td', { text: String((rt.tasks || []).length) })
        ]));
      });
      rtTable.appendChild(rtBody);
      retainerSection.appendChild(rtTable);
    }
    wrapper.appendChild(retainerSection);

    return wrapper;
  },

  renderPendingTable(tasks) {
    const wrs = DB.getAll('workRequests');
    const clients = DB.getAll('clients');

    const byEmployee = {};
    tasks.forEach(t => {
      const empId = t.assigneeId || t.assignedTo || 'unassigned';
      if (!byEmployee[empId]) byEmployee[empId] = [];
      byEmployee[empId].push(t);
    });

    const container = el('div');
    Object.entries(byEmployee).forEach(([empId, empTasks]) => {
      const emp = DB.getById('users', empId);
      container.appendChild(el('h4', {
        text: (emp?.name || 'Unassigned') + ' (' + empTasks.length + ')',
        style: 'margin:var(--spacing-md) 0 var(--spacing-sm); font-size:1rem; font-weight:600;'
      }));

      const table = el('table', { class: 'report-table' });
      table.appendChild(el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Task' }),
          el('th', { text: 'Client' }),
          el('th', { text: 'Due Date' }),
          el('th', { text: 'Status' })
        ])
      ]));
      const tbody = el('tbody');
      empTasks.forEach(t => {
        const wr = wrs.find(w => w.id === t.workRequestId);
        const client = wr ? clients.find(c => c.id === wr.clientId) : null;
        tbody.appendChild(el('tr', {}, [
          el('td', { text: t.title }),
          el('td', { text: client?.name || '—' }),
          el('td', { text: formatDate(t.dueDate) }),
          el('td', { text: t.status })
        ]));
      });
      table.appendChild(tbody);
      container.appendChild(table);
    });
    return container;
  },

  // ─── Work Request Volume ─────────────────────────────────────────────
  renderWorkRequestVolume(entities) {
    const wrs = this.filterByEntity(DB.getAll('workRequests'), entities);
    const counts = {};
    wrs.forEach(wr => {
      counts[wr.status] = (counts[wr.status] || 0) + 1;
    });

    const chartContainer = el('div', { class: 'chart-container' });
    chartContainer.innerHTML = `
      <svg class="smooth-line-chart" viewBox="0 0 600 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="report-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.8" />
            <stop offset="100%" stop-color="var(--color-surface)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path class="smooth-line-bg" style="fill: url(#report-gradient);" d="M 0,180 C 100,180 150,60 250,90 C 350,120 400,150 500,100 C 550,70 580,40 600,60 L 600,200 L 0,200 Z" />
        <path class="smooth-line" d="M 0,180 C 100,180 150,60 250,90 C 350,120 400,150 500,100 C 550,70 580,40 600,60" />
        <text x="0" y="195" class="chart-x-axis">Jan</text>
        <text x="150" y="195" class="chart-x-axis">Feb</text>
        <text x="300" y="195" class="chart-x-axis">Mar</text>
        <text x="450" y="195" class="chart-x-axis">Apr</text>
        <text x="580" y="195" class="chart-x-axis">May</text>
      </svg>
    `;

    return el('div', { class: 'bento-item bento-two-thirds report-card' }, [
      el('h2', { text: 'Work Request Volume Trend' }),
      chartContainer
    ]);
  },

  // ─── Task Completion Rate ──────────────────────────────────────────────
  renderTaskCompletion(entities) {
    const wrs = DB.getAll('workRequests').filter(wr => entities.includes(wr.entity?.toUpperCase?.()));
    const wrIds = new Set(wrs.map(wr => wr.id));
    const tasks = DB.getAll('tasks').filter(t => wrIds.has(t.workRequestId));
    const completedTasks = tasks.filter(t => t.status === 'Completed');

    let avgDays = 0;
    if (completedTasks.length > 0) {
      const totalDays = completedTasks.reduce((sum, t) => {
        return sum + this.daysBetween(t.createdAt, t.updatedAt);
      }, 0);
      avgDays = Math.round(totalDays / completedTasks.length);
    }

    const today = this.today();
    const overdueTasks = tasks.filter(t => {
      return t.dueDate < today && t.status !== 'Completed' && t.status !== 'Cancelled';
    });

    let overdueSection;
    if (overdueTasks.length === 0) {
      overdueSection = el('p', { class: 'empty-state', text: 'No overdue tasks.' });
    } else {
      const rows = overdueTasks.map(t => {
        const assigneeId = t.assigneeId || t.assignedTo;
        const assignee = assigneeId
          ? (DB.getById('users', assigneeId)?.name || assigneeId)
          : 'Unassigned';
        return el('tr', {}, [
          el('td', { text: t.title }),
          el('td', { text: formatDate(t.dueDate) }),
          el('td', { text: assignee }),
          el('td', { text: t.status })
        ]);
      });
      overdueSection = el('table', { class: 'report-table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: 'Task' }),
            el('th', { text: 'Due Date' }),
            el('th', { text: 'Assignee' }),
            el('th', { text: 'Status' })
          ])
        ]),
        el('tbody', {}, rows)
      ]);
    }

    return el('div', { class: 'bento-item bento-third report-card' }, [
      el('h2', { text: 'Task Completion Rate' }),
      el('div', { class: 'report-stat' }, [
        el('span', { text: String(avgDays) }),
        el('span', { class: 'report-stat-label', text: ' avg days to complete' })
      ]),
      el('h3', { text: 'Overdue Tasks (' + overdueTasks.length + ')' }),
      overdueSection
    ]);
  },

  // ─── Billing Summary ─────────────────────────────────────────────────
  renderBillingSummary(entities) {
    const invoices = this.filterByEntity(DB.getAll('invoices'), entities)
      .filter(inv => inv.status !== 'Cancelled');

    const byEntity = {};
    entities.forEach(e => {
      byEntity[e] = { pf: 0, govt: 0, outstanding: 0 };
    });

    invoices.forEach(inv => {
      const e = inv.entity.toUpperCase();
      if (!byEntity[e]) return;
      inv.lineItems.forEach(li => {
        if (li.type === 'PF') byEntity[e].pf += li.amount;
        else if (li.type === 'GovtFee' || li.type === 'Government Fee') byEntity[e].govt += li.amount;
      });
      if (['Sent', 'Partially Paid', 'Overdue'].includes(inv.status)) {
        const paid = inv.paidAmount ?? inv.amountPaid ?? 0;
        byEntity[e].outstanding += (inv.total - paid);
      }
    });

    const rows = entities.map(e => {
      const data = byEntity[e];
      return el('tr', {}, [
        el('td', { text: e }),
        el('td', { class: 'num', text: formatPHP(data.pf) }),
        el('td', { class: 'num', text: formatPHP(data.govt) }),
        el('td', { class: 'num', text: formatPHP(data.outstanding) })
      ]);
    });

    return el('div', { class: 'bento-item bento-half report-card' }, [
      el('h2', { text: 'Billing Summary' }),
      el('table', { class: 'report-table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: 'Entity' }),
            el('th', { text: 'PF Billed' }),
            el('th', { text: "Gov't Fees" }),
            el('th', { text: 'Outstanding' })
          ])
        ]),
        el('tbody', {}, rows)
      ])
    ]);
  },

  // ─── Disbursement Report ─────────────────────────────────────────────
  renderDisbursementReport(entities) {
    const disbursements = this.filterByEntity(DB.getAll('disbursements'), entities)
      .filter(d => d.status === 'Released');

    const byEmployee = {};
    let firmFund = 0;
    let clientFund = 0;

    disbursements.forEach(d => {
      const source = d.fundSource || (d.type === 'ClientFunded' ? 'Client Fund' : 'Firm Fund');
      if (source === 'Firm Fund') firmFund += d.amount;
      else if (source === 'Client Fund') clientFund += d.amount;

      const empId = d.employeeId || d.requestedBy || 'unknown';
      if (!byEmployee[empId]) {
        const user = DB.getById('users', empId);
        byEmployee[empId] = { name: user?.name || empId, total: 0, count: 0 };
      }
      byEmployee[empId].total += d.amount;
      byEmployee[empId].count += 1;
    });

    const fundSplit = el('div', { class: 'fund-split' }, [
      el('div', { class: 'fund-box' }, [
        el('div', { class: 'fund-label', text: 'Firm Fund' }),
        el('div', { class: 'fund-value', text: formatPHP(firmFund) })
      ]),
      el('div', { class: 'fund-box' }, [
        el('div', { class: 'fund-label', text: 'Client Fund' }),
        el('div', { class: 'fund-value', text: formatPHP(clientFund) })
      ])
    ]);

    let employeeTable;
    const empEntries = Object.values(byEmployee);
    if (empEntries.length === 0) {
      employeeTable = el('p', { class: 'empty-state', text: 'No released disbursements.' });
    } else {
      const rows = empEntries.map(emp =>
        el('tr', {}, [
          el('td', { text: emp.name }),
          el('td', { class: 'num', text: String(emp.count) }),
          el('td', { class: 'num', text: formatPHP(emp.total) })
        ])
      );
      employeeTable = el('table', { class: 'report-table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: 'Employee' }),
            el('th', { text: 'Count' }),
            el('th', { text: 'Total' })
          ])
        ]),
        el('tbody', {}, rows)
      ]);
    }

    return el('div', { class: 'bento-item bento-half report-card' }, [
      el('h2', { text: 'Disbursement Report' }),
      fundSplit,
      el('h3', { text: 'By Employee' }),
      employeeTable
    ]);
  },

  // ─── Entity P&L Snapshot ───────────────────────────────────────────────
  renderEntityPL(entities) {
    const invoices = DB.getAll('invoices').filter(inv => inv.status === 'Paid');
    const disbursements = DB.getAll('disbursements').filter(d => {
      const source = d.fundSource || (d.type === 'ClientFunded' ? 'Client Fund' : 'Firm Fund');
      return source === 'Firm Fund';
    });

    const byEntity = {};
    entities.forEach(e => {
      byEntity[e] = { revenue: 0, expenses: 0 };
    });

    invoices.forEach(inv => {
      const e = inv.entity.toUpperCase();
      if (!byEntity[e]) return;
      inv.lineItems.forEach(li => {
        if (li.type === 'PF') byEntity[e].revenue += li.amount;
      });
    });

    disbursements.forEach(d => {
      const e = d.entity.toUpperCase();
      if (!byEntity[e]) return;
      byEntity[e].expenses += d.amount;
    });

    const cards = entities.map(e => {
      const data = byEntity[e];
      const pl = data.revenue - data.expenses;
      const isPositive = pl >= 0;
      return el('div', { class: 'pl-card ' + e.toLowerCase() }, [
        el('h3', { text: e }),
        el('div', { class: 'pl-row' }, [
          el('span', { class: 'pl-label', text: 'Revenue' }),
          el('span', { class: 'pl-value', text: formatPHP(data.revenue) })
        ]),
        el('div', { class: 'pl-row' }, [
          el('span', { class: 'pl-label', text: 'Expenses' }),
          el('span', { class: 'pl-value', text: formatPHP(data.expenses) })
        ]),
        el('div', { class: 'pl-divider' }),
        el('div', { class: 'pl-row pl-total' }, [
          el('span', { class: 'pl-label', text: 'P&L' }),
          el('span', {
            class: 'pl-value ' + (isPositive ? 'positive' : 'negative'),
            text: formatPHP(pl)
          })
        ])
      ]);
    });

    return el('div', { class: 'bento-item bento-full report-card' }, [
      el('h2', { text: 'Entity P&L Snapshot' }),
      el('div', { class: 'pl-grid' }, cards)
    ]);
  }
};
