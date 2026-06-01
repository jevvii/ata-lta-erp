/**
 * Billing Module
 * Sales Invoice creation, payment tracking, aging.
 * VAT removed per v3 schema — total = subtotal.
 */

const Billing = {
  view: 'list', // 'list' | 'form' | 'detail' | 'aging' | 'templates'
  detailId: null,

  render() {
    const container = el('div', { class: 'page' });
    container.appendChild(el('h1', { text: 'Billing' }));

    if (this.view === 'list') container.appendChild(this.renderList());
    else if (this.view === 'form') container.appendChild(this.renderForm());
    else if (this.view === 'detail') container.appendChild(this.renderDetail());
    else if (this.view === 'aging') container.appendChild(this.renderAging());
    else if (this.view === 'templates') container.appendChild(this.renderTemplates());

    return container;
  },

  init() {},

  getPaidAmount(inv) {
    if (Array.isArray(inv.payments)) {
      return inv.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    }
    return inv.paidAmount || 0;
  },

  getSubtotal(inv) {
    if (typeof inv.subtotal === 'number') return inv.subtotal;
    if (Array.isArray(inv.lineItems)) {
      return inv.lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }
    return 0;
  },

  // ============================================================
  // List View
  // ============================================================
  renderList() {
    const entity = Auth.activeEntity;
    const wrapper = el('div');

    // Header bar
    const headerBar = el('div', { class: 'form-header-bar' });
    headerBar.appendChild(el('h2', { text: 'Invoices' }));
    const topActions = el('div', { class: 'form-actions-top' });
    const addBtn = el('button', { class: 'btn btn-primary', text: 'Create Invoice' });
    addBtn.addEventListener('click', () => { this.view = 'form'; this.detailId = null; App.handleRoute(); });
    topActions.appendChild(addBtn);
    const templatesBtn = el('button', { class: 'btn btn-ghost', text: 'Templates' });
    templatesBtn.addEventListener('click', () => { this.view = 'templates'; App.handleRoute(); });
    topActions.appendChild(templatesBtn);
    const agingBtn = el('button', { class: 'btn btn-ghost', text: 'Aging Report' });
    agingBtn.addEventListener('click', () => { this.view = 'aging'; App.handleRoute(); });
    topActions.appendChild(agingBtn);
    headerBar.appendChild(topActions);
    wrapper.appendChild(headerBar);

    // Filters
    const filters = el('div', { class: 'filters-bar' });
    const wrFilter = el('select', { class: 'form-select' });
    wrFilter.appendChild(el('option', { value: '', text: 'All Work Requests' }));
    DB.getWhere('workRequests', wr => wr.entity === entity).forEach(wr => {
      wrFilter.appendChild(el('option', { value: wr.id, text: wr.title }));
    });
    filters.appendChild(wrFilter);

    const clientFilter = el('select', { class: 'form-select' });
    clientFilter.appendChild(el('option', { value: '', text: 'All Clients' }));
    DB.getWhere('clients', c => c.entity === entity).forEach(c => {
      clientFilter.appendChild(el('option', { value: c.id, text: c.name }));
    });
    filters.appendChild(clientFilter);

    const empFilter = el('select', { class: 'form-select' });
    empFilter.appendChild(el('option', { value: '', text: 'All Employees' }));
    DB.getWhere('users', u => u.entities?.map(e => e.toUpperCase()).includes(entity)).forEach(u => {
      empFilter.appendChild(el('option', { value: u.id, text: u.name }));
    });
    filters.appendChild(empFilter);

    const dateFrom = el('input', { type: 'date', class: 'form-select' });
    const dateTo = el('input', { type: 'date', class: 'form-select' });
    filters.appendChild(el('span', { text: 'From', style: 'font-size:0.875rem;color:var(--color-text-muted);' }));
    filters.appendChild(dateFrom);
    filters.appendChild(el('span', { text: 'To', style: 'font-size:0.875rem;color:var(--color-text-muted);' }));
    filters.appendChild(dateTo);

    const statusFilter = el('select', { class: 'form-select' });
    statusFilter.appendChild(el('option', { value: '', text: 'All Statuses' }));
    ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'].forEach(s => {
      statusFilter.appendChild(el('option', { value: s, text: s }));
    });
    filters.appendChild(statusFilter);

    wrapper.appendChild(filters);

    // View mode toggle
    const viewMode = App.getPreferredViewMode('billing') || 'table';
    const vmToggle = el('div', { class: 'view-mode-toggle', style: 'margin-bottom:var(--spacing-md);' });
    const vmTable = el('button', { text: 'Table', class: viewMode === 'table' ? 'active' : '' });
    const vmBoard = el('button', { text: 'Board', class: viewMode === 'board' ? 'active' : '' });
    const vmList = el('button', { text: 'List', class: viewMode === 'list' ? 'active' : '' });
    vmTable.addEventListener('click', () => { App.setPreferredViewMode('billing', 'table'); App.handleRoute(); });
    vmBoard.addEventListener('click', () => { App.setPreferredViewMode('billing', 'board'); App.handleRoute(); });
    vmList.addEventListener('click', () => { App.setPreferredViewMode('billing', 'list'); App.handleRoute(); });
    vmToggle.appendChild(vmTable);
    vmToggle.appendChild(vmBoard);
    vmToggle.appendChild(vmList);
    wrapper.appendChild(vmToggle);

    const contentContainer = el('div');
    wrapper.appendChild(contentContainer);

    const refresh = () => {
      while (contentContainer.firstChild) contentContainer.removeChild(contentContainer.firstChild);
      let invoices = DB.getWhere('invoices', inv => inv.entity === entity);
      if (wrFilter.value) invoices = invoices.filter(inv => {
        const wr = DB.getById('workRequests', inv.workRequestId);
        return wr && wr.id === wrFilter.value;
      });
      if (clientFilter.value) invoices = invoices.filter(inv => inv.clientId === clientFilter.value);
      if (empFilter.value) invoices = invoices.filter(inv => inv.createdBy === empFilter.value);
      if (dateFrom.value) invoices = invoices.filter(inv => inv.issueDate >= dateFrom.value);
      if (dateTo.value) invoices = invoices.filter(inv => inv.issueDate <= dateTo.value);
      if (statusFilter.value) invoices = invoices.filter(inv => inv.status === statusFilter.value);

      if (viewMode === 'table') this.refreshTable(contentContainer, invoices);
      else if (viewMode === 'board') this.refreshBoard(contentContainer, invoices);
      else this.refreshListCompact(contentContainer, invoices);
    };

    [wrFilter, clientFilter, empFilter, dateFrom, dateTo, statusFilter].forEach(el => el.addEventListener('change', refresh));
    refresh();

    return wrapper;
  },

  refreshTable(container, invoices) {
    if (invoices.length === 0) {
      container.appendChild(el('p', { text: 'No invoices found.', class: 'empty-state' }));
      return;
    }
    const table = el('table', { class: 'data-table' });
    const thead = el('thead');
    const thr = el('tr');
    ['Invoice #', 'Client', 'Issue Date', 'Total', 'Status', 'Actions'].forEach(h => thr.appendChild(el('th', { text: h })));
    thead.appendChild(thr);
    table.appendChild(thead);

    const tbody = el('tbody');
    invoices.forEach(inv => {
      const client = DB.getById('clients', inv.clientId);
      const tr = el('tr');
      tr.appendChild(el('td', { text: inv.invoiceNumber }));
      tr.appendChild(el('td', { text: client?.name || '—' }));
      tr.appendChild(el('td', { text: formatDate(inv.issueDate) }));
      tr.appendChild(el('td', { text: formatPHP(inv.total) }));
      tr.appendChild(el('td')).appendChild(this.statusBadge(inv.status));
      const tdAct = el('td');
      const viewBtn = el('button', { class: 'btn btn-ghost btn-sm', text: 'View' });
      viewBtn.addEventListener('click', () => { this.view = 'detail'; this.detailId = inv.id; App.handleRoute(); });
      tdAct.appendChild(viewBtn);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  },

  refreshBoard(container, invoices) {
    if (invoices.length === 0) {
      container.appendChild(el('p', { text: 'No invoices found.', class: 'empty-state' }));
      return;
    }
    const board = el('div', { class: 'board-view' });
    const statuses = ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];
    statuses.forEach(st => {
      const col = el('div', { class: 'board-column' });
      col.appendChild(el('div', { class: 'board-column-header', text: st }));
      const colInvs = invoices.filter(inv => inv.status === st);
      colInvs.forEach(inv => {
        const client = DB.getById('clients', inv.clientId);
        const card = el('div', { class: 'board-card' });
        card.appendChild(el('div', { class: 'board-card-title', text: inv.invoiceNumber }));
        card.appendChild(el('div', { class: 'board-card-meta', text: (client?.name || '—') + ' | ' + formatPHP(inv.total) }));
        card.addEventListener('click', () => { this.view = 'detail'; this.detailId = inv.id; App.handleRoute(); });
        col.appendChild(card);
      });
      board.appendChild(col);
    });
    container.appendChild(board);
  },

  refreshListCompact(container, invoices) {
    if (invoices.length === 0) {
      container.appendChild(el('p', { text: 'No invoices found.', class: 'empty-state' }));
      return;
    }
    const list = el('div', { class: 'list-view' });
    invoices.forEach(inv => {
      const client = DB.getById('clients', inv.clientId);
      const row = el('div', { class: 'list-item' });
      row.appendChild(el('div', {}, [
        el('div', { class: 'list-item-title', text: inv.invoiceNumber + ' — ' + (client?.name || '—') }),
        el('div', { class: 'list-item-meta', text: formatDate(inv.issueDate) + ' | ' + formatPHP(inv.total) })
      ]));
      row.appendChild(this.statusBadge(inv.status));
      row.addEventListener('click', () => { this.view = 'detail'; this.detailId = inv.id; App.handleRoute(); });
      list.appendChild(row);
    });
    container.appendChild(list);
  },

  statusBadge(status) {
    const map = {
      'Draft': 'badge-info',
      'Sent': 'badge-warning',
      'Partially Paid': 'badge-warning',
      'Paid': 'badge-success',
      'Overdue': 'badge-danger',
      'Cancelled': 'badge-danger'
    };
    return el('span', { class: 'badge ' + (map[status] || ''), text: status });
  },

  // ============================================================
  // Create / Edit Form
  // ============================================================
  renderForm() {
    const entity = Auth.activeEntity;
    const inv = this.detailId ? DB.getById('invoices', this.detailId) : null;
    const container = el('div');

    // Header bar
    const headerBar = el('div', { class: 'form-header-bar' });
    headerBar.appendChild(el('h2', { text: inv ? 'Edit Invoice' : 'Create Sales Invoice' }));
    const topActions = el('div', { class: 'form-actions-top' });
    const saveBtn = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Save Invoice', form: 'invoice-form' });
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: 'Cancel' });
    cancelBtn.addEventListener('click', () => { this.view = 'list'; this.detailId = null; App.handleRoute(); });
    topActions.appendChild(saveBtn);
    topActions.appendChild(cancelBtn);
    headerBar.appendChild(topActions);
    container.appendChild(headerBar);

    const form = el('form', { id: 'invoice-form', class: 'form-stacked' });

    // Client
    const clientGroup = el('div', { class: 'form-group' });
    clientGroup.appendChild(el('label', { text: 'Client *' }));
    const clientSel = el('select', { name: 'clientId', required: true });
    clientSel.appendChild(el('option', { value: '', text: '— Select Client —' }));
    DB.getWhere('clients', c => c.entity === entity).forEach(c => {
      const opt = el('option', { value: c.id, text: c.name });
      if (inv && inv.clientId === c.id) opt.selected = true;
      clientSel.appendChild(opt);
    });
    clientGroup.appendChild(clientSel);
    form.appendChild(clientGroup);

    // Work Request link
    const wrGroup = el('div', { class: 'form-group' });
    wrGroup.appendChild(el('label', { text: 'Link to Work Request' }));
    const wrSel = el('select', { name: 'workRequestId' });
    wrSel.appendChild(el('option', { value: '', text: '— None —' }));
    DB.getWhere('workRequests', wr => wr.entity === entity).forEach(wr => {
      const opt = el('option', { value: wr.id, text: wr.title });
      if (inv && inv.workRequestId === wr.id) opt.selected = true;
      wrSel.appendChild(opt);
    });
    wrGroup.appendChild(wrSel);
    form.appendChild(wrGroup);

    // Dates
    const dateGroup = el('div', { class: 'form-group' });
    dateGroup.appendChild(el('label', { text: 'Issue Date *' }));
    dateGroup.appendChild(el('input', { type: 'date', name: 'issueDate', value: inv ? inv.issueDate : new Date().toISOString().slice(0, 10), required: true }));
    form.appendChild(dateGroup);

    const dueGroup = el('div', { class: 'form-group' });
    dueGroup.appendChild(el('label', { text: 'Due Date *' }));
    dueGroup.appendChild(el('input', { type: 'date', name: 'dueDate', value: inv ? inv.dueDate : '', required: true }));
    form.appendChild(dueGroup);

    // Invoice Number (auto)
    const numGroup = el('div', { class: 'form-group' });
    numGroup.appendChild(el('label', { text: 'Invoice Number' }));
    const numInput = el('input', { type: 'text', name: 'invoiceNumber', value: inv ? inv.invoiceNumber : this.nextInvoiceNumber(entity), readonly: true });
    numGroup.appendChild(numInput);
    form.appendChild(numGroup);

    // Line Items
    const itemsSection = el('div', { class: 'form-section' });
    itemsSection.appendChild(el('h3', { text: 'Line Items' }));
    const itemsList = el('div', { id: 'line-item-rows' });
    itemsSection.appendChild(itemsList);

    const addItemBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: '+ Add Line Item' });
    addItemBtn.addEventListener('click', () => this.addLineItemRow(itemsList));
    itemsSection.appendChild(addItemBtn);
    form.appendChild(itemsSection);

    // Pre-populate existing line items
    if (inv && inv.lineItems) {
      inv.lineItems.forEach(item => this.addLineItemRow(itemsList, item));
    } else {
      this.addLineItemRow(itemsList, { type: 'PF', description: '', amount: '' });
      this.addLineItemRow(itemsList, { type: 'Government Fee', description: '', amount: '' });
    }

    // Totals (no VAT)
    const totals = el('div', { class: 'invoice-totals' });
    totals.appendChild(el('div', { class: 'total-row' }, [el('span', { text: 'Subtotal:' }), el('span', { id: 'inv-subtotal', text: '₱0.00' })]));
    totals.appendChild(el('div', { class: 'total-row total-grand' }, [el('span', { text: 'Total:' }), el('span', { id: 'inv-total', text: '₱0.00' })]));
    form.appendChild(totals);

    // Seller / Buyer info preview
    const infoSection = el('div', { class: 'form-section' });
    infoSection.appendChild(el('h3', { text: 'Seller / Buyer Info' }));
    const infoBox = el('div', { class: 'invoice-info-box' });
    infoBox.appendChild(el('p', { text: 'Seller: ' + entity + ' Accounting Firm | TIN: 000-000-000-0000 | Branch: 0001' }));
    infoBox.appendChild(el('p', { id: 'buyer-info', text: 'Buyer: —' }));
    infoSection.appendChild(infoBox);
    form.appendChild(infoSection);

    // Update buyer info on client change
    clientSel.addEventListener('change', () => {
      const cid = clientSel.value;
      const c = cid ? DB.getById('clients', cid) : null;
      const buyerEl = document.getElementById('buyer-info');
      if (buyerEl && c) {
        buyerEl.textContent = 'Buyer: ' + c.name + ' | TIN: ' + (c.tin || '—');
      } else if (buyerEl) {
        buyerEl.textContent = 'Buyer: —';
      }
    });
    if (clientSel.value) clientSel.dispatchEvent(new Event('change'));

    // Recalculate totals on input changes
    form.addEventListener('input', () => this.recalcTotals(form));

    form.addEventListener('submit', e => { e.preventDefault(); this.submitForm(form); });

    container.appendChild(form);
    this.recalcTotals(form);
    return container;
  },

  addLineItemRow(container, item) {
    const row = el('div', { class: 'line-item-row' });

    const typeSel = el('select', { class: 'item-type' });
    ['PF', 'Government Fee'].forEach(t => {
      const opt = el('option', { value: t, text: t });
      if (item?.type === t) opt.selected = true;
      typeSel.appendChild(opt);
    });
    row.appendChild(typeSel);

    const descIn = el('input', { type: 'text', placeholder: 'Description', class: 'item-desc', value: item?.description || '' });
    row.appendChild(descIn);

    const amtIn = el('input', { type: 'number', placeholder: 'Amount', class: 'item-amt', value: item?.amount || '', min: 0, step: 0.01 });
    row.appendChild(amtIn);

    const removeBtn = el('button', { type: 'button', class: 'btn btn-danger btn-sm', text: '×' });
    removeBtn.addEventListener('click', () => {
      row.remove();
      const form = container.closest('form');
      if (form) this.recalcTotals(form);
    });
    row.appendChild(removeBtn);

    container.appendChild(row);
  },

  recalcTotals(form) {
    const rows = form.querySelectorAll('.line-item-row');
    let subtotal = 0;
    rows.forEach(row => {
      const amt = parseFloat(row.querySelector('.item-amt').value) || 0;
      subtotal += amt;
    });

    const subEl = form.querySelector('#inv-subtotal');
    const totEl = form.querySelector('#inv-total');
    if (subEl) subEl.textContent = formatPHP(subtotal);
    if (totEl) totEl.textContent = formatPHP(subtotal);
  },

  nextInvoiceNumber(entity) {
    const year = new Date().getFullYear();
    const prefix = entity + '-SI-' + year + '-';
    const existing = DB.getWhere('invoices', inv => inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix));
    const maxNum = existing.reduce((max, inv) => {
      const parts = inv.invoiceNumber.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      return num > max ? num : max;
    }, 0);
    return prefix + String(maxNum + 1).padStart(3, '0');
  },

  submitForm(form) {
    if (!validateRequiredFields(form)) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const entity = Auth.activeEntity;

    const rows = form.querySelectorAll('.line-item-row');
    const lineItems = [];
    let subtotal = 0;
    rows.forEach(row => {
      const amt = parseFloat(row.querySelector('.item-amt').value) || 0;
      subtotal += amt;
      lineItems.push({
        type: row.querySelector('.item-type').value,
        description: row.querySelector('.item-desc').value.trim(),
        amount: amt
      });
    });

    const isNew = !this.detailId;
    const record = {
      invoiceNumber: data.invoiceNumber,
      clientId: data.clientId,
      workRequestId: data.workRequestId || null,
      entity: entity,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      lineItems,
      subtotal,
      vat: 0,
      total: subtotal,
      status: isNew ? 'Draft' : undefined,
      payments: inv?.payments || []
    };

    const inv = isNew ? null : DB.getById('invoices', this.detailId);
    if (inv) {
      // Preserve fields not in form
      record.status = inv.status;
      record.payments = inv.payments || [];
      record.paidAmount = inv.paidAmount || 0;
      record.createdBy = inv.createdBy || Auth.user.id;
    } else {
      record.createdBy = Auth.user.id;
    }

    if (isNew) {
      record.id = generateId('inv');
      record.createdAt = new Date().toISOString();
      record.updatedAt = record.createdAt;
    } else {
      record.id = this.detailId;
      record.updatedAt = new Date().toISOString();
    }

    const result = PendingChanges.submit('invoices', record, isNew);

    // Link to WR if selected
    if (data.workRequestId) {
      const wr = DB.getById('workRequests', data.workRequestId);
      if (wr && result.approved) {
        const linked = new Set(wr.linkedInvoiceId ? [wr.linkedInvoiceId] : []);
        linked.add(record.id);
        DB.update('workRequests', wr.id, { linkedInvoiceId: record.id });
      }
    }

    this.view = 'list';
    this.detailId = null;
    App.handleRoute();
  },

  // ============================================================
  // Detail View (with payment recording)
  // ============================================================
  renderDetail() {
    const inv = DB.getById('invoices', this.detailId);
    if (!inv) { this.view = 'list'; App.handleRoute(); return el('div'); }
    const client = DB.getById('clients', inv.clientId);

    const container = el('div', { class: 'invoice-detail' });

    // Top actions bar
    const topActions = el('div', { class: 'form-header-bar', style: 'margin-bottom: var(--spacing-lg);' });
    topActions.appendChild(el('h2', { text: inv.invoiceNumber }));
    const topRight = el('div', { class: 'form-actions-top' });
    const backBtn = el('button', { class: 'btn btn-ghost btn-sm', text: '← Back' });
    backBtn.addEventListener('click', () => { this.view = 'list'; this.detailId = null; App.handleRoute(); });
    topRight.appendChild(backBtn);
    const printBtn = el('button', { class: 'btn btn-ghost', text: 'Print Invoice' });
    printBtn.addEventListener('click', () => window.print());
    topRight.appendChild(printBtn);
    const voucherBtn = el('button', { class: 'btn btn-ghost', text: 'Print Voucher' });
    voucherBtn.addEventListener('click', () => this.printVoucher(inv));
    topRight.appendChild(voucherBtn);
    topActions.appendChild(topRight);
    container.appendChild(topActions);

    container.appendChild(this.statusBadge(inv.status));

    const meta = el('div', { class: 'invoice-meta' });
    meta.appendChild(el('p', { text: 'Client: ' + (client?.name || '—') }));
    meta.appendChild(el('p', { text: 'Issue Date: ' + formatDate(inv.issueDate) }));
    meta.appendChild(el('p', { text: 'Due Date: ' + formatDate(inv.dueDate) }));
    container.appendChild(meta);

    // Line items table
    const table = el('table', { class: 'data-table' });
    const thead = el('thead');
    const thr = el('tr');
    ['Type', 'Description', 'Amount'].forEach(h => thr.appendChild(el('th', { text: h })));
    thead.appendChild(thr);
    table.appendChild(thead);
    const tbody = el('tbody');
    inv.lineItems.forEach(item => {
      const tr = el('tr');
      tr.appendChild(el('td', { text: item.type }));
      tr.appendChild(el('td', { text: item.description }));
      tr.appendChild(el('td', { text: formatPHP(item.amount) }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    // Totals
    const subtotal = this.getSubtotal(inv);
    const paid = this.getPaidAmount(inv);
    const totals = el('div', { class: 'invoice-totals' });
    totals.appendChild(el('div', { class: 'total-row' }, [el('span', { text: 'Subtotal:' }), el('span', { text: formatPHP(subtotal) })]));
    totals.appendChild(el('div', { class: 'total-row total-grand' }, [el('span', { text: 'Total:' }), el('span', { text: formatPHP(inv.total) })]));
    totals.appendChild(el('div', { class: 'total-row' }, [el('span', { text: 'Paid:' }), el('span', { text: formatPHP(paid) })]));
    totals.appendChild(el('div', { class: 'total-row' }, [el('span', { text: 'Balance:' }), el('span', { text: formatPHP(inv.total - paid) })]));
    container.appendChild(totals);

    // Payments history
    if (Array.isArray(inv.payments) && inv.payments.length > 0) {
      const payHist = el('div', { class: 'form-section' });
      payHist.appendChild(el('h3', { text: 'Payment History' }));
      const pTable = el('table', { class: 'data-table' });
      const pHead = el('thead');
      const pThr = el('tr');
      ['Date', 'Amount', 'Method', 'Reference', 'Recorded By', 'Collected By'].forEach(h => pThr.appendChild(el('th', { text: h })));
      pHead.appendChild(pThr);
      pTable.appendChild(pHead);
      const pBody = el('tbody');
      inv.payments.forEach(p => {
        const collector = p.collectedBy ? DB.getById('users', p.collectedBy) : null;
        const recorder = p.recordedBy ? DB.getById('users', p.recordedBy) : null;
        const ptr = el('tr');
        ptr.appendChild(el('td', { text: formatDate(p.date) }));
        ptr.appendChild(el('td', { text: formatPHP(p.amount) }));
        ptr.appendChild(el('td', { text: p.method || '—' }));
        ptr.appendChild(el('td', { text: p.reference || '—' }));
        ptr.appendChild(el('td', { text: recorder ? recorder.name : '—' }));
        ptr.appendChild(el('td', { text: collector ? collector.name : '—' }));
        pBody.appendChild(ptr);
      });
      pTable.appendChild(pBody);
      payHist.appendChild(pTable);
      container.appendChild(payHist);
    }

    // Payment recording
    if (inv.status !== 'Paid' && inv.status !== 'Cancelled') {
      const paySection = el('div', { class: 'form-section' });
      paySection.appendChild(el('h3', { text: 'Record Payment' }));
      const payForm = el('form', { class: 'form-stacked' });
      payForm.appendChild(el('div', { class: 'form-group' }, [el('label', { text: 'Amount Paid *' }), el('input', { type: 'number', name: 'payAmount', min: 0, step: 0.01, required: true })]));
      payForm.appendChild(el('div', { class: 'form-group' }, [el('label', { text: 'Payment Date *' }), el('input', { type: 'date', name: 'payDate', value: new Date().toISOString().slice(0, 10), required: true })]));

      const methodGroup = el('div', { class: 'form-group' });
      methodGroup.appendChild(el('label', { text: 'Method *' }));
      const methodSel = el('select', { name: 'payMethod', required: true });
      ['Cash', 'Check', 'Bank Transfer'].forEach(m => methodSel.appendChild(el('option', { value: m, text: m })));
      methodGroup.appendChild(methodSel);
      payForm.appendChild(methodGroup);

      payForm.appendChild(el('div', { class: 'form-group' }, [el('label', { text: 'Reference #' }), el('input', { type: 'text', name: 'payRef' })]));

      const collectorGroup = el('div', { class: 'form-group' });
      collectorGroup.appendChild(el('label', { text: 'Payment Collected By' }));
      const collectorSel = el('select', { name: 'payCollectedBy' });
      collectorSel.appendChild(el('option', { value: '', text: '— Select User —' }));
      DB.getAll('users').forEach(u => {
        const opt = el('option', { value: u.id, text: u.name });
        collectorSel.appendChild(opt);
      });
      collectorGroup.appendChild(collectorSel);
      payForm.appendChild(collectorGroup);

      const payBtn = el('button', { type: 'submit', class: 'btn btn-success', text: 'Record Payment' });
      payForm.appendChild(payBtn);
      payForm.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(payForm);
        const payAmount = parseFloat(fd.get('payAmount')) || 0;
        const payments = inv.payments || [];
        payments.push({
          amount: payAmount,
          date: fd.get('payDate'),
          method: fd.get('payMethod'),
          reference: fd.get('payRef') || '',
          recordedBy: Auth.user.id,
          collectedBy: fd.get('payCollectedBy') || ''
        });
        const newPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        let newStatus = inv.status;
        if (newPaid >= inv.total) newStatus = 'Paid';
        else if (newPaid > 0 && newPaid < inv.total) newStatus = 'Partially Paid';
        DB.update('invoices', inv.id, { payments, paidAmount: newPaid, status: newStatus });
        App.handleRoute();
      });
      paySection.appendChild(payForm);
      container.appendChild(paySection);
    }

    // BIR compliance footer (visible only in print via CSS)
    const birFooter = el('div', { class: 'bir-footer', style: 'margin-top:40px; padding-top:20px; border-top:2px solid var(--color-border); display:none;' });
    birFooter.appendChild(el('p', { style: 'font-size:0.75rem; color:var(--color-text-muted); text-align:center;', text: 'This document is not valid for claim of input tax.' }));
    container.appendChild(birFooter);

    // Status actions
    const actions = el('div', { class: 'form-actions' });
    if (inv.status === 'Draft') {
      const sentBtn = el('button', { class: 'btn btn-primary', text: 'Mark as Sent' });
      sentBtn.addEventListener('click', () => { DB.update('invoices', inv.id, { status: 'Sent' }); App.handleRoute(); });
      actions.appendChild(sentBtn);
    }
    container.appendChild(actions);

    return container;
  },

  printVoucher(inv) {
    const client = DB.getById('clients', inv.clientId);
    const w = window.open('', '_blank');
    if (!w) return;
    const d = w.document;
    const title = d.createElement('title');
    title.textContent = 'Voucher ' + inv.invoiceNumber;
    d.head.appendChild(title);
    const style = d.createElement('style');
    style.textContent = 'body{font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;}h1{font-size:1.25rem;margin-bottom:8px;}.meta{color:#666;font-size:0.875rem;margin-bottom:24px;}table{width:100%;border-collapse:collapse;margin:16px 0;}th,td{text-align:left;padding:8px 0;border-bottom:1px solid #ddd;}.total{font-weight:700;font-size:1.125rem;margin-top:16px;}.footer{margin-top:40px;font-size:0.75rem;color:#999;text-align:center;}';
    d.head.appendChild(style);

    d.body.appendChild(d.createElement('h1')).textContent = 'Payment Voucher';
    const meta = d.createElement('div');
    meta.className = 'meta';
    meta.textContent = inv.invoiceNumber + ' | ' + formatDate(inv.issueDate);
    d.body.appendChild(meta);

    const p = d.createElement('p');
    const strong = d.createElement('strong');
    strong.textContent = 'Client: ';
    p.appendChild(strong);
    p.appendChild(d.createTextNode(client ? client.name : '—'));
    d.body.appendChild(p);

    const table = d.createElement('table');
    const thead = d.createElement('thead');
    const thr = d.createElement('tr');
    const thDesc = d.createElement('th');
    thDesc.textContent = 'Description';
    thr.appendChild(thDesc);
    const thAmt = d.createElement('th');
    thAmt.style.textAlign = 'right';
    thAmt.textContent = 'Amount';
    thr.appendChild(thAmt);
    thead.appendChild(thr);
    table.appendChild(thead);

    const tbody = d.createElement('tbody');
    inv.lineItems.forEach(li => {
      const tr = d.createElement('tr');
      const tdDesc = d.createElement('td');
      tdDesc.textContent = li.description || '';
      tr.appendChild(tdDesc);
      const tdAmt = d.createElement('td');
      tdAmt.style.textAlign = 'right';
      tdAmt.textContent = formatPHP(li.amount);
      tr.appendChild(tdAmt);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    d.body.appendChild(table);

    const totalDiv = d.createElement('div');
    totalDiv.className = 'total';
    totalDiv.textContent = 'Total: ' + formatPHP(inv.total);
    d.body.appendChild(totalDiv);

    const footer = d.createElement('div');
    footer.className = 'footer';
    footer.textContent = 'This document is not valid for claim of input tax.';
    d.body.appendChild(footer);

    setTimeout(() => w.print(), 200);
  },

  // ============================================================
  // Templates View
  // ============================================================
  renderTemplates() {
    const entity = Auth.activeEntity;
    const wrapper = el('div');

    const headerBar = el('div', { class: 'form-header-bar' });
    headerBar.appendChild(el('h2', { text: 'Billing Templates' }));
    const topActions = el('div', { class: 'form-actions-top' });
    const backBtn = el('button', { class: 'btn btn-ghost', text: '← Back to Invoices' });
    backBtn.addEventListener('click', () => { this.view = 'list'; App.handleRoute(); });
    topActions.appendChild(backBtn);
    const addBtn = el('button', { class: 'btn btn-primary', text: 'New Template' });
    addBtn.addEventListener('click', () => this.showTemplateForm(wrapper));
    topActions.appendChild(addBtn);
    headerBar.appendChild(topActions);
    wrapper.appendChild(headerBar);

    const listContainer = el('div');
    wrapper.appendChild(listContainer);
    this.refreshTemplateList(listContainer);
    return wrapper;
  },

  refreshTemplateList(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    const entity = Auth.activeEntity;
    const templates = DB.getWhere('billingTemplates', t => t.entity === entity);
    if (templates.length === 0) {
      container.appendChild(el('p', { text: 'No billing templates found.', class: 'empty-state' }));
      return;
    }
    templates.forEach(t => {
      const client = DB.getById('clients', t.clientId);
      const card = el('div', { class: 'card' });
      card.appendChild(el('h3', { text: t.name }));
      card.appendChild(el('p', { text: 'Client: ' + (client?.name || '—') + ' | Schedule: ' + t.schedule + ' | PF: ' + formatPHP(t.pfAmount) }));
      const actions = el('div', { class: 'form-actions-top', style: 'margin-top:12px;' });
      const genBtn = el('button', { class: 'btn btn-primary btn-sm', text: 'Generate Next Period' });
      genBtn.addEventListener('click', () => this.generateFromTemplate(t));
      actions.appendChild(genBtn);
      card.appendChild(actions);
      container.appendChild(card);
    });
  },

  showTemplateForm(container) {
    const entity = Auth.activeEntity;
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(el('h3', { text: 'New Billing Template' }));
    const form = el('form', { class: 'form-stacked', style: 'max-width:500px;' });
    form.appendChild(el('div', { class: 'form-group' }, [el('label', { text: 'Template Name *' }), el('input', { type: 'text', name: 'name', required: true })]));

    const clientGroup = el('div', { class: 'form-group' });
    clientGroup.appendChild(el('label', { text: 'Client *' }));
    const clientSel = el('select', { name: 'clientId', required: true });
    clientSel.appendChild(el('option', { value: '', text: '— Select Client —' }));
    DB.getWhere('clients', c => c.entity === entity).forEach(c => {
      clientSel.appendChild(el('option', { value: c.id, text: c.name }));
    });
    clientGroup.appendChild(clientSel);
    form.appendChild(clientGroup);

    const schedGroup = el('div', { class: 'form-group' });
    schedGroup.appendChild(el('label', { text: 'Schedule *' }));
    const schedSel = el('select', { name: 'schedule', required: true });
    ['monthly', 'quarterly'].forEach(s => schedSel.appendChild(el('option', { value: s, text: s })));
    schedGroup.appendChild(schedSel);
    form.appendChild(schedGroup);

    form.appendChild(el('div', { class: 'form-group' }, [el('label', { text: 'PF Amount *' }), el('input', { type: 'number', name: 'pfAmount', min: 0, step: 0.01, required: true })]));

    const btnGroup = el('div', { class: 'form-actions' });
    const saveBtn = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Save Template' });
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: 'Cancel' });
    cancelBtn.addEventListener('click', () => { this.view = 'templates'; App.handleRoute(); });
    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(cancelBtn);
    form.appendChild(btnGroup);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const record = {
        id: generateId('bt'),
        name: fd.get('name').trim(),
        clientId: fd.get('clientId'),
        entity: entity,
        schedule: fd.get('schedule'),
        pfAmount: parseFloat(fd.get('pfAmount')) || 0,
        lineItems: [
          { type: 'PF', description: fd.get('name').trim(), amount: parseFloat(fd.get('pfAmount')) || 0 }
        ],
        createdAt: new Date().toISOString()
      };
      DB.insert('billingTemplates', record);
      this.view = 'templates';
      App.handleRoute();
    });
    container.appendChild(form);
  },

  generateFromTemplate(t) {
    const entity = Auth.activeEntity;
    const now = new Date();
    const inv = {
      id: generateId('inv'),
      clientId: t.clientId,
      entity: entity,
      invoiceNumber: this.nextInvoiceNumber(entity),
      issueDate: now.toISOString().slice(0, 10),
      dueDate: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().slice(0, 10),
      status: 'Draft',
      lineItems: deepClone(t.lineItems || []),
      subtotal: t.pfAmount || 0,
      vat: 0,
      total: t.pfAmount || 0,
      paidAmount: 0,
      payments: [],
      createdBy: Auth.user.id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    DB.insert('invoices', inv);
    alert('Generated invoice ' + inv.invoiceNumber);
    this.view = 'list';
    App.handleRoute();
  },

  // ============================================================
  // Aging Report
  // ============================================================
  renderAging() {
    const entity = Auth.activeEntity;
    const today = new Date();
    const invoices = DB.getWhere('invoices', inv => inv.entity === entity && inv.status !== 'Paid' && inv.status !== 'Cancelled');

    const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };
    invoices.forEach(inv => {
      const days = Math.floor((today - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
      if (days <= 30) buckets['0-30'].push(inv);
      else if (days <= 60) buckets['31-60'].push(inv);
      else if (days <= 90) buckets['61-90'].push(inv);
      else buckets['90+'].push(inv);
    });

    const container = el('div');
    const topActions = el('div', { class: 'form-header-bar', style: 'margin-bottom: var(--spacing-lg);' });
    topActions.appendChild(el('h2', { text: 'Aging Report' }));
    const backBtn = el('button', { class: 'btn btn-ghost btn-sm', text: '← Back to List' });
    backBtn.addEventListener('click', () => { this.view = 'list'; App.handleRoute(); });
    topActions.appendChild(backBtn);
    container.appendChild(topActions);

    const grid = el('div', { class: 'kpi-grid' });
    Object.entries(buckets).forEach(([label, invs]) => {
      const total = invs.reduce((sum, inv) => sum + (inv.total - this.getPaidAmount(inv)), 0);
      grid.appendChild(this.kpiCard(label + ' Days', invs.length + ' invoices', formatPHP(total)));
    });
    container.appendChild(grid);

    return container;
  },

  kpiCard(label, sub, value) {
    const card = el('div', { class: 'kpi-card' });
    card.appendChild(el('div', { class: 'kpi-label', text: label }));
    card.appendChild(el('div', { class: 'kpi-sub', text: sub }));
    card.appendChild(el('div', { class: 'kpi-value', text: value }));
    return card;
  }
};
