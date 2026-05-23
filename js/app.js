/**
 * App Stub — Task 3
 * Minimal bootstrapping: login wiring, entity switcher, session restore.
 * Full router and module loaders will replace this in Task 4.
 */

const App = {
  init() {
    this.renderHeader();
    this.setupEntitySwitcher();
    this.setupLogout();
    this.refreshView();
  },

  renderHeader() {
    const userNameEl = document.getElementById('user-name');
    if (userNameEl && Auth.user) {
      userNameEl.textContent = Auth.user.name;
    }
    this.updateEntityBadge();
  },

  setupEntitySwitcher() {
    const switcher = document.getElementById('entity-switcher');
    if (!switcher) return;

    // Clear existing options
    switcher.innerHTML = '';

    if (Auth.user) {
      Auth.user.entities.forEach(entity => {
        const option = document.createElement('option');
        option.value = entity;
        option.textContent = entity === 'ATA' ? 'ATA Accounting' : 'LTA Accounting';
        switcher.appendChild(option);
      });
      switcher.value = Auth.activeEntity;
    }

    switcher.addEventListener('change', (e) => {
      Auth.switchEntity(e.target.value);
      this.updateEntityBadge();
      this.refreshView();
    });
  },

  updateEntityBadge() {
    const badge = document.getElementById('entity-badge');
    if (!badge) return;
    badge.textContent = Auth.activeEntity || '';
    badge.className = 'badge';
    if (Auth.activeEntity === 'ATA') {
      badge.classList.add('badge-ata');
    } else if (Auth.activeEntity === 'LTA') {
      badge.classList.add('badge-lta');
    }
  },

  setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Auth.logout();
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        const form = document.getElementById('login-form');
        if (form) form.reset();
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.classList.add('hidden');
      });
    }
  },

  refreshView() {
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = '';
      const p = document.createElement('p');
      p.style.color = 'var(--color-text-muted)';
      p.textContent = 'Welcome, ' + (Auth.user?.name || 'User') + '. Active entity: ' + (Auth.activeEntity || '—');
      content.appendChild(p);
    }
  }
};

// Wire login form
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('login-error');

      if (Auth.login(email, password)) {
        if (errorEl) errorEl.classList.add('hidden');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        App.init();
      } else {
        if (errorEl) {
          errorEl.textContent = 'Invalid email or password.';
          errorEl.classList.remove('hidden');
        }
      }
    });
  }

  // Try restore session
  if (Auth.restoreSession()) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    App.init();
  }
});
