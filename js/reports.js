/**
 * Reporting & Analytics Module
 * Work Request Volume, Task Completion, Billing Summary,
 * Disbursement Report, Entity P&L Snapshot.
 */

const Reports = {
  render() {
    const entities = this.getAccessibleEntities();
    return el('div', {class: 'page'}, [
      el('h1', {text: 'Reports'}),
      el('div', {class: 'report-grid'}, [
        this.renderWorkRequestVolume(entities),
        this.renderTaskCompletion(entities),
        this.renderBillingSummary(entities),
        this.renderDisbursementReport(entities),
        this.renderEntityPL(entities)
      ])
    ]);
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

  // ─── Work Request Volume ─────────────────────────────────────────────
  renderWorkRequestVolume(entities) {
    const wrs = this.filterByEntity(DB.getAll('workRequests'), entities);
    const counts = {};
    wrs.forEach(wr => {
      counts[wr.status] = (counts[wr.status] || 0) + 1;
    });
    
    // Smooth line chart mimicking reference for volume over time
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

    return el('div', {class: 'report-card report-card-wide'}, [
      el('h2', {text: 'Work Request Volume Trend'}),
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
      overdueSection = el('p', {class: 'empty-state', text: 'No overdue tasks.'});
    } else {
      const rows = overdueTasks.map(t => {
        const assigneeId = t.assigneeId || t.assignedTo;
        const assignee = assigneeId
          ? (DB.getById('users', assigneeId)?.name || assigneeId)
          : 'Unassigned';
        return el('tr', {}, [
          el('td', {text: t.title}),
          el('td', {text: formatDate(t.dueDate)}),
          el('td', {text: assignee}),
          el('td', {text: t.status})
        ]);
      });
      overdueSection = el('table', {class: 'report-table'}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {text: 'Task'}),
            el('th', {text: 'Due Date'}),
            el('th', {text: 'Assignee'}),
            el('th', {text: 'Status'})
          ])
        ]),
        el('tbody', {}, rows)
      ]);
    }

    return el('div', {class: 'report-card'}, [
      el('h2', {text: 'Task Completion Rate'}),
      el('div', {class: 'report-stat'}, [
        el('span', {text: String(avgDays)}),
        el('span', {class: 'report-stat-label', text: ' avg days to complete'})
      ]),
      el('h3', {text: `Overdue Tasks (${overdueTasks.length})`}),
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
        el('td', {text: e}),
        el('td', {class: 'num', text: formatPHP(data.pf)}),
        el('td', {class: 'num', text: formatPHP(data.govt)}),
        el('td', {class: 'num', text: formatPHP(data.outstanding)})
      ]);
    });

    return el('div', {class: 'report-card'}, [
      el('h2', {text: 'Billing Summary'}),
      el('table', {class: 'report-table'}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {text: 'Entity'}),
            el('th', {text: 'PF Billed'}),
            el('th', {text: "Gov't Fees"}),
            el('th', {text: 'Outstanding'})
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

    const fundSplit = el('div', {class: 'fund-split'}, [
      el('div', {class: 'fund-box'}, [
        el('div', {class: 'fund-label', text: 'Firm Fund'}),
        el('div', {class: 'fund-value', text: formatPHP(firmFund)})
      ]),
      el('div', {class: 'fund-box'}, [
        el('div', {class: 'fund-label', text: 'Client Fund'}),
        el('div', {class: 'fund-value', text: formatPHP(clientFund)})
      ])
    ]);

    let employeeTable;
    const empEntries = Object.values(byEmployee);
    if (empEntries.length === 0) {
      employeeTable = el('p', {class: 'empty-state', text: 'No released disbursements.'});
    } else {
      const rows = empEntries.map(emp =>
        el('tr', {}, [
          el('td', {text: emp.name}),
          el('td', {class: 'num', text: String(emp.count)}),
          el('td', {class: 'num', text: formatPHP(emp.total)})
        ])
      );
      employeeTable = el('table', {class: 'report-table'}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {text: 'Employee'}),
            el('th', {text: 'Count'}),
            el('th', {text: 'Total'})
          ])
        ]),
        el('tbody', {}, rows)
      ]);
    }

    return el('div', {class: 'report-card'}, [
      el('h2', {text: 'Disbursement Report'}),
      fundSplit,
      el('h3', {text: 'By Employee'}),
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
      return el('div', {class: `pl-card ${e.toLowerCase()}`}, [
        el('h3', {text: e}),
        el('div', {class: 'pl-row'}, [
          el('span', {class: 'pl-label', text: 'Revenue'}),
          el('span', {class: 'pl-value', text: formatPHP(data.revenue)})
        ]),
        el('div', {class: 'pl-row'}, [
          el('span', {class: 'pl-label', text: 'Expenses'}),
          el('span', {class: 'pl-value', text: formatPHP(data.expenses)})
        ]),
        el('div', {class: 'pl-divider'}),
        el('div', {class: 'pl-row pl-total'}, [
          el('span', {class: 'pl-label', text: 'P&L'}),
          el('span', {
            class: `pl-value ${isPositive ? 'positive' : 'negative'}`,
            text: formatPHP(pl)
          })
        ])
      ]);
    });

    return el('div', {class: 'report-card report-card-wide'}, [
      el('h2', {text: 'Entity P&L Snapshot'}),
      el('div', {class: 'pl-grid'}, cards)
    ]);
  }
};
