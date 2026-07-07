/**
 * Authentication, Session & RBAC
 * Login, logout, session persistence, role-based access control, entity switching.
 *
 * Roles:
 *   Admin         – unrestricted, always ['ATA','LTA']
 *                   Creates WRs directly; approves Manager WRs; approves all phase routing.
 *                   Disbursement: can create, edit, delete disbursements (file expenses);
 *                   responsible for approving disbursement creation and release.
 *                   Transmittal: can create, edit, delete transmittals; approves
 *                   transmittal status changes (sent/received).
 *   Manager       – Creates WRs (requires Admin approval); approves tasks added by staff;
 *                   view-only for clients; cannot route phases.
 *                   Billing: can view all invoices for assigned WRs; request invoices
 *                   from Accounting; mark as paid (pending Admin approval).
 *                   Cannot create or edit invoices directly.
 *                   Disbursement: can view file expenses for assigned WRs only; cannot
 *                   file an expense; can request a disbursement for assigned WRs;
 *                   can mark a disbursement as released (pending Admin approval).
 *                   Transmittal: can view transmittals for assigned WRs; cannot create;
 *                   can mark as sent/received (pending Admin approval).
 *   Accounting    – per-entity staff, either ['ATA'] or ['LTA'] (never both)
 *                   Can add tasks (pending Manager approval); view WR details.
 *                   Disbursement: can create (file expenses) and edit disbursements;
 *                   requires Admin approval to release; can view disbursements.
 *                   Transmittal: view-only.
 *   Operations    – per-entity staff, either ['ATA'] or ['LTA'] (never both)
 *                   Can add tasks (pending Manager approval); upload documents for tasks; view WR details.
 *                   Disbursement: can only request a disbursement from Accounting.
 *                   Transmittal: can request a transmittal from Documentation.
 *   Documentation – cross-entity staff, always ['ATA','LTA']
 *                   Can add tasks (pending Manager approval); view WR details.
 *                   Disbursement: view-only.
 *                   Transmittal: can create and edit transmittals freely; can view;
 *                   can mark as sent/received (pending Admin approval).
 *   HR            – (placeholder) view-only, always ['ATA','LTA']
 *                   ⚠️ HR permissions are UNCONFIRMED — minimal/view-only pending
 *                   business confirmation of actual permission set.
 */

const Auth = {
  user: null,
  activeEntity: null,

  /** All non-Admin, non-Manager roles (i.e. staff-level roles). */
  STAFF_ROLES: ['Accounting', 'Operations', 'Documentation', 'HR'],

  /** Convenience: every valid role in the system. */
  ALL_ROLES: ['Admin', 'Manager', 'Accounting', 'Operations', 'Documentation', 'HR'],

  /**
   * Departments a user may be assigned to. Department assignment drives RBAC
   * dynamically on top of the user's base role permissions.
   */
  DEPARTMENTS: ['Accounting', 'Operations', 'Documentation', 'HR', 'Management', 'Legal', 'Tax', 'Audit', 'Business Development'],

  /**
   * Permission set granted by each department. A user assigned to multiple
   * departments receives the union of those permission sets plus their
   * base role permissions.
   */
  DEPARTMENT_PERMISSIONS: {
    'Accounting': ['clients:view','workflow:view','workflow:task_add','billing:view','billing:edit','disbursement:view','disbursement:create','disbursement:edit','dms:view','transmittal:view'],
    'Operations': ['clients:view','workflow:view','workflow:task_add','workflow:task_upload','billing:view','billing:request','disbursement:view','disbursement:request','dms:view','transmittal:view','transmittal:request'],
    'Documentation': ['clients:view','workflow:view','workflow:task_add','billing:view','disbursement:view','dms:view','dms:edit','dms:handover','transmittal:view','transmittal:create','transmittal:edit','transmittal:mark'],
    'HR': ['clients:view','workflow:view','billing:view','disbursement:view','dms:view'],
    'Management': ['clients:view','workflow:view','workflow:edit','workflow:task_approve','billing:view','billing:request','billing:mark_paid','disbursement:view','disbursement:request','disbursement:mark_released','dms:view','dms:edit','dms:handover','transmittal:view','transmittal:mark','bypass_review:tasks','approve_change:tasks'],
    'Legal': ['clients:view','workflow:view','billing:view','disbursement:view','dms:view','transmittal:view'],
    'Tax': ['clients:view','workflow:view','billing:view','billing:edit','disbursement:view','dms:view','transmittal:view'],
    'Audit': ['clients:view','workflow:view','billing:view','disbursement:view','dms:view','transmittal:view'],
    'Business Development': ['clients:view','workflow:view','billing:view','disbursement:view','transmittal:view']
  },

  updateSessionClasses(hasSession) {
    if (hasSession) {
      document.documentElement.classList.add('has-session');
      document.documentElement.classList.remove('no-session');
    } else {
      document.documentElement.classList.add('no-session');
      document.documentElement.classList.remove('has-session');
    }
  },

  // Session is stored in localStorage (not sessionStorage) so that forms opened via
  // "New tab" view mode are still authenticated when the new tab loads.
  _sessionKey: 'erp_session',

  login(email, password) {
    const users = DB.getAll('users');
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return false;
    if (user.isActive === false) return 'disabled';
    this.user = user;
    // Normalize entity values to uppercase for consistency
    this.user.entities = this.user.entities.map(e => e.toUpperCase());
    // Ensure the new multi-department field is always an array.
    if (!Array.isArray(this.user.departments)) this.user.departments = [];
    this.activeEntity = this.user.entities.includes('ATA') ? 'ATA' : 'LTA';
    localStorage.setItem(this._sessionKey, JSON.stringify({ userId: user.id, activeEntity: this.activeEntity }));
    this.updateSessionClasses(true);
    return true;
  },

  logout() {
    this.user = null;
    this.activeEntity = null;
    localStorage.removeItem(this._sessionKey);
    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('erp_filters_')) sessionStorage.removeItem(key);
      });
    } catch (e) {}
    this.updateSessionClasses(false);
  },

  restoreSession() {
    const s = JSON.parse(localStorage.getItem(this._sessionKey) || 'null');
    if (!s) {
      this.updateSessionClasses(false);
      return false;
    }
    this.user = DB.getById('users', s.userId);
    if (this.user && this.user.isActive !== false) {
      this.user.entities = this.user.entities.map(e => e.toUpperCase());
      if (!Array.isArray(this.user.departments)) this.user.departments = [];
      this.activeEntity = s.activeEntity;
      this.updateSessionClasses(true);
      return true;
    } else {
      this.user = null;
      this.updateSessionClasses(false);
      return false;
    }
  },

  can(action, entity) {
    if (!this.user) return false;
    entity = (entity || this.activeEntity || '').toUpperCase();
    const role = this.user.role;
    if (role === 'Admin') return true;
    if (!this.user.entities.includes(entity)) return false;
    const rolePerms = {
      Manager: ['clients:view','workflow:view','workflow:edit','workflow:task_approve','billing:view','billing:request','billing:mark_paid','disbursement:view','disbursement:request','disbursement:mark_released','dms:view','dms:edit','dms:handover','transmittal:view','transmittal:mark','bypass_review:tasks','approve_change:tasks'],
      Accounting: ['clients:view','workflow:view','workflow:task_add','billing:view','billing:edit','disbursement:view','disbursement:create','disbursement:edit','dms:view','transmittal:view'],
      Operations: ['clients:view','workflow:view','workflow:task_add','workflow:task_upload','billing:view','billing:request','disbursement:view','disbursement:request','dms:view','transmittal:view','transmittal:request'],
      Documentation: ['clients:view','workflow:view','workflow:task_add','billing:view','disbursement:view','dms:view','dms:edit','dms:handover','transmittal:view','transmittal:create','transmittal:edit','transmittal:mark'],
      // ⚠️ HR: UNCONFIRMED placeholder — minimal view-only across all modules
      // pending business owner confirmation of actual HR permission requirements.
      HR: ['clients:view','workflow:view','billing:view','disbursement:view','dms:view']
    };

    // Start with the base role permissions, then merge any permissions granted
    // by the departments the user is assigned to. This makes RBAC dynamic:
    // assigning a user to multiple departments expands their effective scope
    // without changing their base role.
    const granted = new Set(rolePerms[role] || []);
    const departments = Array.isArray(this.user.departments) ? this.user.departments : [];
    departments.forEach(dept => {
      (this.DEPARTMENT_PERMISSIONS[dept] || []).forEach(p => granted.add(p));
    });

    // Note: audit:view_all is shared by Admin and Manager (Admin always returns true).
    return granted.has(action);
  },

  canBypassReview(table) {
    return this.can('bypass_review:' + table);
  },

  canApproveChange(table) {
    return this.can('approve_change:' + table);
  },

  isManagerial() {
    const role = this.user?.role;
    return role === 'Admin' || role === 'Manager';
  },

  /** Returns true if the current user has a staff-level role. */
  isStaff() {
    return this.STAFF_ROLES.includes(this.user?.role);
  },

  isSelfApprover(recordUserId) {
    return this.user?.id === recordUserId;
  },

  canViewWr(wr) {
    if (!this.user) return false;
    if (this.user.role === 'Admin') return true;
    if (this.user.role === 'Manager') {
      return wr && (wr.assignedTo === this.user.id || wr.submittedBy === this.user.id || wr.requestedBy === this.user.id);
    }
    // Staff roles (non-managerial)
    if (!wr) return false;
    if (wr.submittedBy === this.user.id || wr.assignedTo === this.user.id || wr.requestedBy === this.user.id) return true;
    
    // Check tasks
    const tasks = wr.tasks || (wr.isPendingApproval ? [] : DB.getWhere('tasks', t => t.workRequestId === wr.id));
    const isAssigned = tasks.some(t => {
      if (t.assigneeId === this.user.id || t.assignedTo === this.user.id) return true;
      if (t.assigneeName && t.assigneeName === this.user.name) return true;
      if ((t.coAssignees || []).includes(this.user.name)) return true;
      return (t.checklist || []).some(item => item.assigneeName && item.assigneeName === this.user.name);
    });
    return isAssigned;
  },

  /**
   * canViewWr variant that accepts a pre-built task map to avoid N+1 DB lookups.
   * taskMap: { [workRequestId]: Task[] }
   */
  canViewWrWithTasks(wr, taskMap) {
    if (!this.user) return false;
    if (this.user.role === 'Admin') return true;
    if (this.user.role === 'Manager') {
      return wr && (wr.assignedTo === this.user.id || wr.submittedBy === this.user.id || wr.requestedBy === this.user.id);
    }
    if (!wr) return false;
    if (wr.submittedBy === this.user.id || wr.assignedTo === this.user.id || wr.requestedBy === this.user.id) return true;
    const tasks = wr.isPendingApproval ? (wr.tasks || []) : (taskMap[wr.id] || []);
    return tasks.some(t => {
      if (t.assigneeId === this.user.id || t.assignedTo === this.user.id) return true;
      if (t.assigneeName && t.assigneeName === this.user.name) return true;
      if ((t.coAssignees || []).includes(this.user.name)) return true;
      return (t.checklist || []).some(item => item.assigneeName && item.assigneeName === this.user.name);
    });
  },


  canViewDisbursement(d) {
    if (!this.user) return false;
    if (this.user.role === 'Admin' || this.user.role === 'Accounting') return true;
    if (this.user.role === 'Manager') {
      if (!d.linkedWorkRequestId) return false;
      const wr = DB.getById('workRequests', d.linkedWorkRequestId);
      return wr && this.canViewWr(wr);
    }
    // Operations, Documentation, and HR:
    // Staff can see WR-linked disbursements if they can view the WR,
    // or non-linked disbursements they personally requested.
    // This is intentionally more restrictive than the previous blanket 'return true'
    // to match the documented role matrix (see file header).
    if (d.linkedWorkRequestId) {
      const wr = DB.getById('workRequests', d.linkedWorkRequestId);
      return wr && this.canViewWr(wr);
    }
    return d.requestedBy === this.user.id;
  },

  switchEntity(entity) {
    const upper = entity.toUpperCase();
    if (upper === 'ALL' || this.user?.entities.includes(upper)) {
      this.activeEntity = upper;
      localStorage.setItem(this._sessionKey, JSON.stringify({ userId: this.user.id, activeEntity: upper }));
    }
  },
};
