/**
 * Admin Panel — Users, Reset Data, Audit Log
 */

const Users = {
  view: 'users', // 'users' | 'audit' | 'pending'
  editingId: null,
  pendingDetailId: null,
  filters: {
    category: '',
    status: '',
    date: ''
  },

  render() {
    const container = el('div', { class: 'page' });

    const titleBar = el('div', { class: 'page-title-bar-v2' });
    const h1 = el('h1', { id: 'admin-breadcrumb-h1', class: 'breadcrumb-h1' });
    titleBar.appendChild(h1);
    container.appendChild(titleBar);
    this.updateBreadcrumb(h1);

    const isStaffOrManager = Auth.user.role !== 'Admin';

    if (isStaffOrManager) {
      // Initialize view state dynamically to prevent view state bleed-through
      if (this.lastUserId !== Auth.user.id) {
        this.lastUserId = Auth.user.id;
        const defaultToRequests = (Auth.user.role === 'Operations' || Auth.user.role === 'Manager');
        this.view = defaultToRequests ? 'myRequests' : 'myPending';
        this.filters = { category: '', status: '', dateFrom: '', dateTo: '' };
      }

      const showRequestsTab = (Auth.user.role === 'Operations' || Auth.user.role === 'Manager');
      if (this.view === 'myRequests' && !showRequestsTab) {
        this.view = 'myPending';
      }
      if (!['myPending', 'myRequests'].includes(this.view)) {
        this.view = showRequestsTab ? 'myRequests' : 'myPending';
      }

      // Redesigned staff tab bar: text-link style tab bar
      const tabs = el('div', { class: 'module-tab-nav' });
      tabs.style.marginBottom = '12px'; // align layout nicely below breadcrumb

      // Calculate counts for badges (pre-filtering) - only display unresolved/pending items
      const pendingItems = PendingChanges.getPendingForUser(Auth.user.id);
      const totalPending = pendingItems.length;

      const requestsItems = DB.getWhere('operationsRequests', r => r.requestedBy === Auth.user.id && r.status === 'pending');
      const totalRequests = requestsItems.length;

      // 1. Pending submissions tab
      const isPendingActive = this.view === 'myPending';
      const myPendingTab = el('button', {
        class: 'module-tab-link' + (isPendingActive ? ' active' : ''),
        type: 'button'
      });
      // Inline document icon
      const docIcon = el('span', {
        class: 'tab-icon',
        style: 'display: inline-flex; align-items: center;',
        html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'
      });
      myPendingTab.appendChild(docIcon);
      myPendingTab.appendChild(document.createTextNode(' My Pending Submissions'));
      
      // Count badge
      const pendingBadge = el('span', {
        class: 'circular-count-badge',
        text: String(totalPending)
      });
      myPendingTab.appendChild(pendingBadge);
      
      myPendingTab.addEventListener('click', () => {
        this.view = 'myPending';
        this.editingId = null;
        this.pendingDetailId = null;
        this.filters.category = '';
        this.filters.status = '';
        this.filters.dateFrom = '';
        this.filters.dateTo = '';
        App.handleRoute();
      });
      tabs.appendChild(myPendingTab);

      // 2. Requests tab (only for Operations and Manager)
      if (showRequestsTab) {
        const isRequestsActive = this.view === 'myRequests';
        const myRequestsTab = el('button', {
          class: 'module-tab-link' + (isRequestsActive ? ' active' : ''),
          type: 'button'
        });
        // Inline paper plane icon
        const planeIcon = el('span', {
          class: 'tab-icon',
          style: 'display: inline-flex; align-items: center;',
          html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>'
        });
        myRequestsTab.appendChild(planeIcon);
        myRequestsTab.appendChild(document.createTextNode(' My Requests'));
        
        // Count badge
        const requestsBadge = el('span', {
          class: 'circular-count-badge',
          text: String(totalRequests)
        });
        myRequestsTab.appendChild(requestsBadge);

        myRequestsTab.addEventListener('click', () => {
          this.view = 'myRequests';
          this.editingId = null;
          this.pendingDetailId = null;
          this.filters.category = '';
          this.filters.status = '';
          this.filters.dateFrom = '';
          this.filters.dateTo = '';
          App.handleRoute();
        });
        tabs.appendChild(myRequestsTab);
      }

      container.appendChild(tabs);

      // --- Filters Bar (matches other module filters) ---
      const filters = el('div', { class: 'filters-bar' });

      // 1. Categories select
      const catFilter = el('select', { class: 'form-select' });
      catFilter.appendChild(el('option', { value: '', text: 'All Categories' }));

      const categoriesList = this.view === 'myPending'
        ? [
            { value: 'invoices', text: 'Invoices' },
            { value: 'disbursements', text: 'Disbursements' },
            { value: 'transmittals', text: 'Transmittals' },
            { value: 'clients', text: 'Clients' },
            { value: 'tasks', text: 'Tasks' }
          ]
        : [
            { value: 'billing', text: 'Billing' },
            { value: 'disbursement', text: 'Disbursement' },
            { value: 'transmittal', text: 'Transmittal' }
          ];

      categoriesList.forEach(c => {
        catFilter.appendChild(el('option', { value: c.value, text: c.text }));
      });
      if (this.filters.category) catFilter.value = this.filters.category;
      filters.appendChild(wrapFilterFieldWithClear(catFilter));

      // 2. Statuses select
      const statusFilter = el('select', { class: 'form-select' });
      statusFilter.appendChild(el('option', { value: '', text: 'All Statuses' }));

      const statusList = this.view === 'myPending'
        ? [
            { value: 'pending', text: 'Pending' },
            { value: 'rejected', text: 'Rejected' }
          ]
        : [
            { value: 'pending', text: 'Pending' },
            { value: 'fulfilled', text: 'Fulfilled' },
            { value: 'rejected', text: 'Rejected' }
          ];

      statusList.forEach(s => {
        statusFilter.appendChild(el('option', { value: s.value, text: s.text }));
      });
      if (this.filters.status) statusFilter.value = this.filters.status;
      filters.appendChild(wrapFilterFieldWithClear(statusFilter));

      // 3. Date From/To inputs
      const dateFrom = el('input', { type: 'date', class: 'form-select' });
      const dateTo = el('input', { type: 'date', class: 'form-select' });
      if (this.filters.dateFrom) dateFrom.value = this.filters.dateFrom;
      if (this.filters.dateTo) dateTo.value = this.filters.dateTo;
      filters.appendChild(el('span', { text: 'From', style: 'font-size:0.8125rem;color:var(--color-text-muted);' }));
      filters.appendChild(wrapFilterFieldWithClear(dateFrom));
      filters.appendChild(el('span', { text: 'To', style: 'font-size:0.8125rem;color:var(--color-text-muted);' }));
      filters.appendChild(wrapFilterFieldWithClear(dateTo));

      // 4. Clear All button
      const clearBtn = el('button', {
        class: 'btn btn-secondary btn-sm',
        html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-3.5"></path></svg>Clear'
      });
      clearBtn.addEventListener('click', () => {
        catFilter.value = '';
        statusFilter.value = '';
        dateFrom.value = '';
        dateTo.value = '';
        this.filters = { category: '', status: '', dateFrom: '', dateTo: '' };
        App.handleRoute();
      });
      filters.appendChild(clearBtn);

      // Wire change events
      const refreshFilters = () => {
        this.filters.category = catFilter.value;
        this.filters.status = statusFilter.value;
        this.filters.dateFrom = dateFrom.value;
        this.filters.dateTo = dateTo.value;
        App.handleRoute();
      };
      catFilter.addEventListener('change', refreshFilters);
      statusFilter.addEventListener('change', refreshFilters);
      dateFrom.addEventListener('change', refreshFilters);
      dateTo.addEventListener('change', refreshFilters);

      container.appendChild(filters);

      // Render content
      if (this.view === 'myRequests') {
        container.appendChild(this.renderMyRequestsSection());
      } else {
        container.appendChild(this.renderMyPendingSection());
      }

    } else {
      // Admin user
      if (this.lastUserId !== Auth.user.id) {
        this.lastUserId = Auth.user.id;
        this.view = 'users';
      }
      if (!['users', 'audit', 'pending'].includes(this.view)) {
        this.view = 'users';
      }

      const tabs = el('div', { class: 'admin-tabs' });
      tabs.style.marginBottom = '20px';

      const usersTab = el('button', {
        class: 'btn ' + (this.view === 'users' ? 'btn-primary' : 'btn-secondary'),
        text: 'Users'
      });
      usersTab.addEventListener('click', () => { this.view = 'users'; this.editingId = null; this.pendingDetailId = null; App.handleRoute(); });
      tabs.appendChild(usersTab);

      const auditTab = el('button', {
        class: 'btn ' + (this.view === 'audit' ? 'btn-primary' : 'btn-secondary'),
        text: 'Audit Log'
      });
      auditTab.addEventListener('click', () => { this.view = 'audit'; this.editingId = null; this.pendingDetailId = null; App.handleRoute(); });
      tabs.appendChild(auditTab);

      const entity = Auth.activeEntity;
      const pendingDisbursements = DB.getWhere('disbursements', d => d.entity === entity && (d.status === 'Submitted' || d.status === 'Under Review'));
      let pendingChanges = PendingChanges.getAllPending();
      pendingChanges = pendingChanges.filter(pc => PendingChanges.canApproveChange(pc));
      const totalPending = pendingDisbursements.length + pendingChanges.length;

      const pendingTab = el('button', {
        class: 'btn ' + (this.view === 'pending' ? 'btn-primary' : 'btn-secondary'),
        text: 'Pending Approvals'
      });
      if (totalPending > 0) {
        const tabBadge = el('span', { class: 'nav-badge', style: 'margin-left:6px;', text: totalPending > 99 ? '99+' : String(totalPending) });
        pendingTab.appendChild(tabBadge);
      }
      pendingTab.addEventListener('click', () => { this.view = 'pending'; this.editingId = null; this.pendingDetailId = null; App.handleRoute(); });
      tabs.appendChild(pendingTab);

      container.appendChild(tabs);

      if (this.view === 'audit') {
        container.appendChild(this.renderAuditSection());
      } else if (this.view === 'pending') {
        container.appendChild(this.renderPendingSection());
      } else {
        container.appendChild(this.renderUsersSection());
      }
    }

    return container;
  },

  updateBreadcrumb(h1, subpage) {
    if (!h1) h1 = document.getElementById('admin-breadcrumb-h1');
    if (!h1) return;
    this.clearNode(h1);
    
    const isAdmin = Auth.user.role === 'Admin';
    
    if (this.pendingDetailId || subpage) {
      const baseLink = el('a', { href: 'javascript:void(0)', class: 'breadcrumb-base', text: isAdmin ? 'Admin' : 'My Submissions' });
      baseLink.addEventListener('click', () => {
        this.pendingDetailId = null;
        this.editingId = null;
        if (isAdmin) {
          this.showUserList();
        }
        App.handleRoute();
      });
      h1.appendChild(baseLink);
      h1.appendChild(el('span', { class: 'breadcrumb-sep', text: ' / ' }));
      
      let label = 'Detail';
      if (this.pendingDetailId) {
        label = 'Review Pending Change';
      } else if (subpage) {
        label = subpage;
      }
      h1.appendChild(document.createTextNode(label));
    } else {
      h1.appendChild(document.createTextNode(isAdmin ? 'Admin' : 'My Submissions'));
    }
  },

  init() {},

  // ============================================================
  // Users Section
  // ============================================================
  renderUsersSection() {
    const wrapper = el('div');

    // Reset Demo Data section
    const resetSection = el('div', { class: 'reset-section' });
    resetSection.appendChild(el('h3', { text: 'Reset Demo Data' }));
    resetSection.appendChild(el('p', { text: 'This will reset all data to the original demo state. This action cannot be undone.' }));
    const resetBtn = el('button', { class: 'btn btn-danger', text: 'Reset Demo Data' });
    resetBtn.addEventListener('click', () => this.handleReset(resetSection));
    resetSection.appendChild(resetBtn);
    wrapper.appendChild(resetSection);

    // Actions bar
    const actions = el('div', { class: 'actions-bar' });
    const addBtn = el('button', { class: 'btn btn-primary', text: 'Add User' });
    addBtn.addEventListener('click', () => this.showUserForm());
    actions.appendChild(addBtn);
    wrapper.appendChild(actions);

    // List container
    const listContainer = el('div', { class: 'list-container' });
    wrapper.appendChild(listContainer);
    this.renderUserList(listContainer);

    // Form container
    const formContainer = el('div', { class: 'form-container hidden' });
    wrapper.appendChild(formContainer);

    return wrapper;
  },

  clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  },

  renderUserList(container) {
    this.clearNode(container);
    const users = DB.getAll('users');

    if (users.length === 0) {
      container.appendChild(renderEmptyStateV2({
        variant: 'zero-state',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
        title: 'No users found',
        body: 'Add users to start managing credentials and roles.'
      }));
      return;
    }

    const table = el('table', { class: 'data-table' });
    const thead = el('thead');
    const thr = el('tr');
    ['Name', 'Email', 'Role', 'Entities', 'Actions'].forEach(h => thr.appendChild(el('th', { text: h })));
    thead.appendChild(thr);
    table.appendChild(thead);

    const tbody = el('tbody');
    users.forEach(u => {
      const tr = el('tr');
      tr.appendChild(el('td', { text: u.name }));
      tr.appendChild(el('td', { text: u.email }));
      tr.appendChild(el('td')).appendChild(this.roleBadge(u.role));
      tr.appendChild(el('td', { text: (u.entities || []).join(', ') }));
      const tdAct = el('td');
      const editBtn = el('button', { class: 'btn btn-secondary btn-sm', text: 'Edit' });
      editBtn.addEventListener('click', () => this.showUserForm(u.id));
      tdAct.appendChild(editBtn);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  },

  roleBadge(role) {
    const map = {
      'Admin': 'badge-danger',
      'Manager': 'badge-warning',
      'Accounting': 'badge-info',
      'Operations': 'badge-success',
      'Documentation': 'badge-primary',
      'HR': 'badge-secondary'
    };
    return el('span', { class: 'badge ' + (map[role] || ''), text: role });
  },

  showUserForm(userId) {
    const container = document.querySelector('#content .form-container');
    const list = document.querySelector('#content .list-container');
    const actions = document.querySelector('#content .actions-bar');
    const resetSection = document.querySelector('#content .reset-section');
    if (container) container.classList.remove('hidden');
    if (list) list.classList.add('hidden');
    if (actions) actions.classList.add('hidden');
    if (resetSection) resetSection.classList.add('hidden');

    this.editingId = userId || null;
    this.updateBreadcrumb(null, userId ? 'Edit User' : 'Add User');
    const user = userId ? DB.getById('users', userId) : null;

    this.clearNode(container);
    container.appendChild(el('h2', { text: userId ? 'Edit User' : 'Add User' }));

    const form = el('form', { class: 'form-stacked user-form' });

    // Name
    const nameGroup = el('div', { class: 'form-group' });
    nameGroup.appendChild(el('label', { text: 'Name *' }));
    nameGroup.appendChild(el('input', { type: 'text', name: 'name', value: user ? user.name : '', required: true }));
    nameGroup.appendChild(el('span', { class: 'field-error hidden', text: '' }));
    form.appendChild(nameGroup);

    // Email
    const emailGroup = el('div', { class: 'form-group' });
    emailGroup.appendChild(el('label', { text: 'Email *' }));
    emailGroup.appendChild(el('input', { type: 'email', name: 'email', value: user ? user.email : '', required: true }));
    emailGroup.appendChild(el('span', { class: 'field-error hidden', text: '' }));
    form.appendChild(emailGroup);

    // Password
    const pwGroup = el('div', { class: 'form-group' });
    pwGroup.appendChild(el('label', { text: userId ? 'Password (leave blank to keep current)' : 'Password *' }));
    pwGroup.appendChild(el('input', { type: 'password', name: 'password', required: !userId }));
    pwGroup.appendChild(el('span', { class: 'field-error hidden', text: '' }));
    form.appendChild(pwGroup);

    // Role
    const roleGroup = el('div', { class: 'form-group' });
    roleGroup.appendChild(el('label', { text: 'Role *' }));
    const roleSel = el('select', { name: 'role', required: true });
    Auth.ALL_ROLES.forEach(r => {
      const opt = el('option', { value: r, text: r });
      if (user && user.role === r) opt.selected = true;
      roleSel.appendChild(opt);
    });
    roleGroup.appendChild(roleSel);
    roleGroup.appendChild(el('span', { class: 'field-error hidden', text: '' }));
    form.appendChild(roleGroup);

    // Entity access
    const entityGroup = el('div', { class: 'form-group' });
    entityGroup.appendChild(el('label', { text: 'Entity Access *' }));
    const entityWrap = el('div', { class: 'entity-checkboxes' });
    ['ATA', 'LTA'].forEach(e => {
      const label = el('label', { class: 'checkbox-label' });
      const cb = el('input', { type: 'checkbox', name: 'entities', value: e });
      if (user && user.entities && user.entities.includes(e)) cb.checked = true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + e));
      entityWrap.appendChild(label);
    });
    entityGroup.appendChild(entityWrap);
    entityGroup.appendChild(el('span', { class: 'field-error hidden', text: '' }));
    form.appendChild(entityGroup);

    const btnGroup = el('div', { class: 'form-group form-actions' });
    const saveBtn = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Save User' });
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.showUserList());
    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(cancelBtn);
    form.appendChild(btnGroup);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitUserForm(form);
    });

    container.appendChild(form);
  },

  showUserList() {
    this.editingId = null;
    const container = document.querySelector('#content .form-container');
    const list = document.querySelector('#content .list-container');
    const actions = document.querySelector('#content .actions-bar');
    const resetSection = document.querySelector('#content .reset-section');
    if (container) { this.clearNode(container); container.classList.add('hidden'); }
    if (list) list.classList.remove('hidden');
    if (actions) actions.classList.remove('hidden');
    if (resetSection) resetSection.classList.remove('hidden');
    this.renderUserList(list);
    this.updateBreadcrumb(null);
  },

  submitUserForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const entityCheckboxes = form.querySelectorAll('input[name="entities"]:checked');
    const entities = Array.from(entityCheckboxes).map(cb => cb.value);

    // Clear previous errors
    form.querySelectorAll('.field-error').forEach(e => { e.classList.add('hidden'); e.textContent = ''; });

    const errors = [];
    if (!data.name || data.name.trim().length < 2) {
      errors.push({ field: 'name', msg: 'Name is required (min 2 characters).' });
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push({ field: 'email', msg: 'Please enter a valid email address.' });
    }
    if (!this.editingId && (!data.password || data.password.length < 1)) {
      errors.push({ field: 'password', msg: 'Password is required for new users.' });
    }
    if (entities.length === 0) {
      errors.push({ field: 'entities', msg: 'At least one entity must be selected.' });
    }

    if (errors.length > 0) {
      errors.forEach(err => {
        const group = form.querySelector('[name="' + err.field + '"]')?.closest('.form-group');
        if (group) {
          const elErr = group.querySelector('.field-error');
          if (elErr) {
            elErr.textContent = err.msg;
            elErr.classList.remove('hidden');
          }
        }
      });
      return;
    }

    const record = {
      name: data.name.trim(),
      email: data.email.trim(),
      role: data.role,
      entities: entities,
      isActive: true
    };

    if (this.editingId) {
      if (data.password && data.password.trim()) {
        record.password = data.password.trim();
      }
      DB.update('users', this.editingId, record);
    } else {
      record.id = generateId('u');
      record.password = data.password.trim();
      record.createdAt = new Date().toISOString();
      DB.insert('users', record);
    }

    this.showUserList();
  },

  // ============================================================
  // Reset Demo Data
  // ============================================================
  handleReset(section) {
    // Remove any existing confirmation
    const existing = section.querySelector('.reset-confirm');
    if (existing) existing.remove();

    const confirmWrap = el('div', { class: 'reset-confirm' });
    confirmWrap.appendChild(el('span', { text: 'Are you sure? This will erase all changes.', style: 'color: var(--color-danger); font-size: 0.875rem;' }));
    const yesBtn = el('button', { class: 'btn btn-danger btn-sm', text: 'Yes, Reset' });
    const noBtn = el('button', { class: 'btn btn-secondary btn-sm', text: 'Cancel' });
    confirmWrap.appendChild(yesBtn);
    confirmWrap.appendChild(noBtn);
    section.appendChild(confirmWrap);

    yesBtn.addEventListener('click', () => {
      DB.resetToSeed();
      const msg = el('p', { text: 'Data reset successfully. Reloading...', style: 'color: var(--color-success); margin-top: var(--spacing-sm);' });
      section.appendChild(msg);
      setTimeout(() => location.reload(), 800);
    });

    noBtn.addEventListener('click', () => confirmWrap.remove());
  },

  // ============================================================
  // Audit Log
  // ============================================================
  renderAuditSection() {
    const wrapper = el('div');
    const canViewAllAudit = Auth.can('audit:view_all');

    // Filters
    const filters = el('div', { class: 'audit-filters' });

    const userFilter = el('select', { class: 'form-select' });
    userFilter.appendChild(el('option', { value: '', text: 'All Users' }));
    const users = DB.getAll('users');
    users.forEach(u => {
      const opt = el('option', { value: u.id, text: u.name });
      userFilter.appendChild(opt);
    });
    if (!canViewAllAudit) {
      userFilter.value = Auth.user.id;
      userFilter.disabled = true;
    }
    filters.appendChild(wrapFilterFieldWithClear(userFilter));

    // Client Filter
    const clientOptions = [{ value: '', text: 'All Clients' }];
    DB.getAll('clients').forEach(c => {
      clientOptions.push({ value: c.id, text: c.name });
    });
    const clientFilter = createSearchableDropdown({ placeholder: 'All Clients', options: clientOptions });
    filters.appendChild(clientFilter);

    filters.appendChild(el('span', { text: 'From:', style: 'font-size: 0.875rem; color: var(--color-text-muted);' }));
    const dateFrom = el('input', { type: 'date', class: 'form-select' });
    filters.appendChild(wrapFilterFieldWithClear(dateFrom));

    filters.appendChild(el('span', { text: 'To:', style: 'font-size: 0.875rem; color: var(--color-text-muted);' }));
    const dateTo = el('input', { type: 'date', class: 'form-select' });
    filters.appendChild(wrapFilterFieldWithClear(dateTo));

    const clearBtn = el('button', { class: 'btn btn-secondary', text: 'Clear' });
    clearBtn.addEventListener('click', () => {
      if (canViewAllAudit) userFilter.value = '';
      clientFilter.value = '';
      dateFrom.value = '';
      dateTo.value = '';
      this.refreshAuditLog(tableContainer, canViewAllAudit ? '' : Auth.user.id, '', '', '', '');
    });
    filters.appendChild(clearBtn);

    wrapper.appendChild(filters);

    const tableContainer = el('div');
    wrapper.appendChild(tableContainer);

    const triggerRefresh = () => {
      this.refreshAuditLog(tableContainer, userFilter.value, clientFilter.value, clientFilter.searchText, dateFrom.value, dateTo.value);
    };

    userFilter.addEventListener('change', triggerRefresh);
    clientFilter.addEventListener('change', triggerRefresh);
    clientFilter.addEventListener('input', triggerRefresh);
    dateFrom.addEventListener('change', triggerRefresh);
    dateTo.addEventListener('change', triggerRefresh);

    this.refreshAuditLog(tableContainer, canViewAllAudit ? '' : Auth.user.id, '', '', '', '');

    return wrapper;
  },

  refreshAuditLog(container, userId, clientId, clientSearchText, dateFrom, dateTo) {
    this.clearNode(container);
    let logs = DB.getAll('auditLog');

    if (userId) {
      logs = logs.filter(l => l.userId === userId);
    }

    if (clientId || (clientSearchText && clientSearchText.trim() !== '')) {
      const selectedClient = clientId ? DB.getById('clients', clientId) : null;
      if (selectedClient && selectedClient.name === clientSearchText) {
        logs = logs.filter(l => {
          if (!l.details) return false;
          const detailsLower = l.details.toLowerCase();
          return detailsLower.includes(clientId.toLowerCase()) ||
                 detailsLower.includes(selectedClient.name.toLowerCase());
        });
      } else if (clientSearchText && clientSearchText.trim() !== '') {
        const query = clientSearchText.trim().toLowerCase();
        const matchingClients = DB.getAll('clients').filter(c =>
          c.id.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
        );
        logs = logs.filter(l => {
          if (!l.details) return false;
          const detailsLower = l.details.toLowerCase();
          if (detailsLower.includes(query)) return true;
          return matchingClients.some(c =>
            detailsLower.includes(c.id.toLowerCase()) || detailsLower.includes(c.name.toLowerCase())
          );
        });
      }
    }

    if (dateFrom) {
      const from = new Date(dateFrom + 'T00:00:00');
      logs = logs.filter(l => new Date(l.timestamp) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59');
      logs = logs.filter(l => new Date(l.timestamp) <= to);
    }

    // Sort newest first
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (logs.length === 0) {
      container.appendChild(el('p', { text: 'No audit log entries found.', class: 'empty-state' }));
      return;
    }

    const table = el('table', { class: 'data-table' });
    const thead = el('thead');
    const thr = el('tr');
    ['Timestamp', 'User', 'Action', 'Entity', 'Details'].forEach(h => thr.appendChild(el('th', { text: h })));
    thead.appendChild(thr);
    table.appendChild(thead);

    const tbody = el('tbody');
    logs.forEach(l => {
      const user = DB.getById('users', l.userId);
      const tr = el('tr');
      const ts = new Date(l.timestamp);
      tr.appendChild(el('td', { text: formatDate(l.timestamp) + ' ' + ts.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) }));
      tr.appendChild(el('td', { text: user ? user.name : l.userId }));
      tr.appendChild(el('td', { text: l.action }));
      tr.appendChild(el('td')).appendChild(el('span', { class: 'badge badge-' + (l.entity === 'ATA' ? 'ata' : 'lta'), text: l.entity }));
      tr.appendChild(el('td', { text: l.details || '—' }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  },

  // ============================================================
  // Pending Approvals Section (merged: PendingChanges + Disbursement Submissions)
  // ============================================================
  renderPendingSection() {
    const wrapper = el('div');

    if (this.pendingDetailId) {
      wrapper.appendChild(this.renderPendingDetail(this.pendingDetailId));
      return wrapper;
    }

    const entity = Auth.activeEntity;
    let pendingChanges = PendingChanges.getAllPending();
    pendingChanges = pendingChanges.filter(pc => PendingChanges.canApproveChange(pc));
    const pendingDisbursements = DB.getWhere('disbursements', d => d.entity === entity && (d.status === 'Submitted' || d.status === 'Under Review'));

    if (pendingChanges.length === 0 && pendingDisbursements.length === 0) {
      wrapper.appendChild(el('p', { text: 'No pending approvals.', class: 'empty-state' }));
      return wrapper;
    }

    const headerBar = el('div', { class: 'form-header-bar', style: 'margin-bottom: 20px;' });
    headerBar.appendChild(el('h2', { text: 'Pending Approvals Queue', style: 'margin: 0;' }));
    wrapper.appendChild(headerBar);

    // View Mode Toggle
    const viewMode = App.getPreferredViewMode('pendingApprovals') || 'board';
    const vmToggle = el('div', { class: 'view-mode-toggle', style: 'margin-bottom: var(--spacing-md);' });
    const vmTable = el('button', { html: ViewIcons.table + ' Table', class: viewMode === 'table' ? 'active' : '' });
    const vmBoard = el('button', { html: ViewIcons.board + ' Board', class: viewMode === 'board' ? 'active' : '' });
    const vmList = el('button', { html: ViewIcons.list + ' List', class: viewMode === 'list' ? 'active' : '' });
    vmTable.addEventListener('click', () => { App.setPreferredViewMode('pendingApprovals', 'table'); App.handleRoute(); });
    vmBoard.addEventListener('click', () => { App.setPreferredViewMode('pendingApprovals', 'board'); App.handleRoute(); });
    vmList.addEventListener('click', () => { App.setPreferredViewMode('pendingApprovals', 'list'); App.handleRoute(); });
    vmToggle.appendChild(vmTable);
    vmToggle.appendChild(vmBoard);
    vmToggle.appendChild(vmList);
    wrapper.appendChild(vmToggle);

    const contentContainer = el('div');
    wrapper.appendChild(contentContainer);

    const items = [
      ...pendingDisbursements.map(d => ({
        type: 'disbursement',
        id: d.id,
        title: `Expense: ${d.category}`,
        subtitle: d.description || 'No description provided',
        amount: d.amount,
        submittedBy: d.requestedBy,
        submittedAt: d.submittedAt,
        raw: d
      })),
      ...pendingChanges.map(pc => {
        const typeStr = pc.parentRecordId ? 'Edit' : 'New';
        const data = pc.proposedData || {};
        let title = `${pc.table.charAt(0).toUpperCase() + pc.table.slice(1)}`;
        let subtitle = `Pending approval for structural change (${typeStr})`;
        let amount = null;
        
        if (pc.table === 'workRequests') {
          title = `Work Request: ${data.title}`;
        } else if (pc.table === 'invoices') {
          title = `Invoice: #${data.invoiceNumber || data.id}`;
          amount = data.total;
        } else if (pc.table === 'transmittals') {
          title = `Transmittal: #${data.transmittalNumber || data.id}`;
        } else if (pc.table === 'tasks') {
           const wrId = data.workRequestId;
           const wr = wrId ? DB.getById('workRequests', wrId) : null;
           title = `Task: ${data.title}`;
           subtitle = wr ? `For WR: ${wr.title}` : 'Pending task approval';
         } else if (pc.table === 'clients') {
          title = `Client: ${data.name}`;
        }
        
        return {
          type: 'change',
          id: pc.id,
          title,
          subtitle,
          amount,
          submittedBy: pc.submittedBy,
          submittedAt: pc.submittedAt,
          raw: pc
        };
      })
    ];

    // Sort by submittedAt descending
    items.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    if (viewMode === 'table') {
      this.renderTableView(contentContainer, items);
    } else if (viewMode === 'list') {
      this.renderListView(contentContainer, items);
    } else {
      this.renderBoardView(contentContainer, items);
    }

    return wrapper;
  },

  renderBoardView(container, items) {
    if (items.length === 0) {
      container.appendChild(renderEmptyStateV2({
        variant: 'zero-state',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        title: 'No pending submissions',
        body: 'Submitted billing and expense requests will appear here for review.'
      }));
      return;
    }

    const self = this;
    let expNumber = 1;
    let billNumber = 1;

    KanbanBoard.render({
      container,
      items,
      getColumnKey: item => item.type === 'disbursement' ? 'expense' : 'billing',
      columns: [
        {
          key: 'expense',
          label: 'Expense Submissions',
          targetStatus: 'expense',
          color: '#f59e0b',
          emptyState: { variant: 'compact', title: 'No expense submissions', body: '' }
        },
        {
          key: 'billing',
          label: 'Billing Submissions',
          targetStatus: 'billing',
          color: '#3b82f6',
          emptyState: { variant: 'compact', title: 'No billing submissions', body: '' }
        }
      ],
      renderCard(item) {
        const submitter = DB.getById('users', item.submittedBy);
        const avatars = submitter ? [{ name: submitter.name, avatarUrl: submitter.avatarUrl }] : [];
        const isExpense = item.type === 'disbursement';
        const key = (isExpense ? 'EXP-' : 'BIL-') + (isExpense ? expNumber++ : billNumber++);
        const color = isExpense ? '#f59e0b' : '#3b82f6';

        const card = buildCompactBoardCard({
          key,
          statusColor: color,
          title: item.title,
          description: item.subtitle,
          date: item.submittedAt ? formatDate(item.submittedAt) : '',
          priority: isExpense ? 'Expense' : 'Billing',
          priorityClass: isExpense ? 'card-v2-priority-medium' : 'card-v2-priority-normal',
          avatars,
          onClick: () => {
            if (isExpense) {
              location.hash = '#disbursement/detail/' + item.id;
            } else {
              self.pendingDetailId = item.id;
              App.handleRoute();
            }
          }
        });

        const footerRight = card.querySelector('.card-v2-footer-right');
        if (item.amount !== null && item.amount !== undefined) {
          footerRight.appendChild(el('div', { class: 'card-v2-footer-item', text: formatPHP(item.amount), style: 'font-weight:700;color:var(--color-text);' }));
        }
        return card;
      },
      cardMenuItems(item) {
        return [{
          label: 'View Details',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
          onClick: () => {
            if (item.type === 'disbursement') {
              location.hash = '#disbursement/detail/' + item.id;
            } else {
              self.pendingDetailId = item.id;
              App.handleRoute();
            }
          }
        }];
      },
      drag: { enabled: false }
    });
  },

  renderTableView(container, items) {
    const table = el('table', { class: 'data-table' });
    const thead = el('thead');
    const thr = el('tr');
    ['Type', 'Title / Description', 'Amount', 'Submitted By', 'Date', 'Actions'].forEach(h => thr.appendChild(el('th', { text: h })));
    thead.appendChild(thr);
    table.appendChild(thead);
    
    const tbody = el('tbody');
    items.forEach(item => {
      const submitter = DB.getById('users', item.submittedBy);
      const tr = el('tr', { style: 'cursor: pointer;' });
      tr.addEventListener('click', () => {
        if (item.type === 'disbursement') {
          location.hash = '#disbursement/detail/' + item.id;
        } else {
          this.pendingDetailId = item.id;
          App.handleRoute();
        }
      });
      
      // Type
      const tdType = el('td');
      const badgeColor = item.type === 'disbursement' ? '#f59e0b' : '#3b82f6';
      const badgeBg = item.type === 'disbursement' ? '#fef3c7' : '#dbeafe';
      const badgeText = item.type === 'disbursement' ? 'Expense' : 'Billing';
      tdType.appendChild(el('span', {
        text: badgeText,
        style: `font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor};`
      }));
      tr.appendChild(tdType);
      
      // Title / Description
      const tdTitle = el('td');
      tdTitle.appendChild(el('div', { text: item.title, style: 'font-weight: 600; color: var(--color-text);' }));
      tdTitle.appendChild(el('div', { text: item.subtitle, style: 'font-size: 0.75rem; color: var(--color-text-muted); margin-top: 2px;' }));
      tr.appendChild(tdTitle);
      
      // Amount
      const tdAmount = el('td', { text: item.amount !== null && item.amount !== undefined ? formatPHP(item.amount) : '—' });
      tr.appendChild(tdAmount);
      
      // Submitted By
      const tdUser = el('td', { text: submitter ? submitter.name : '—' });
      tr.appendChild(tdUser);
      
      // Date
      const tdDate = el('td', { text: formatDate(item.submittedAt) });
      tr.appendChild(tdDate);
      
      // Actions
      const tdAct = el('td');
      const reviewBtn = el('button', { class: 'btn btn-secondary btn-sm', text: 'Review' });
      tdAct.appendChild(reviewBtn);
      tr.appendChild(tdAct);
      
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  },

  renderListView(container, items) {
    const list = el('div', { class: 'list-view' });
    items.forEach(item => {
      const submitter = DB.getById('users', item.submittedBy);
      const row = el('div', { class: 'list-item', style: 'cursor: pointer;' });
      row.addEventListener('click', () => {
        if (item.type === 'disbursement') {
          location.hash = '#disbursement/detail/' + item.id;
        } else {
          this.pendingDetailId = item.id;
          App.handleRoute();
        }
      });
      
      const badgeColor = item.type === 'disbursement' ? '#f59e0b' : '#3b82f6';
      const badgeBg = item.type === 'disbursement' ? '#fef3c7' : '#dbeafe';
      const badgeText = item.type === 'disbursement' ? 'Expense' : 'Billing';
      
      const leftPart = el('div', { style: 'display: flex; align-items: center; gap: 12px;' });
      leftPart.appendChild(el('span', {
        text: badgeText,
        style: `font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor}; min-width: 60px; text-align: center;`
      }));
      
      const textInfo = el('div');
      textInfo.appendChild(el('div', { class: 'list-item-title', text: item.title }));
      
      let metaText = `Submitted by ${submitter ? submitter.name : 'System'} on ${formatDate(item.submittedAt)}`;
      if (item.amount !== null && item.amount !== undefined) {
        metaText += ` | Amount: ${formatPHP(item.amount)}`;
      }
      textInfo.appendChild(el('div', { class: 'list-item-meta', text: metaText }));
      leftPart.appendChild(textInfo);
      row.appendChild(leftPart);
      
      const rightWrap = el('div', { style: 'margin-left: auto;' });
      rightWrap.appendChild(el('button', { class: 'btn btn-secondary btn-sm', text: 'Review' }));
      row.appendChild(rightWrap);
      
      list.appendChild(row);
    });
    container.appendChild(list);
  },

  renderMyPendingSection() {
    const wrapper = el('div');

    if (this.pendingDetailId) {
      wrapper.appendChild(this.renderPendingDetail(this.pendingDetailId));
      return wrapper;
    }

    let pending = PendingChanges.getPendingForUser(Auth.user.id);
    let rejected = PendingChanges.getRejectedForUser(Auth.user.id);

    // Apply category filter
    if (this.filters.category) {
      pending = pending.filter(pc => pc.table === this.filters.category);
      rejected = rejected.filter(pc => pc.table === this.filters.category);
    }

    // Apply status filter
    if (this.filters.status) {
      pending = pending.filter(pc => pc.status === this.filters.status);
      rejected = rejected.filter(pc => pc.status === this.filters.status);
    }

    // Apply date range filter
    if (this.filters.dateFrom || this.filters.dateTo) {
      const filterFn = (pc) => {
        if (!pc.submittedAt) return false;
        const itemDate = new Date(pc.submittedAt);
        const itemISO = itemDate.getFullYear() + '-' + String(itemDate.getMonth() + 1).padStart(2, '0') + '-' + String(itemDate.getDate()).padStart(2, '0');
        if (this.filters.dateFrom && itemISO < this.filters.dateFrom) return false;
        if (this.filters.dateTo && itemISO > this.filters.dateTo) return false;
        return true;
      };
      pending = pending.filter(filterFn);
      rejected = rejected.filter(filterFn);
    }

    if (pending.length === 0 && rejected.length === 0) {
      const isFiltered = this.filters.category || this.filters.status || this.filters.dateFrom || this.filters.dateTo;
      wrapper.appendChild(renderEmptyStateV2({
        variant: isFiltered ? 'filtered-empty' : 'zero-state',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
        title: isFiltered ? 'No matching submissions' : 'No pending submissions',
        body: isFiltered ? 'Try clearing or modifying your filter criteria.' : 'Your pending change requests will appear here once submitted.'
      }));
      return wrapper;
    }

    if (pending.length > 0) {
      const table = el('table', { class: 'data-table' });
      const thead = el('thead');
      const thr = el('tr');
      ['Table', 'Date', 'Type', 'Status', 'Actions'].forEach(h => thr.appendChild(el('th', { text: h })));
      thead.appendChild(thr);
      table.appendChild(thead);

      const tbody = el('tbody');
      pending.forEach(pc => {
        const tr = el('tr');
        tr.appendChild(el('td', { text: pc.table }));
        tr.appendChild(el('td', { text: formatDate(pc.submittedAt) }));
        tr.appendChild(el('td', { text: pc.parentRecordId ? 'Edit' : 'New' }));
        tr.appendChild(el('td', { text: pc.status }));

        const tdAct = el('td');
        
        const reviewBtn = el('button', { class: 'btn btn-primary btn-sm', text: 'Review', style: 'margin-right: 4px;' });
        reviewBtn.addEventListener('click', () => {
          this.pendingDetailId = pc.id;
          App.handleRoute();
        });
        tdAct.appendChild(reviewBtn);

        if (pc.status === 'pending') {
          const withdrawBtn = el('button', { class: 'btn btn-danger btn-sm', text: 'Withdraw' });
          withdrawBtn.addEventListener('click', () => {
            Workflow.showConfirm('Confirm Withdrawal', 'Are you sure you want to withdraw this pending submission?', () => {
              PendingChanges.delete(pc.id);
              App.handleRoute();
            }, 'danger');
          });
          tdAct.appendChild(withdrawBtn);
        }

        tr.appendChild(tdAct);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrapper.appendChild(table);
    }

    if (rejected.length > 0) {
      wrapper.appendChild(el('h3', { text: 'Rejected Submissions', style: 'margin-top:var(--spacing-lg);' }));
      const table = el('table', { class: 'data-table' });
      const thead = el('thead');
      const thr = el('tr');
      ['Table', 'Date', 'Type', 'Rejection Reason', 'Actions'].forEach(h => thr.appendChild(el('th', { text: h })));
      thead.appendChild(thr);
      table.appendChild(thead);

      const tbody = el('tbody');
      rejected.forEach(pc => {
        const tr = el('tr');
        tr.appendChild(el('td', { text: pc.table }));
        tr.appendChild(el('td', { text: formatDate(pc.submittedAt) }));
        tr.appendChild(el('td', { text: pc.parentRecordId ? 'Edit' : 'New' }));
        tr.appendChild(el('td', { text: pc.rejectionReason || '—', style: 'color:var(--color-danger);font-weight:600;word-break:break-word;' }));

        const tdAct = el('td');
        
        // Keep only Review (blue) and Dismiss (red) buttons inline in the table
        const reviewBtn = el('button', { class: 'btn btn-primary btn-sm', text: 'Review', style: 'margin-right: 4px;' });
        reviewBtn.addEventListener('click', () => {
          this.pendingDetailId = pc.id;
          App.handleRoute();
        });
        tdAct.appendChild(reviewBtn);

        const dismissBtn = el('button', { class: 'btn btn-danger btn-sm', text: 'Dismiss' });
        dismissBtn.addEventListener('click', () => {
          Workflow.showConfirm('Confirm Dismissal', 'Are you sure you want to dismiss and clear this rejected submission?', () => {
            PendingChanges.delete(pc.id);
            App.handleRoute();
          }, 'danger');
        });
        tdAct.appendChild(dismissBtn);

        tr.appendChild(tdAct);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrapper.appendChild(table);
    }

    return wrapper;
  },

  renderPendingDetail(pendingId) {
    const pc = PendingChanges.getById(pendingId);
    if (!pc) {
      this.pendingDetailId = null;
      return renderEmptyStateV2({
        variant: 'zero-state',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        title: 'Pending change not found',
        body: 'The requested pending change could not be loaded.'
      });
    }

    const canApprove = PendingChanges.canApproveChange(pc);
    const isSubmitter = pc.submittedBy === Auth.user.id;

    const wrapper = el('div', { style: 'max-width: 800px; margin: 0 auto;' });
    
    // Header
    const header = el('div', { class: 'form-header-bar', style: 'border-bottom: 1px solid var(--color-border); padding-bottom: 16px; margin-bottom: 24px;' });
    header.appendChild(el('h2', { text: 'Review Pending Change Request', style: 'margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--color-primary);' }));
    
    const backBtn = el('button', { class: 'btn btn-secondary btn-sm', text: '← Back to List' });
    backBtn.addEventListener('click', () => {
      this.pendingDetailId = null;
      App.handleRoute();
    });
    header.appendChild(backBtn);
    wrapper.appendChild(header);

    // Meta Card
    const submitter = DB.getById('users', pc.submittedBy);
    const metaCard = el('div', {
      class: 'card',
      style: 'border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;'
    });

    const addMeta = (label, val) => {
      const g = el('div');
      g.appendChild(el('div', { text: label, style: 'font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 4px;' }));
      g.appendChild(el('div', { text: val, style: 'font-size: 0.875rem; font-weight: 500; color: var(--color-text);' }));
      metaCard.appendChild(g);
    };

    const niceTableName = pc.table.charAt(0).toUpperCase() + pc.table.slice(1).replace(/([A-Z])/g, ' $1');
    addMeta('Record Entity/Table', niceTableName);
    addMeta('Submitted By', submitter ? submitter.name : pc.submittedBy);
    addMeta('Submission Date', formatDate(pc.submittedAt));
    
    wrapper.appendChild(metaCard);

    // If it's an invoice, show the proposed invoice fields for verification
    if (pc.table === 'invoices') {
      const proposed = pc.proposedData;
      const client = proposed ? DB.getById('clients', proposed.clientId) : null;
      const wr = proposed && proposed.workRequestId ? DB.getById('workRequests', proposed.workRequestId) : null;

      const invoiceReviewSection = el('div', { class: 'form-section', style: 'margin-bottom: 24px;' });
      invoiceReviewSection.appendChild(el('h3', { text: '📄 Invoice / Billing Details', style: 'font-size: 1rem; font-weight: 600; color: var(--color-primary); margin-bottom: 12px;' }));

      const invoiceCard = el('div', { class: 'card', style: 'border-radius: 8px; padding: 20px;' });

      // Meta Grid
      const grid = el('div', { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 16px;' });

      const addGridField = (lbl, val) => {
        const field = el('div');
        field.appendChild(el('div', { text: lbl, style: 'font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 4px;' }));
        field.appendChild(el('div', { text: val, style: 'font-size: 0.875rem; font-weight: 600; color: var(--color-text);' }));
        grid.appendChild(field);
      };

      addGridField('Invoice Number', proposed ? proposed.invoiceNumber : '—');
      addGridField('Client', client ? client.name : '—');
      addGridField('Work Request / Project', wr ? wr.title : '—');
      addGridField('Issue Date', proposed ? formatDate(proposed.issueDate) : '—');
      addGridField('Due Date', proposed ? formatDate(proposed.dueDate) : '—');
      addGridField('Total Amount', proposed ? formatPHP(proposed.total) : '—');

      invoiceCard.appendChild(grid);

      // Line Items Sub-table
      if (proposed && Array.isArray(proposed.lineItems) && proposed.lineItems.length > 0) {
        invoiceCard.appendChild(el('div', { text: 'Line Items', style: 'font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 8px; margin-top: 12px;' }));
        const liTable = el('table', { class: 'data-table', style: 'width: 100%; font-size: 0.8125rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px;' });
        const liThead = el('thead');
        const liThr = el('tr');
        ['Type', 'Description', 'Amount'].forEach(h => liThr.appendChild(el('th', { text: h, style: 'text-align: left; padding: 8px;' })));
        liThead.appendChild(liThr);
        liTable.appendChild(liThead);

        const liTbody = el('tbody');
        proposed.lineItems.forEach(item => {
          const tr = el('tr');
          tr.appendChild(el('td', { text: item.type, style: 'padding: 8px;' }));
          tr.appendChild(el('td', { text: item.description, style: 'padding: 8px;' }));
          tr.appendChild(el('td', { text: formatPHP(item.amount), style: 'padding: 8px; font-weight: 600;' }));
          liTbody.appendChild(tr);
        });
        liTable.appendChild(liTbody);
        invoiceCard.appendChild(liTable);
      }

      invoiceReviewSection.appendChild(invoiceCard);
      wrapper.appendChild(invoiceReviewSection);
    }

    // Diff / Change Details Section
    const diffSection = el('div', { class: 'form-section', style: 'margin-bottom: 24px;' });
    diffSection.appendChild(el('h3', { text: 'Change Comparison', style: 'font-size: 1rem; font-weight: 600; color: var(--color-text); margin-bottom: 12px;' }));

    const diffContainer = el('div', { class: 'card', style: 'border-radius: 8px; padding: 20px;' });
    
    // Custom diff tables rendering for beautiful layout
    const { current, proposed, diffs, isNew } = PendingChanges.buildDiff(pc);
    diffContainer.innerHTML = '';
    
    if (diffs.length === 0) {
      diffContainer.appendChild(renderEmptyStateV2({
        variant: 'compact',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        title: 'No changes detected',
        body: 'No differences found between current and proposed data.'
      }));
    } else {
      // Build a clean, styled table of changed fields only
      const diffTable = el('table', { class: 'report-table', style: 'width: 100%; border-collapse: collapse;' });
      const diffThead = el('thead');
      const diffThr = el('tr');
      ['Field', 'Proposed Value'].forEach(h => diffThr.appendChild(el('th', { text: h, style: 'text-align: left; padding: 10px; background: var(--color-bg-muted); border-bottom: 2px solid var(--color-border); font-size: 0.8125rem;' })));
      diffThead.appendChild(diffThr);
      diffTable.appendChild(diffThead);
      
      const diffTbody = el('tbody');
      diffs.forEach(d => {
        const tr = el('tr');
        
        // Format the key to look nice
        const niceKey = d.key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        // Format values
        let oldVal = d.old;
        let newVal = d.new;
        
        // If it's a JSON or long array/object, make it clean
        if (oldVal.startsWith('[') || oldVal.startsWith('{')) {
          try {
            const parsed = JSON.parse(oldVal);
            if (Array.isArray(parsed)) oldVal = `${parsed.length} item(s)`;
          } catch(e) {}
        }
        if (newVal.startsWith('[') || newVal.startsWith('{')) {
          try {
            const parsed = JSON.parse(newVal);
            if (Array.isArray(parsed)) newVal = `${parsed.length} item(s)`;
          } catch(e) {}
        }
        
        tr.appendChild(el('td', { text: niceKey, style: 'padding: 12px 10px; border-bottom: 1px solid var(--color-border); font-weight: 600; font-size: 0.8125rem; color: var(--color-text);' }));
        tr.appendChild(el('td', { text: newVal, style: 'padding: 12px 10px; border-bottom: 1px solid var(--color-border); font-weight: 600; font-size: 0.8125rem; color: var(--color-success); background: rgba(52, 211, 153, 0.12);' }));
        diffTbody.appendChild(tr);
      });
      diffTable.appendChild(diffTbody);
      diffContainer.appendChild(diffTable);
    }
    
    diffSection.appendChild(diffContainer);
    wrapper.appendChild(diffSection);

    // Actions Footer
    const actions = el('div', {
      style: 'display: flex; gap: 12px; border-top: 1px solid var(--color-border); padding-top: 20px; margin-top: 24px;'
    });

    if (canApprove) {
      const approveBtn = el('button', { class: 'btn btn-success', text: 'Approve Change' });
      approveBtn.addEventListener('click', () => {
        Workflow.showConfirm('Confirm Approval', 'Are you sure you want to approve this change?', () => {
          PendingChanges.approve(pc.id);
          this.pendingDetailId = null;
          App.handleRoute();
        }, 'success');
      });
      actions.appendChild(approveBtn);

      const rejectBtn = el('button', { class: 'btn btn-danger', text: 'Reject' });
      rejectBtn.addEventListener('click', () => {
        const reason = prompt('Enter rejection reason:');
        if (reason !== null) {
          PendingChanges.reject(pc.id, reason);
          this.pendingDetailId = null;
          App.handleRoute();
        }
      });
      actions.appendChild(rejectBtn);
    } else if (isSubmitter && pc.status === 'pending') {
      const withdrawBtn = el('button', { class: 'btn btn-secondary', text: 'Withdraw Submission' });
      withdrawBtn.addEventListener('click', () => {
        Workflow.showConfirm('Confirm Withdrawal', 'Are you sure you want to withdraw this submission?', () => {
          PendingChanges.delete(pc.id);
          this.pendingDetailId = null;
          App.handleRoute();
        }, 'danger');
      });
      actions.appendChild(withdrawBtn);
    } else if (isSubmitter && pc.status === 'rejected') {
      const editResubmitBtn = el('button', { class: 'btn btn-warning', text: 'Edit & Resubmit' });
      editResubmitBtn.addEventListener('click', () => {
        PendingChanges.editingPendingId = pc.id;
        this.pendingDetailId = null;

        if (pc.table === 'invoices') {
          location.hash = `#billing/form/${pc.proposedData.id}`;
        } else if (pc.table === 'disbursements') {
          location.hash = `#disbursement/form/${pc.proposedData.id}`;
        } else if (pc.table === 'transmittals') {
          location.hash = `#transmittal/form/${pc.proposedData.id}`;
        } else if (pc.table === 'clients') {
          location.hash = `#clients/form/${pc.proposedData.id}`;
        } else if (pc.table === 'workRequests') {
          location.hash = `#operations/form/${pc.proposedData.id}`;
        } else if (pc.table === 'tasks') {
          App.handleRoute(); // navigate back to wherever they were
          Workflow.showEditTaskModal(pc.proposedData.id, () => {
            App.handleRoute();
          });
        }
      });
      actions.appendChild(editResubmitBtn);

      const dismissBtn = el('button', { class: 'btn btn-danger', text: 'Dismiss Submission' });
      dismissBtn.addEventListener('click', () => {
        Workflow.showConfirm('Confirm Dismissal', 'Are you sure you want to dismiss and clear this rejected submission?', () => {
          PendingChanges.delete(pc.id);
          this.pendingDetailId = null;
          App.handleRoute();
        }, 'danger');
      });
      actions.appendChild(dismissBtn);
    }

    wrapper.appendChild(actions);
    return wrapper;
  },

  renderMyRequestsSection() {
    const wrapper = el('div');
    let requests = DB.getWhere('operationsRequests', r => r.requestedBy === Auth.user.id);

    // Apply category filter
    if (this.filters.category) {
      requests = requests.filter(r => r.type === this.filters.category);
    }

    // Apply status filter
    if (this.filters.status) {
      requests = requests.filter(r => r.status === this.filters.status);
    }

    // Apply date range filter
    if (this.filters.dateFrom || this.filters.dateTo) {
      requests = requests.filter(r => {
        if (!r.requestedAt) return false;
        const itemDate = new Date(r.requestedAt);
        const itemISO = itemDate.getFullYear() + '-' + String(itemDate.getMonth() + 1).padStart(2, '0') + '-' + String(itemDate.getDate()).padStart(2, '0');
        if (this.filters.dateFrom && itemISO < this.filters.dateFrom) return false;
        if (this.filters.dateTo && itemISO > this.filters.dateTo) return false;
        return true;
      });
    }

    if (requests.length === 0) {
      const isFiltered = this.filters.category || this.filters.status || this.filters.dateFrom || this.filters.dateTo;
      wrapper.appendChild(renderEmptyStateV2({
        variant: isFiltered ? 'filtered-empty' : 'zero-state',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
        title: isFiltered ? 'No matching requests' : 'No requests submitted yet',
        body: isFiltered ? 'Try clearing or modifying your filter criteria.' : 'Submit a departmental request in the Operations section.',
        actions: isFiltered ? [] : [
          {
            text: 'Go to Operations',
            onClick: () => {
              location.hash = '#operations';
            }
          }
        ]
      }));
      return wrapper;
    }

    const table = el('table', { class: 'data-table' });
    const thead = el('thead');
    const thr = el('tr');
    ['Request Type', 'Work Request', 'Client', 'Requested At', 'Status', 'Fulfill Info / Actions'].forEach(h => thr.appendChild(el('th', { text: h })));
    thead.appendChild(thr);
    table.appendChild(thead);

    const tbody = el('tbody');
    requests.forEach(r => {
      const tr = el('tr');
      
      const typeLabel = r.type === 'billing' ? 'Billing' : r.type === 'disbursement' ? 'Disbursement' : 'Transmittal';
      tr.appendChild(el('td', { text: typeLabel }));
      
      const wr = DB.getById('workRequests', r.workRequestId);
      tr.appendChild(el('td', { text: wr ? wr.title : '—' }));
      
      const client = DB.getById('clients', r.clientId);
      tr.appendChild(el('td', { text: client ? client.name : '—' }));
      
      tr.appendChild(el('td', { text: formatDate(r.requestedAt) }));
      
      const st = r.status;
      const badge = el('span', { 
        class: 'badge', 
        text: st,
        style: `font-size: 11px; padding: 2px 6px; border-radius: var(--radius-sm); background: ${st === 'fulfilled' ? 'color-mix(in oklab, var(--success), transparent 88%)' : st === 'rejected' ? 'color-mix(in oklab, var(--danger), transparent 88%)' : 'color-mix(in oklab, var(--warn), transparent 88%)'}; color: ${st === 'fulfilled' ? 'var(--success)' : st === 'rejected' ? 'var(--danger)' : 'color-mix(in oklab, var(--warn), black 30%)'};`
      });
      const tdSt = el('td');
      tdSt.appendChild(badge);
      tr.appendChild(tdSt);

      const tdAct = el('td');
      if (st === 'pending') {
        const cancelBtn = el('button', { class: 'btn btn-danger btn-sm', text: 'Cancel Request' });
        cancelBtn.addEventListener('click', () => {
          Workflow.showConfirm('Cancel Request', 'Are you sure you want to cancel this request?', () => {
            DB.delete('operationsRequests', r.id);
            App.handleRoute();
          }, 'danger');
        });
        tdAct.appendChild(cancelBtn);
      } else if (st === 'fulfilled') {
        const fulfiller = DB.getById('users', r.fulfilledBy);
        tdAct.textContent = `Fulfilled by ${fulfiller ? fulfiller.name : 'System'} on ${formatDate(r.fulfilledAt)}`;
      } else if (st === 'rejected') {
        tdAct.textContent = r.rejectionReason ? `Reason: ${r.rejectionReason}` : 'No reason provided';
      }
      tr.appendChild(tdAct);
      
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }
};
