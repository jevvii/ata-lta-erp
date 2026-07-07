/**
 * Client Management Module
 * List, search, create, edit clients scoped to active entity.
 */

const Clients = {
  editingId: null,
  activeTab: 'active',

  render() {
    if (!this.activeTab) this.activeTab = 'active';
    const container = el('div', { class: 'page' });
    
    container.classList.add('clients-tab-page');
    const titleBar = el('div', { class: 'page-title-bar-v2' });
    titleBar.appendChild(el('h1', { text: 'Clients' }));
    container.appendChild(titleBar);
    container.appendChild(this.renderTabNav());

    // Toolbar (Sticky Container)
    const stickyContainer = el('div', { class: 'toolbar-sticky-container' });
    const filters = el('div', { class: 'filters-bar' });
    const searchWrapper = el('div', { style: 'position: relative; display: flex; align-items: center; width: 100%; max-width: 320px;' });
    
    const searchIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    searchIcon.setAttribute('width', '14');
    searchIcon.setAttribute('height', '14');
    searchIcon.setAttribute('viewBox', '0 0 24 24');
    searchIcon.setAttribute('fill', 'none');
    searchIcon.setAttribute('stroke', 'currentColor');
    searchIcon.setAttribute('stroke-width', '2.5');
    searchIcon.setAttribute('stroke-linecap', 'round');
    searchIcon.setAttribute('stroke-linejoin', 'round');
    searchIcon.setAttribute('style', 'position: absolute; left: 12px; color: var(--color-text-muted); pointer-events: none;');
    searchIcon.innerHTML = '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>';
    
    const search = el('input', {
      type: 'text',
      placeholder: 'Search by taxpayer, trade name, or TIN...',
      class: 'form-control search-input',
      style: 'width: 100%; padding-left: 36px; max-width: 320px;'
    });
    
    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(search);
    filters.appendChild(searchWrapper);
    stickyContainer.appendChild(filters);
    container.appendChild(stickyContainer);

    const content = el('div', { class: 'page-content-section' });

    const listContainer = el('div', { class: 'list-container' + (this.activeTab === 'archived' ? ' hidden' : '') });
    content.appendChild(listContainer);
    if (this.activeTab === 'active') {
      this.renderList(listContainer, '');
    }

    const archiveContainer = el('div', { class: 'archive-container' + (this.activeTab === 'active' ? ' hidden' : '') });
    content.appendChild(archiveContainer);
    if (this.activeTab === 'archived') {
      archiveContainer.appendChild(this.renderArchive(''));
    }

    container.appendChild(content);

    search.addEventListener('input', debounce(() => {
      const q = search.value.trim();
      if (this.activeTab === 'active') {
        this.renderList(listContainer, q);
      } else {
        this.clearNode(archiveContainer);
        archiveContainer.appendChild(this.renderArchive(q));
      }
    }, 200));

    const formContainer = el('div', { class: 'form-container hidden' });
    container.appendChild(formContainer);

    // Full-page form route: when editingId is set (e.g. from #clients/form/:id),
    // render the form inline instead of the list/archive tab content.
    if (this.editingId) {
      while (container.firstChild) container.removeChild(container.firstChild);
      container.classList.add('clients-tab-page');
      const isNew = this.editingId === 'new';
      const client = isNew ? null : DB.getById('clients', this.editingId);
      container.appendChild(buildFormBreadcrumb({
        baseLabel: 'Clients',
        baseHash: '#clients',
        currentText: isNew ? 'Add Client' : (client?.name || 'Edit Client'),
        actions: [
          { text: '← Back to Clients', class: 'btn btn-secondary btn-sm', onClick: () => { this.editingId = null; location.hash = '#clients'; } }
        ]
      }));
      container.appendChild(this.renderForm(el('div'), this.editingId));
    }

    setTimeout(() => this.updateStickyOffsets(), 0);
    return container;
  },

  init() {
    this.updateStickyOffsets();
  },

  updateStickyOffsets() {
    App.updateStickyOffsets();
  },

  renderTabNav() {
    const entity = Auth.activeEntity;
    const activeCount = DB.getWhere('clients', c => {
      const cEnt = (c.entity || '').toUpperCase();
      const matchesEntity = (entity === 'ALL' ? Auth.user.entities.map(ae => ae.toUpperCase()).includes(cEnt) : cEnt === entity.toUpperCase());
      return matchesEntity && c.status !== 'Archived';
    }).length;

    const isAdmin = Auth.user?.role === 'Admin';

    const archivedCount = DB.getWhere('clients', c => {
      const cEnt = (c.entity || '').toUpperCase();
      const matchesEntity = (entity === 'ALL' ? Auth.user.entities.map(ae => ae.toUpperCase()).includes(cEnt) : cEnt === entity.toUpperCase());
      return matchesEntity && c.status === 'Archived';
    }).length;

    const entFilter = ent => {
      const uEnt = (ent || '').toUpperCase();
      if (entity === 'ALL') return Auth.user.entities.map(ae => ae.toUpperCase()).includes(uEnt);
      return uEnt === entity.toUpperCase();
    };

    const rejectedClientChanges = DB.getWhere('pendingChanges', pc => {
      if (pc.table !== 'clients' || pc.status !== 'rejected') return false;
      const data = pc.proposedData || {};
      if (!entFilter(data.entity)) return false;
      if (!isAdmin && pc.submittedBy !== Auth.user.id) return false;
      return true;
    });

    const rejectedClientRequests = DB.getWhere('operationsRequests', r => {
      if (r.type !== 'client' || r.status !== 'rejected') return false;
      if (!entFilter(r.entity)) return false;
      if (!isAdmin && r.requestedBy !== Auth.user.id) return false;
      return true;
    });

    const rejectedCount = rejectedClientChanges.length + rejectedClientRequests.length;
    const archiveCount = archivedCount + rejectedCount;

    const tabs = [
      { key: 'active', label: 'Active Clients', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', count: activeCount },
      { key: 'archived', label: 'Archive', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>', count: archiveCount }
    ];

    const tabNav = renderModuleTabNav(tabs, this.activeTab, (key) => {
      this.activeTab = key;
      App.handleRoute();
    });

    if (Auth.can('clients:edit') && this.activeTab === 'active') {
      const addBtn = el('button', {
        class: 'btn btn-primary btn-sm',
        style: 'margin-left: 16px; display: inline-flex; align-items: center; gap: 6px;',
        html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Client'
      });
      addBtn.addEventListener('click', () => this.showForm());
      tabNav.appendChild(addBtn);
    }

    return tabNav;
  },

  clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  },

  getFilteredClients(query) {
    const entity = Auth.activeEntity;
    let clients = DB.getWhere('clients', c => {
      const matchesEntity = (entity === 'ALL' ? Auth.user.entities.includes(c.entity) : c.entity === entity);
      return matchesEntity && c.status !== 'Archived';
    });
    if (query) {
      const q = query.toLowerCase();
      clients = clients.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.tradeName || '').toLowerCase().includes(q) ||
        (c.tin || '').toLowerCase().includes(q)
      );
    }

    return clients;
  },

  renderList(container, query) {
    this.clearNode(container);
    const clients = this.getFilteredClients(query);

    if (clients.length === 0) {
      container.appendChild(renderEmptyState('No clients found', null, { variant: 'zero-state' }));
      return;
    }

    const buildingIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/><path d="M10 9h4"/><path d="M10 13h4"/></svg>';

    const items = clients.map((c, idx) => {
      const pocUser = DB.getById('users', c.contactUserId);
      const tags = [
        { text: c.entity, type: 'entity', className: 'badge badge-' + (c.entity === 'ATA' ? 'info' : 'success'), style: 'display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 18px; font-size: 0.6875rem; font-weight: 700;' },
        (c.retainer || c.isRetainer)
          ? { text: 'Retainer', type: 'fund', className: 'badge badge-recurring', style: 'display: inline-flex; align-items: center; justify-content: center; width: 70px; height: 18px; font-size: 0.6875rem; font-weight: 700;' }
          : { text: '', type: 'fund', className: 'hidden-tag-placeholder' },
        c.tin
          ? { text: 'TIN ' + c.tin, type: 'category' }
          : { text: '', type: 'category', className: 'hidden-tag-placeholder' },
        (pocUser?.name || c.contactPerson)
          ? { text: pocUser?.name || c.contactPerson, type: 'client' }
          : { text: '', type: 'client', className: 'hidden-tag-placeholder' }
      ];

      const trade = c.tradeName ? 'Trade: ' + c.tradeName : '';
      const address = c.address ? 'Address: ' + c.address : '';
      const rcList = (c.relatedCompanies || []).map(rc => {
        const rcClient = DB.getById('clients', rc.clientId);
        return (rcClient?.name || '—') + ' (' + rc.relationType + ')';
      }).join(', ');
      const related = rcList ? 'Related: ' + rcList : '';
      const cdList = (c.contactDetails || []).map(cd => cd.type + ': ' + cd.value).join(', ');
      const contacts = cdList ? 'Contacts: ' + cdList : '';
      const secondary = [trade, address, related, contacts].filter(Boolean).join(' • ') || null;

      return {
        id: c.id,
        keyText: 'CL-' + String(idx + 1).padStart(2, '0'),
        name: c.name || '(untitled)',
        iconHtml: buildingIcon,
        tags,
        secondary
      };
    });

    const backlog = JiraBacklogList.render({
      title: 'Active Clients',
      subtitle: 'taxpayers, trade names, contacts, and retainer agreements',
      items,
      emptyText: 'No clients found',
      rowIdPrefix: 'CL',
      countLabel: 'client',
      bulkActions: [],
      columns: [
        { label: 'Entity', width: '60px', align: 'center' },
        { label: 'Retainer', width: '90px', align: 'center' },
        { label: 'TIN', width: '130px' },
        { label: 'Point of Contact', width: '180px' }
      ],
      headerActions: [
        {
          text: '+ Add Client',
          className: 'btn btn-primary btn-sm',
          onClick: () => this.showForm()
        }
      ],
      rowActions: (item) => {
        if (!Auth.can('clients:edit')) return [];
        return [
          {
            text: 'Edit',
            className: 'btn btn-secondary btn-xs',
            onClick: () => this.showForm(item.id)
          },
          {
            text: 'Archive',
            className: 'btn btn-secondary btn-xs text-danger',
            onClick: () => {
              if (Auth.user.role === 'Admin') {
                this.archiveClientDirectly(item.id);
              } else {
                this.archiveClientRequest(item.id);
              }
            }
          }
        ];
      }
    });

    container.appendChild(backlog);
  },

  showForm(clientId) {
    this.editingId = clientId || 'new';
    const isNew = this.editingId === 'new';
    const client = isNew ? null : DB.getById('clients', this.editingId);
    const fullPageRoute = isNew ? '#clients/form/new' : `#clients/form/${clientId}`;

    const formContainer = el('div', { class: 'form-container' });
    this.renderForm(formContainer, this.editingId);

    openFormPanel({
      icon: '🏢',
      title: isNew ? 'Add Client' : (client?.name || 'Edit Client'),
      formContent: formContainer,
      formId: 'client-form',
      viewContext: 'client-form',
      fullPageRoute,
      newTabRoute: fullPageRoute,
      actions: [
        { text: isNew ? 'Save Client' : 'Save Changes', class: 'btn btn-primary', type: 'submit', form: 'client-form', testId: 'client-save' },
        { text: 'Cancel', class: 'btn btn-secondary', onClick: () => this.showList(), testId: 'client-cancel' }
      ]
    });
  },

  renderForm(container, clientId) {
    const client = clientId && clientId !== 'new' ? DB.getById('clients', clientId) : null;
    this.clearNode(container);

    // Form header bar (actions only; title is handled by the inline title input
    // and by the full-page breadcrumb header)
    const headerBar = el('div', { class: 'form-header-bar' });
    const headerActions = el('div', { class: 'form-actions-top' });
    const saveBtnTop = el('button', { type: 'submit', form: 'client-form', class: 'btn btn-primary', text: client ? 'Save Changes' : 'Save Client' });
    headerActions.appendChild(saveBtnTop);
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.showList());
    headerActions.appendChild(cancelBtn);
    headerBar.appendChild(headerActions);
    container.appendChild(headerBar);

    const form = el('form', { id: 'client-form', class: 'form-stacked notion-form' });

    // ── Identity free-form block ──
    const identitySection = el('div', { class: 'notion-freeform notion-freeform--title' });
    identitySection.appendChild(el('label', { class: 'notion-section-label', text: 'Client Name' }));
    const nameInput = el('input', { type: 'text', name: 'name', class: 'notion-freeform-input notion-title-input', placeholder: 'Taxpayer / company name', required: true, value: client ? (client.name || '') : '' });
    identitySection.appendChild(nameInput);
    if (!client) {
      setTimeout(() => { nameInput.focus(); nameInput.select(); }, 60);
    }
    form.appendChild(identitySection);

    // ── Property grid ──
    const propsGrid = el('div', { class: 'notion-property-grid' });

    const tinProp = el('div', { class: 'notion-prop' });
    tinProp.appendChild(el('label', { html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> TIN' }));
    tinProp.appendChild(el('input', { type: 'text', name: 'tin', class: 'notion-prop-input', placeholder: 'XXX-XXX-XXX-XXXX', required: true, value: client ? (client.tin || '') : '' }));
    propsGrid.appendChild(tinProp);

    const tradeProp = el('div', { class: 'notion-prop' });
    tradeProp.appendChild(el('label', { html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h20M2 6h20M2 10h20M2 14h20"/></svg> Trade Name' }));
    tradeProp.appendChild(el('input', { type: 'text', name: 'tradeName', class: 'notion-prop-input', placeholder: 'e.g. DBA name', value: client ? (client.tradeName || '') : '' }));
    propsGrid.appendChild(tradeProp);

    const entityProp = el('div', { class: 'notion-prop' });
    entityProp.appendChild(el('label', { html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Entity' }));
    const entitySel = el('select', { name: 'entity', class: 'notion-prop-select', required: true });
    ['ATA', 'LTA'].forEach(e => {
      const opt = el('option', { value: e, text: e });
      if (client ? client.entity === e : Auth.activeEntity === e) opt.selected = true;
      entitySel.appendChild(opt);
    });
    entityProp.appendChild(entitySel);
    propsGrid.appendChild(entityProp);

    const pocProp = el('div', { class: 'notion-prop' });
    pocProp.appendChild(el('label', { html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Point of Contact' }));
    const pocInput = el('input', { type: 'text', name: 'pointOfContactInput', class: 'notion-prop-input', list: 'staff-list', placeholder: '— Select or type Staff —' });
    const datalist = el('datalist', { id: 'staff-list' });
    DB.getWhere('users', u => {
      const userEntities = (u.entities || []).map(e => e.toUpperCase());
      return Auth.ALL_ROLES.includes(u.role) && userEntities.includes(Auth.activeEntity);
    }).forEach(u => { datalist.appendChild(el('option', { value: u.name + ' (' + u.role + ')' })); });
    if (client) {
      if (client.contactUserId) {
        const u = DB.getById('users', client.contactUserId);
        if (u) pocInput.value = u.name + ' (' + u.role + ')';
      } else if (client.contactPerson) {
        pocInput.value = client.contactPerson;
      }
    }
    pocProp.appendChild(pocInput);
    pocProp.appendChild(datalist);
    propsGrid.appendChild(pocProp);

    const retainerProp = el('div', { class: 'notion-prop notion-prop-checkbox' });
    const retainerLabel = el('label', { class: 'checkbox-label' });
    const retainerCb = el('input', { type: 'checkbox', name: 'retainer' });
    if (client && (client.retainer || client.isRetainer)) retainerCb.checked = true;
    retainerLabel.appendChild(retainerCb);
    retainerLabel.appendChild(document.createTextNode(' On retainer'));
    retainerProp.appendChild(retainerLabel);
    propsGrid.appendChild(retainerProp);

    form.appendChild(propsGrid);

    // Address free-form
    const addrSection = el('div', { class: 'notion-freeform' });
    addrSection.appendChild(el('label', { class: 'notion-section-label', text: 'Business Address' }));
    addrSection.appendChild(el('input', { type: 'text', name: 'address', class: 'notion-freeform-input', placeholder: 'Enter business address', value: client ? (client.address || '') : '' }));
    form.appendChild(addrSection);

    // Contact Details (multi-entry) — Notion-style
    form.appendChild(el('h3', { class: 'notion-section-heading', text: 'Contact Details' }));
    const cdSection = el('div', { class: 'notion-line-items' });
    const cdContainer = el('div', { id: 'contact-details-container' });
    const contactDetails = client && Array.isArray(client.contactDetails) ? client.contactDetails : [];
    contactDetails.forEach((cd, idx) => this.addContactDetailRow(cdContainer, cd, idx));
    cdSection.appendChild(cdContainer);
    const addCdBtn = el('button', { type: 'button', class: 'notion-add-line-item', text: '+ Add Contact Detail' });
    addCdBtn.addEventListener('click', () => this.addContactDetailRow(cdContainer, null, cdContainer.childElementCount));
    cdSection.appendChild(addCdBtn);
    form.appendChild(cdSection);

    // Related Companies (multi-entry) — Notion-style
    form.appendChild(el('h3', { class: 'notion-section-heading', text: 'Related Companies' }));
    const rcSection = el('div', { class: 'notion-line-items' });
    const rcContainer = el('div', { id: 'related-companies-container' });
    const relatedCompanies = client && Array.isArray(client.relatedCompanies) ? client.relatedCompanies : [];
    relatedCompanies.forEach((rc, idx) => this.addRelatedCompanyRow(rcContainer, rc, idx));
    rcSection.appendChild(rcContainer);
    const addRcBtn = el('button', { type: 'button', class: 'notion-add-line-item', text: '+ Add Related Company' });
    addRcBtn.addEventListener('click', () => this.addRelatedCompanyRow(rcContainer, null, rcContainer.childElementCount));
    rcSection.appendChild(addRcBtn);
    form.appendChild(rcSection);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitForm(form);
    });

    container.appendChild(form);
    return container;
  },

  addContactDetailRow(container, data, idx) {
    const row = el('div', { class: 'notion-line-item-row notion-sub-row' });

    const dragHandle = el('div', {
      class: 'notion-line-item-drag',
      title: 'Drag to reorder',
      html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>'
    });
    row.appendChild(dragHandle);

    const typeSel = el('select', { class: 'notion-line-item-type', name: 'cd-type-' + idx, style: 'flex: 0 0 100px;' });
    ['mobile', 'landline', 'email'].forEach(t => {
      typeSel.appendChild(el('option', { value: t, text: t.charAt(0).toUpperCase() + t.slice(1) }));
    });
    if (data && data.type) typeSel.value = data.type;
    const valueInput = el('input', { type: 'text', class: 'notion-line-item-desc', placeholder: 'Value', name: 'cd-value-' + idx, value: data ? (data.value || '') : '' });

    const updatePlaceholder = () => {
      if (typeSel.value === 'mobile') {
        valueInput.placeholder = 'e.g. 09123456789 (11 digits)';
        valueInput.maxLength = 11;
      } else if (typeSel.value === 'landline') {
        valueInput.placeholder = 'e.g. 123456789 (9 digits)';
        valueInput.maxLength = 9;
      } else if (typeSel.value === 'email') {
        valueInput.placeholder = 'e.g. user@theiremail.com';
        valueInput.removeAttribute('maxLength');
      }
      if (valueInput.value) valueInput.dispatchEvent(new Event('input'));
    };

    valueInput.addEventListener('input', (e) => {
      if (typeSel.value === 'mobile' || typeSel.value === 'landline') {
        e.target.value = e.target.value.replace(/\D/g, '');
      }
    });

    typeSel.addEventListener('change', updatePlaceholder);
    updatePlaceholder();

    const labelInput = el('input', { type: 'text', class: 'notion-line-item-desc', style: 'flex: 0 0 140px;', placeholder: 'Label', name: 'cd-label-' + idx, value: data ? (data.label || '') : '' });
    const removeBtn = el('button', {
      type: 'button',
      class: 'notion-line-item-remove',
      title: 'Remove',
      html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    });
    removeBtn.addEventListener('click', () => row.remove());
    row.appendChild(typeSel);
    row.appendChild(valueInput);
    row.appendChild(labelInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  },

  addRelatedCompanyRow(container, data, idx) {
    const row = el('div', { class: 'notion-line-item-row notion-sub-row' });

    const dragHandle = el('div', {
      class: 'notion-line-item-drag',
      title: 'Drag to reorder',
      html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>'
    });
    row.appendChild(dragHandle);

    const entity = Auth.activeEntity;
    const clientSel = el('select', { class: 'notion-line-item-type', name: 'rc-client-' + idx, style: 'flex: 1 1 auto; min-width: 160px;' });
    clientSel.appendChild(el('option', { value: '', text: '— Select Client —' }));
    DB.getWhere('clients', c => c.entity === entity).forEach(c => {
      if (this.editingId && c.id === this.editingId) return;
      clientSel.appendChild(el('option', { value: c.id, text: c.name }));
    });
    if (data && data.clientId) clientSel.value = data.clientId;
    const relSel = el('select', { class: 'notion-line-item-type', name: 'rc-relation-' + idx, style: 'flex: 0 0 150px;' });
    ['Parent', 'Subsidiary', 'Sister Company', 'Affiliate'].forEach(r => {
      relSel.appendChild(el('option', { value: r, text: r }));
    });
    if (data && data.relationType) relSel.value = data.relationType;
    const removeBtn = el('button', {
      type: 'button',
      class: 'notion-line-item-remove',
      title: 'Remove',
      html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    });
    removeBtn.addEventListener('click', () => row.remove());
    row.appendChild(clientSel);
    row.appendChild(relSel);
    row.appendChild(removeBtn);
    container.appendChild(row);
  },

  showList() {
    this.editingId = null;
    closeFormPanelAndRoute('#clients');
  },

  submitForm(form) {
    if (!validateRequiredFields(form)) return;

    const data = Object.fromEntries(new FormData(form).entries());

    if (!data.tin || !/^\d{3}-\d{3}-\d{3}-\d{4}$/.test(data.tin)) {
      const tinField = form.querySelector('[name="tin"]');
      showFieldError(tinField, 'TIN must be in format XXX-XXX-XXX-XXXX.');
      return;
    }

    const entityRadio = form.querySelector('[name="entity"]:checked, select[name="entity"]');
    if (!entityRadio || !entityRadio.value) {
      showFieldError(entityRadio || form.querySelector('[name="entity"]'), 'Entity is required.');
      return;
    }
    // Collect contact details
    const contactDetails = [];
    let hasContactError = false;
    const cdContainer = document.getElementById('contact-details-container');
    if (cdContainer) {
      cdContainer.querySelectorAll('.notion-sub-row').forEach(row => {
        const valueInput = row.querySelector('input[name^="cd-value-"]');
        const labelInput = row.querySelector('input[name^="cd-label-"]');
        if (!valueInput || !labelInput) return;

        const type = row.querySelector('select[name^="cd-type-"]')?.value;
        const value = valueInput.value.trim();
        const label = labelInput.value.trim();

        if (value || label) {
          if (!label) {
            showFieldError(labelInput, 'Label is required.');
            hasContactError = true;
          }
          if (!value) {
            showFieldError(valueInput, 'Value is required.');
            hasContactError = true;
          } else {
            if (type === 'mobile' && !/^\d{11}$/.test(value)) {
              showFieldError(valueInput, 'Mobile must be exactly 11 digits.');
              hasContactError = true;
            } else if (type === 'landline' && !/^\d{9}$/.test(value)) {
              showFieldError(valueInput, 'Landline must be exactly 9 digits.');
              hasContactError = true;
            } else if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              showFieldError(valueInput, 'Please enter a valid email address.');
              hasContactError = true;
            }
          }
          contactDetails.push({ type, value, label });
        }
      });
    }

    if (hasContactError) return;

    // Collect related companies
    const relatedCompanies = [];
    const rcContainer = document.getElementById('related-companies-container');
    if (rcContainer) {
      rcContainer.querySelectorAll('.notion-sub-row').forEach(row => {
        const clientId = row.querySelector('select[name^="rc-client-"]')?.value;
        const relationType = row.querySelector('select[name^="rc-relation-"]')?.value;
        if (clientId && relationType) {
          relatedCompanies.push({ clientId, relationType });
        }
      });
    }

    const pocInputValue = (data.pointOfContactInput || '').trim();
    let contactUserId = '';
    let contactPerson = '';

    if (pocInputValue) {
      const matchedUser = DB.getWhere('users', u => (u.name + ' (' + u.role + ')') === pocInputValue)[0];
      if (matchedUser) {
        contactUserId = matchedUser.id;
      } else {
        contactPerson = pocInputValue;
      }
    }

    const record = {
      name: data.name.trim(),
      tin: data.tin.trim(),
      address: data.address ? data.address.trim() : '',
      tradeName: data.tradeName ? data.tradeName.trim() : '',
      contactUserId,
      entity: data.entity || (Auth.activeEntity !== 'ALL' ? Auth.activeEntity : 'ATA'),
      retainer: !!form.querySelector('input[name="retainer"]:checked'),
      contactDetails,
      relatedCompanies
    };

    if (this.editingId && this.editingId !== 'new') {
      record.id = this.editingId;
      const old = DB.getById('clients', this.editingId);
      if (old) {
        record.createdAt = old.createdAt;
        // Preserve legacy fields no longer in form
        record.phone = old.phone || '';
        record.email = old.email || '';
      }
      record.contactPerson = contactPerson;
      PendingChanges.submit('clients', record, false);
    } else {
      record.id = generateId('c');
      record.createdAt = new Date().toISOString();
      record.contactPerson = contactPerson;
      PendingChanges.submit('clients', record, true);
    }

    const isNew = !this.editingId || this.editingId === 'new';
    const isApproved = Auth.user.role === 'Admin' || Auth.user.role === 'Manager';
    const msgConfig = {
      title: isNew ? 'Client Created' : 'Client Updated',
      message: isApproved 
        ? `Client ${record.name} has been successfully ${isNew ? 'created' : 'updated'}.` 
        : `Client ${record.name} ${isNew ? 'creation' : 'update'} request has been submitted for Admin approval.`,
      type: 'success'
    };
    closeFormPanelAndRoute('#clients', msgConfig);
  },

  archiveClientDirectly(clientId) {
    if (!confirm('Are you sure you want to archive this client? This will cancel all related work requests and archive all associated documents.')) return;
    
    // 1. Update the client status to 'Archived'
    const client = DB.getById('clients', clientId);
    if (!client) return;
    client.status = 'Archived';
    client.updatedAt = new Date().toISOString();
    DB.update('clients', clientId, client);

    // 2. Cascade to Work Requests and Documents
    const wrs = DB.getWhere('workRequests', wr => wr.clientId === clientId);
    wrs.forEach(wr => {
      DB.update('workRequests', wr.id, { status: 'Cancelled', updatedAt: new Date().toISOString() });

      // Cascade to Documents
      const docs = DB.getWhere('documents', doc => doc.workRequestId === wr.id);
      docs.forEach(doc => {
        DB.update('documents', doc.id, { status: 'Archived', archived: true });
      });
    });

    alert('Client archived successfully.');
    App.handleRoute();
  },

  archiveClientRequest(clientId) {
    // Check if there is already a pending change to archive this client
    const pending = DB.getWhere('pendingChanges', pc => 
      pc.table === 'clients' && 
      pc.parentRecordId === clientId && 
      pc.status === 'pending' && 
      pc.proposedData && 
      pc.proposedData.status === 'Archived'
    );
    if (pending.length > 0) {
      alert('An archive request for this client is already pending approval.');
      return;
    }

    if (!confirm('Are you sure you want to request archiving this client? This requires Admin approval.')) return;

    const client = DB.getById('clients', clientId);
    if (!client) return;

    const proposed = deepClone(client);
    proposed.status = 'Archived';
    proposed.updatedAt = new Date().toISOString();

    const pc = {
      id: generateId('pc'),
      table: 'clients',
      parentRecordId: clientId,
      proposedData: proposed,
      submittedBy: Auth.user.id,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      rejectionReason: '',
      reviewedBy: '',
      reviewedAt: ''
    };
    DB.insert('pendingChanges', pc);

    alert('Archive request submitted for Admin approval.');
    App.handleRoute();
  },

  unarchiveClient(id) {
    const client = DB.getById('clients', id);
    if (!client || client.status !== 'Archived') return;
    DB.update('clients', id, { status: 'Active', archived: false, updatedAt: new Date().toISOString() });
    App.handleRoute();
  },

  getArchivedClients(query) {
    const entity = Auth.activeEntity;
    let clients = DB.getWhere('clients', c => {
      const matchesEntity = (entity === 'ALL' ? Auth.user.entities.includes(c.entity) : c.entity === entity);
      return matchesEntity && c.status === 'Archived';
    });

    if (query) {
      const q = query.toLowerCase();
      clients = clients.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.tradeName || '').toLowerCase().includes(q) ||
        (c.tin || '').toLowerCase().includes(q)
      );
    }

    return clients;
  },

  renderArchive(query = '') {
    const entity = Auth.activeEntity;
    const self = this;
    const isAdmin = Auth.user?.role === 'Admin';

    const entFilter = ent => {
      const uEnt = (ent || '').toUpperCase();
      if (entity === 'ALL') return Auth.user.entities.map(ae => ae.toUpperCase()).includes(uEnt);
      return uEnt === entity.toUpperCase();
    };

    let archived = DB.getWhere('clients', c => entFilter(c.entity) && c.status === 'Archived');
    if (query) {
      const q = query.toLowerCase();
      archived = archived.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.tradeName || '').toLowerCase().includes(q) ||
        (c.tin || '').toLowerCase().includes(q)
      );
    }

    const rejectedClientChanges = DB.getWhere('pendingChanges', pc => {
      if (pc.table !== 'clients' || pc.status !== 'rejected') return false;
      const data = pc.proposedData || {};
      if (!entFilter(data.entity)) return false;
      if (!isAdmin && pc.submittedBy !== Auth.user.id) return false;
      return true;
    });

    const rejectedClientRequests = DB.getWhere('operationsRequests', r => {
      if (r.type !== 'client' || r.status !== 'rejected') return false;
      if (!entFilter(r.entity)) return false;
      if (!isAdmin && r.requestedBy !== Auth.user.id) return false;
      return true;
    });

    const canEdit = Auth.can('clients:edit');

    const buildItem = (c, category) => {
      const pocUser = DB.getById('users', c.contactUserId);
      return {
        id: c.id,
        category,
        title: c.name || '(untitled)',
        description: `TIN: ${c.tin || '—'}`,
        meta: [
          { icon: ArchivePage.icons.client, text: pocUser?.name || c.contactPerson || '—' },
          { icon: ArchivePage.icons.status, text: c.tradeName || '—' },
          { icon: ArchivePage.icons.date, text: formatDate(c.updatedAt) }
        ],
        actions: [
          {
            label: 'View',
            icon: ArchivePage.icons.view,
            onClick: () => { location.hash = '#clients/form/' + c.id; }
          },
          ...(category === 'accomplished' && canEdit ? [{
            label: 'Restore',
            icon: ArchivePage.icons.restore,
            className: 'primary',
            onClick: () => self.unarchiveClient(c.id)
          }] : [])
        ]
      };
    };

    const buildRejectedItem = record => {
      const isOpReq = record.hasOwnProperty('requestedBy');
      const data = isOpReq ? record : (record.proposedData || {});
      const clientId = isOpReq ? record.clientId : data.id;
      const client = clientId ? DB.getById('clients', clientId) : null;
      const title = isOpReq
        ? `Client Request ${client ? '— ' + (client.name || '') : ''}`
        : `Client Change: ${data.name || '(untitled)'}`;
      const reason = data.rejectionReason || record.rejectionReason || 'Rejected';
      return {
        id: record.id,
        category: 'rejected',
        title,
        meta: [
          { icon: ArchivePage.icons.client, text: client ? (client.name || '—') : '—' },
          { icon: ArchivePage.icons.date, text: formatDate(record.reviewedAt || record.updatedAt || record.requestedAt) },
          { icon: ArchivePage.icons.status, text: `Reason: ${reason}` }
        ],
        actions: [
          ...(clientId ? [{
            label: 'View Client',
            icon: ArchivePage.icons.view,
            onClick: () => { location.hash = '#clients/form/' + clientId; }
          }] : [])
        ]
      };
    };

    return ArchivePage.render({
      module: 'clients',
      categoryLabels: { accomplished: 'Archived', cancelled: 'Cancelled', rejected: 'Rejected' },
      categories: {
        accomplished: archived.map(c => buildItem(c, 'accomplished')),
        cancelled: [],
        rejected: [
          ...rejectedClientChanges.map(buildRejectedItem),
          ...rejectedClientRequests.map(buildRejectedItem)
        ]
      },
      emptyText: 'Archive is empty.'
    });
  }
};
