/**
 * Dashboard Module — Firm Overview
 * Consolidated KPIs for managerial users; entity-scoped for staff.
 */

const Dashboard = {
  render() {
    const isManagerial = Auth.user.role === 'Admin' || Auth.user.role === 'Manager';
    if (isManagerial && Auth.user.entities.length > 1) {
      return this.renderConsolidated();
    }
    return this.renderEntityScoped();
  },

  renderConsolidated() {
    const ata = this.getEntityMetrics('ATA');
    const lta = this.getEntityMetrics('LTA');
    const container = el('div', { class: 'page' });
    const h1 = el('h1', {}, ['Firm Overview']);
    container.appendChild(h1);
    const grid = el('div', { class: 'kpi-grid' });
    grid.appendChild(this.kpiCard('ATA Revenue', ata.revenue, 'ata'));
    grid.appendChild(this.kpiCard('LTA Revenue', lta.revenue, 'lta'));
    grid.appendChild(this.kpiCard('Total Outstanding', ata.outstanding + lta.outstanding));
    grid.appendChild(this.kpiCard('Overdue Tasks', ata.overdue + lta.overdue));
    container.appendChild(grid);
    container.appendChild(this.renderComparisonTable(ata, lta));
    return container;
  },

  getEntityMetrics(entity) {
    const wrs = DB.getWhere('workRequests', r => r.entity === entity);
    const invs = DB.getWhere('invoices', r => r.entity === entity);
    const tasks = DB.getWhere('tasks', r => {
      const wr = DB.getById('workRequests', r.workRequestId);
      return wr && wr.entity === entity;
    });
    return {
      activeWR: wrs.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled').length,
      revenue: invs.filter(r => r.status === 'Paid' || r.status === 'Partially Paid').reduce((sum, r) => sum + (r.amountPaid || r.total), 0),
      outstanding: invs.filter(r => r.status === 'Sent' || r.status === 'Partially Paid' || r.status === 'Overdue').reduce((sum, r) => sum + (r.total - (r.amountPaid || 0)), 0),
      overdue: tasks.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled' && new Date(r.dueDate) < new Date()).length
    };
  },

  kpiCard(label, value, entity) {
    const card = el('div', { class: 'kpi-card' + (entity ? ' ' + entity : '') });
    const lbl = el('div', { class: 'kpi-label' }, [label]);
    const val = el('div', { class: 'kpi-value' }, [typeof value === 'number' && value > 100 ? formatPHP(value) : String(value)]);
    card.appendChild(lbl);
    card.appendChild(val);
    return card;
  },

  renderComparisonTable(ata, lta) {
    const section = el('div', { class: 'entity-comparison' });
    const h2 = el('h2', {}, ['Entity Comparison']);
    section.appendChild(h2);
    const table = el('table', { class: 'data-table' });

    const thead = el('thead');
    const headerRow = el('tr');
    headerRow.appendChild(el('th', {}, ['Metric']));
    headerRow.appendChild(el('th', {}, ['ATA']));
    headerRow.appendChild(el('th', {}, ['LTA']));
    headerRow.appendChild(el('th', {}, ['Total']));
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    const rows = [
      { label: 'Active Work Requests', ata: ata.activeWR, lta: lta.activeWR, isCurrency: false },
      { label: 'Revenue (Paid)', ata: ata.revenue, lta: lta.revenue, isCurrency: true },
      { label: 'Outstanding', ata: ata.outstanding, lta: lta.outstanding, isCurrency: true },
      { label: 'Overdue Tasks', ata: ata.overdue, lta: lta.overdue, isCurrency: false }
    ];
    rows.forEach(row => {
      const tr = el('tr');
      tr.appendChild(el('td', {}, [row.label]));
      tr.appendChild(el('td', {}, [row.isCurrency ? formatPHP(row.ata) : String(row.ata)]));
      tr.appendChild(el('td', {}, [row.isCurrency ? formatPHP(row.lta) : String(row.lta)]));
      tr.appendChild(el('td', {}, [row.isCurrency ? formatPHP(row.ata + row.lta) : String(row.ata + row.lta)]));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    section.appendChild(table);
    return section;
  },

  renderEntityScoped() {
    const metrics = this.getEntityMetrics(Auth.activeEntity);
    const container = el('div', { class: 'page' });
    container.appendChild(el('h1', {}, [Auth.activeEntity + ' Dashboard']));
    const grid = el('div', { class: 'kpi-grid' });
    grid.appendChild(this.kpiCard('Active Work Requests', metrics.activeWR));
    grid.appendChild(this.kpiCard('Revenue (Paid)', metrics.revenue));
    grid.appendChild(this.kpiCard('Outstanding', metrics.outstanding));
    grid.appendChild(this.kpiCard('Overdue Tasks', metrics.overdue));
    container.appendChild(grid);
    return container;
  },

  init() {}
};
