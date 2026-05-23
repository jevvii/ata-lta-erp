/**
 * Workflow & Task Management Module
 * Work Request CRUD, task assignment, dependency engine (DAG), retainer templates.
 */

const Workflow = {
  editingId: null,
  view: 'list',
  detailWrId: null,

  render() {
    const container = el('div', { class: 'page' });
    container.appendChild(el('h1', { text: 'Workflow' }));

    if (this.view === 'list') {
      container.appendChild(this.renderList());
    } else if (this.view === 'form') {
      container.appendChild(this.renderForm());
    } else if (this.view === 'detail') {
      container.appendChild(this.renderDetail());
    }

    return container;
  },

  init() {},

  // ============================================================
  // List View
  // ============================================================
  renderList() {
    const entity = Auth.activeEntity;
    const workRequests = DB.getWhere('workRequests', r => r.entity === entity);

    const actions = el('div', { class: 'actions-bar' });
    const addBtn = el('button', { class: 'btn btn-primary', text: 'Add Work Request' });
    addBtn.addEventListener('click', () => { this.view = 'form'; this.editingId = null; App.handleRoute(); });
    actions.appendChild(addBtn);

    const statusFilter = el('select', { class: 'form-select', style: 'max-width:200px' });
    statusFilter.appendChild(el('option', { value: '', text: 'All Statuses' }));
    ['Draft', 'Pre-processing', 'Processing', 'Billing', 'Disbursement', 'Completed', 'Cancelled'].forEach(s => {
      statusFilter.appendChild(el('option', { value: s, text: s }));
    });
    statusFilter.addEventListener('change', () => this.refreshList(grid, statusFilter.value));
    actions.appendChild(statusFilter);

    const grid = el('div', { class: 'card-grid' });
    this.refreshList(grid, '');

    const wrapper = el('div');
    wrapper.appendChild(actions);
    wrapper.appendChild(grid);
    return wrapper;
  },

  refreshList(grid, statusFilter) {
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    const entity = Auth.activeEntity;
    let wrs = DB.getWhere('workRequests', r => r.entity === entity);
    if (statusFilter) wrs = wrs.filter(r => r.status === statusFilter);

    if (wrs.length === 0) {
      grid.appendChild(el('p', { text: 'No work requests found.', class: 'empty-state' }));
      return;
    }

    wrs.forEach(wr => {
      const client = DB.getById('clients', wr.clientId);
      const tasks = DB.getWhere('tasks', t => t.workRequestId === wr.id);
      const completed = tasks.filter(t => t.status === 'Completed').length;
      const total = tasks.length || 1;
      const pct = Math.round((completed / total) * 100);

      const card = el('div', { class: 'card wr-card' });
      const header = el('div', { class: 'card-header' });
      const title = el('h3', { class: 'card-title', text: wr.title });
      const statusBadge = this.statusBadge(wr.status);
      header.appendChild(title);
      header.appendChild(statusBadge);
      card.appendChild(header);

      const meta = el('div', { class: 'wr-meta' });
      meta.appendChild(el('span', { text: 'Client: ' + (client?.name || '—') }));
      meta.appendChild(el('span', { text: 'Priority: ' + (wr.priority || 'Normal') }));
      meta.appendChild(el('span', { text: 'Due: ' + (wr.dueDate ? formatDate(wr.dueDate) : '—') }));
      card.appendChild(meta);

      const progressWrap = el('div', { class: 'progress-wrap' });
      const progress = el('div', { class: 'progress' });
      const bar = el('div', { class: 'progress-bar' });
      bar.style.width = pct + '%';
      progress.appendChild(bar);
      progressWrap.appendChild(el('span', { text: completed + '/' + total + ' tasks', class: 'progress-label' }));
      progressWrap.appendChild(progress);
      card.appendChild(progressWrap);

      card.appendChild(this.renderProgressBar(wr.status));

      const cardActions = el('div', { class: 'card-actions' });
      const viewBtn = el('button', { class: 'btn btn-ghost btn-sm', text: 'View' });
      viewBtn.addEventListener('click', () => { this.view = 'detail'; this.detailWrId = wr.id; App.handleRoute(); });
      cardActions.appendChild(viewBtn);
      card.appendChild(cardActions);

      grid.appendChild(card);
    });
  },

  statusBadge(status) {
    const map = {
      'Draft': 'badge-info',
      'Pre-processing': 'badge-info',
      'Processing': 'badge-warning',
      'Billing': 'badge-warning',
      'Disbursement': 'badge-warning',
      'Completed': 'badge-success',
      'Cancelled': 'badge-danger'
    };
    return el('span', { class: 'badge ' + (map[status] || ''), text: status });
  },

  renderProgressBar(status) {
    const stages = ['Work Request', 'Pre-processing', 'Processing', 'Billing', 'Disbursement', 'Documentation'];
    const map = { 'Draft': 0, 'Pre-processing': 1, 'Processing': 2, 'Billing': 3, 'Disbursement': 4, 'Completed': 5, 'Cancelled': 5 };
    const current = map[status] ?? 0;
    const wrap = el('div', { class: 'workflow-progress' });
    stages.forEach((s, i) => {
      const step = el('div', { class: 'progress-step', text: s });
      if (i < current) step.classList.add('completed');
      else if (i === current) step.classList.add('active');
      wrap.appendChild(step);
    });
    return wrap;
  },

  // ============================================================
  // Create / Edit Form
  // ============================================================
  renderForm() {
    const entity = Auth.activeEntity;
    const wr = this.editingId ? DB.getById('workRequests', this.editingId) : null;
    const container = el('div');
    container.appendChild(el('h2', { text: wr ? 'Edit Work Request' : 'Add Work Request' }));

    const form = el('form', { class: 'form-stacked' });

    const fields = [
      { label: 'Title', name: 'title', type: 'text', required: true },
      { label: 'Description', name: 'description', type: 'text' },
      { label: 'Priority', name: 'priority', type: 'text' },
      { label: 'Due Date', name: 'dueDate', type: 'date' },
    ];
    fields.forEach(f => {
      const group = el('div', { class: 'form-group' });
      group.appendChild(el('label', { text: f.label + (f.required ? ' *' : '') }));
      const input = el('input', {
        type: f.type, name: f.name,
        value: wr ? (wr[f.name] || '') : '',
        required: f.required
      });
      group.appendChild(input);
      form.appendChild(group);
    });

    // Client dropdown
    const clientGroup = el('div', { class: 'form-group' });
    clientGroup.appendChild(el('label', { text: 'Client *' }));
    const clientSel = el('select', { name: 'clientId', required: true });
    clientSel.appendChild(el('option', { value: '', text: '— Select Client —' }));
    DB.getWhere('clients', c => c.entity === entity).forEach(c => {
      const opt = el('option', { value: c.id, text: c.name });
      if (wr && wr.clientId === c.id) opt.selected = true;
      clientSel.appendChild(opt);
    });
    clientGroup.appendChild(clientSel);
    form.appendChild(clientGroup);

    // Retainer checkbox
    const retainerGroup = el('div', { class: 'form-group' });
    const retLabel = el('label', { class: 'checkbox-label' });
    const retCb = el('input', { type: 'checkbox', name: 'isRetainer' });
    retLabel.appendChild(retCb);
    retLabel.appendChild(document.createTextNode(' This is a retainer template'));
    retainerGroup.appendChild(retLabel);

    const scheduleGroup = el('div', { class: 'form-group hidden', id: 'retainer-schedule' });
    scheduleGroup.appendChild(el('label', { text: 'Schedule' }));
    const scheduleSel = el('select', { name: 'schedule' });
    ['monthly', 'quarterly'].forEach(s => scheduleSel.appendChild(el('option', { value: s, text: s })));
    scheduleGroup.appendChild(scheduleSel);
    retainerGroup.appendChild(scheduleGroup);

    retCb.addEventListener('change', () => {
      scheduleGroup.classList.toggle('hidden', !retCb.checked);
    });
    form.appendChild(retainerGroup);

    // Tasks section
    const tasksSection = el('div', { class: 'form-section' });
    tasksSection.appendChild(el('h3', { text: 'Tasks' }));
    const tasksList = el('div', { id: 'task-rows' });
    tasksSection.appendChild(tasksList);

    const addTaskBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: '+ Add Task' });
    addTaskBtn.addEventListener('click', () => this.addTaskRow(tasksList));
    tasksSection.appendChild(addTaskBtn);
    form.appendChild(tasksSection);

    // Pre-populate existing tasks if editing
    if (wr) {
      const existingTasks = DB.getWhere('tasks', t => t.workRequestId === wr.id);
      existingTasks.forEach(t => this.addTaskRow(tasksList, t));
    } else {
      this.addTaskRow(tasksList);
      this.addTaskRow(tasksList);
    }

    const btnGroup = el('div', { class: 'form-group form-actions' });
    const saveBtn = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Save Work Request' });
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: 'Cancel' });
    cancelBtn.addEventListener('click', () => { this.view = 'list'; this.editingId = null; App.handleRoute(); });
    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(cancelBtn);
    form.appendChild(btnGroup);

    form.addEventListener('submit', e => { e.preventDefault(); this.submitForm(form); });

    container.appendChild(form);
    return container;
  },

  addTaskRow(container, taskData) {
    const row = el('div', { class: 'task-row' });
    const titleIn = el('input', { type: 'text', placeholder: 'Task title', class: 'task-title-input', value: taskData?.title || '' });
    row.appendChild(titleIn);

    const assigneeSel = el('select', { class: 'task-assignee' });
    assigneeSel.appendChild(el('option', { value: '', text: '— Assignee —' }));
    DB.getAll('users').forEach(u => {
      const opt = el('option', { value: u.id, text: u.name });
      if (taskData?.assigneeId === u.id) opt.selected = true;
      assigneeSel.appendChild(opt);
    });
    row.appendChild(assigneeSel);

    const predSel = el('select', { class: 'task-pred' });
    predSel.appendChild(el('option', { value: '', text: '— No predecessor —' }));
    row.appendChild(predSel);

    const removeBtn = el('button', { type: 'button', class: 'btn btn-danger btn-sm', text: '×' });
    removeBtn.addEventListener('click', () => row.remove());
    row.appendChild(removeBtn);

    container.appendChild(row);
  },

  submitForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const entity = Auth.activeEntity;

    const record = {
      title: data.title.trim(),
      description: data.description?.trim() || '',
      clientId: data.clientId,
      priority: data.priority?.trim() || 'Normal',
      dueDate: data.dueDate || '',
      entity: entity,
      status: 'Draft'
    };

    // Collect tasks from rows
    const taskRows = form.querySelectorAll('.task-row');
    const tasks = [];
    taskRows.forEach((row, idx) => {
      const title = row.querySelector('.task-title-input').value.trim();
      if (!title) return;
      tasks.push({
        title,
        assigneeId: row.querySelector('.task-assignee').value || null,
        predecessors: [],
        status: 'Draft',
        dueDate: record.dueDate
      });
    });

    if (this.editingId) {
      DB.update('workRequests', this.editingId, record);
      // Delete existing tasks and recreate
      const existing = DB.getWhere('tasks', t => t.workRequestId === this.editingId);
      existing.forEach(t => DB.delete('tasks', t.id));
      tasks.forEach((t, i) => {
        t.id = generateId('t');
        t.workRequestId = this.editingId;
        t.sortOrder = i;
        DB.insert('tasks', t);
      });
    } else {
      record.id = generateId('wr');
      record.createdAt = new Date().toISOString();
      DB.insert('workRequests', record);
      tasks.forEach((t, i) => {
        t.id = generateId('t');
        t.workRequestId = record.id;
        t.sortOrder = i;
        DB.insert('tasks', t);
      });
    }

    this.view = 'list';
    this.editingId = null;
    App.handleRoute();
  },

  // ============================================================
  // Detail View
  // ============================================================
  renderDetail() {
    const wr = DB.getById('workRequests', this.detailWrId);
    if (!wr) {
      this.view = 'list';
      App.handleRoute();
      return el('div');
    }
    const client = DB.getById('clients', wr.clientId);
    const tasks = DB.getWhere('tasks', t => t.workRequestId === wr.id);

    const container = el('div');
    container.appendChild(el('h2', { text: wr.title }));

    const meta = el('div', { class: 'wr-meta' });
    meta.appendChild(el('span', { text: 'Client: ' + (client?.name || '—') }));
    meta.appendChild(el('span', { text: 'Status: ' + wr.status }));
    meta.appendChild(el('span', { text: 'Priority: ' + (wr.priority || 'Normal') }));
    container.appendChild(meta);

    container.appendChild(this.renderProgressBar(wr.status));

    const tasksHeader = el('div', { class: 'section-header' });
    tasksHeader.appendChild(el('h3', { text: 'Tasks' }));
    container.appendChild(tasksHeader);

    const taskTable = el('table', { class: 'data-table' });
    const thead = el('thead');
    const thr = el('tr');
    ['Task', 'Assignee', 'Status', 'Due', 'Actions'].forEach(h => thr.appendChild(el('th', { text: h })));
    thead.appendChild(thr);
    taskTable.appendChild(thead);

    const tbody = el('tbody');
    tasks.forEach(t => {
      const assignee = DB.getById('users', t.assigneeId);
      const tr = el('tr');
      tr.appendChild(el('td', { text: t.title }));
      tr.appendChild(el('td', { text: assignee?.name || '—' }));
      tr.appendChild(el('td', { text: t.status }));
      tr.appendChild(el('td', { text: t.dueDate ? formatDate(t.dueDate) : '—' }));
      const tdAct = el('td');

      const statusSel = el('select', { class: 'task-status-sel' });
      const validStatuses = this.getValidNextStatuses(t);
      ['Draft', 'Assigned', 'In Progress', 'For Review', 'Completed', 'Cancelled'].forEach(s => {
        const opt = el('option', { value: s, text: s });
        if (s === t.status) opt.selected = true;
        if (!validStatuses.includes(s)) opt.disabled = true;
        statusSel.appendChild(opt);
      });
      statusSel.addEventListener('change', () => {
        const res = this.updateTaskStatus(t.id, statusSel.value);
        if (res.error) {
          alert(res.error);
          statusSel.value = t.status;
        } else {
          App.handleRoute();
        }
      });
      tdAct.appendChild(statusSel);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    taskTable.appendChild(tbody);
    container.appendChild(taskTable);

    const backBtn = el('button', { class: 'btn btn-ghost', text: 'Back to List' });
    backBtn.addEventListener('click', () => { this.view = 'list'; this.detailWrId = null; App.handleRoute(); });
    container.appendChild(backBtn);

    return container;
  },

  getValidNextStatuses(task) {
    const all = ['Draft', 'Assigned', 'In Progress', 'For Review', 'Completed', 'Cancelled'];
    if (task.status === 'Completed' || task.status === 'Cancelled') {
      return [task.status];
    }
    return all;
  },

  // ============================================================
  // Dependency Engine
  // ============================================================
  canStart(taskId) {
    const task = DB.getById('tasks', taskId);
    const preds = task?.predecessors || task?.dependencies || [];
    if (preds.length === 0) return true;
    return preds.every(pid => {
      const p = DB.getById('tasks', pid);
      return p && p.status === 'Completed';
    });
  },

  updateTaskStatus(taskId, newStatus) {
    const task = DB.getById('tasks', taskId);
    if (!task) return { error: 'Task not found.' };
    if (task.status === 'Completed' || task.status === 'Cancelled') {
      return { error: 'Completed and cancelled tasks are immutable.' };
    }
    if (newStatus === 'In Progress' && !this.canStart(taskId)) {
      return { error: 'Predecessor tasks must be completed first.' };
    }
    if (newStatus === 'Cancelled') {
      const dependents = DB.getWhere('tasks', t =>
        (t.predecessors || t.dependencies || []).includes(taskId)
      );
      dependents.forEach(d => DB.update('tasks', d.id, { status: 'Cancelled' }));
    }
    DB.update('tasks', taskId, { status: newStatus });
    return { success: true };
  },

  detectCycle(tasks) {
    const adj = {};
    tasks.forEach(t => { adj[t.id] = t.predecessors || t.dependencies || []; });
    const visited = new Set();
    const recStack = new Set();
    function dfs(node) {
      visited.add(node);
      recStack.add(node);
      for (const neighbor of adj[node] || []) {
        if (!visited.has(neighbor) && dfs(neighbor)) return true;
        if (recStack.has(neighbor)) return true;
      }
      recStack.delete(node);
      return false;
    }
    for (const node of Object.keys(adj)) {
      if (!visited.has(node) && dfs(node)) return true;
    }
    return false;
  }
};
