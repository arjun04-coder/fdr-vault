/* ============================================================
   FDR Vault — prototype application logic
   Plain JavaScript, no build step. Data is fictional.
   ============================================================ */
(function () {
  'use strict';

  var D = window.FDRVaultData;
  var STORAGE_KEY = 'fdrvault.prototype.v1';
  var DEMO_TODAY = D.todayISO();

  /* ------------------------------------------------------------
     Roles & workflow configuration
     ------------------------------------------------------------ */
  var ROLES = {
    college: {
      role: 'college', label: 'Institution Admin',
      name: 'Dr. Meera Kulkarni', designation: 'Registrar',
      org: 'Sunrise Institute of Technology, Pune', instId: 'INST-001',
      blurb: 'Submit and track FDRs, respond to queries, request release/refund.'
    },
    ro: {
      role: 'ro', label: 'Regional Officer',
      name: 'R. K. Sharma', designation: 'Regional Officer',
      org: 'AICTE Western Region', region: 'Western',
      blurb: 'Verify instruments, monitor maturities, process release requests & issue NOC.'
    },
    bureau: {
      role: 'bureau', label: 'Approval Bureau',
      name: 'S. Nair', designation: 'Deputy Director',
      org: 'AICTE Approval Bureau',
      blurb: 'Grant approval-bureau clearance for release/refund cases.'
    },
    grievance: {
      role: 'grievance', label: 'Grievance Cell',
      name: 'P. Menon', designation: 'Grievance Officer',
      org: 'AICTE Grievance Cell',
      blurb: 'Confirm no pending grievance before a deposit is released.'
    },
    vigilance: {
      role: 'vigilance', label: 'Vigilance Cell',
      name: 'D. Chaturvedi', designation: 'Vigilance Officer',
      org: 'AICTE Vigilance Cell',
      blurb: 'Confirm no pending vigilance case before release.'
    },
    admin: {
      role: 'admin', label: 'System Administrator',
      name: 'A. Verma', designation: 'Director',
      org: 'AICTE Regulation Bureau',
      blurb: 'Full access for demo: repository, workflow, reports, audit and users.'
    }
  };

  var STAGES = [
    'Institution Request',
    'Regional Office Review',
    'Approval Bureau',
    'Grievance Cell',
    'Vigilance Cell',
    'NOC Issuance',
    'Fund Release'
  ];
  var STAGE_OWNER = ['college', 'ro', 'bureau', 'grievance', 'vigilance', 'ro', 'ro'];
  var STAGE_KEY = [null, 'ro', 'approval', 'grievance', 'vigilance', null, null];

  var VIEW_TITLES = {
    dashboard: 'Dashboard', instruments: 'FDR / Deposit Records', submit: 'Submit FDR',
    releases: 'Release / Refund', alerts: 'Alerts', reports: 'Reports',
    audit: 'Audit Trail', users: 'User Management'
  };

  /* ------------------------------------------------------------
     State
     ------------------------------------------------------------ */
  var state = {
    session: null,
    view: 'dashboard',
    institutions: [],
    instruments: [],
    audit: [],
    filters: { q: '', status: 'all', ver: 'all' },
    auditQ: '',
    uploads: [],
    modal: null,
    preselectRelease: null,
    _alerts: []
  };

  /* ------------------------------------------------------------
     Utilities
     ------------------------------------------------------------ */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n) {
    n = Number(n) || 0;
    if (n >= 10000000) return '\u20B9' + (n / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
    if (n >= 100000) return '\u20B9' + (n / 100000).toFixed(2).replace(/\.00$/, '') + ' L';
    return '\u20B9' + n.toLocaleString('en-IN');
  }
  function moneyFull(n) { return '\u20B9' + (Number(n) || 0).toLocaleString('en-IN'); }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(v) {
    if (!v || v === '-') return '\u2014';
    var s = String(v).slice(0, 10).split('-');
    if (s.length !== 3) return String(v);
    return Number(s[2]) + ' ' + MONTHS[Number(s[1]) - 1] + ' ' + s[0];
  }
  function fmtDateTime(v) {
    if (!v) return '\u2014';
    var d = new Date(v);
    if (isNaN(d.getTime())) return fmtDate(v);
    var t = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return fmtDate(v) + ', ' + t;
  }
  function nowISO() { return new Date().toISOString(); }
  function daysBetween(from, to) { return D.diffDays(String(from).slice(0, 10), String(to).slice(0, 10)); }
  function ageOf(v) { return daysBetween(v, DEMO_TODAY); }
  function daysToMat(inst) { return D.diffDays(DEMO_TODAY, inst.maturityDate); }

  function instById(id) {
    for (var i = 0; i < state.instruments.length; i++) if (state.instruments[i].id === id) return state.instruments[i];
    return null;
  }
  function institutionOf(inst) {
    if (!inst) return {};
    for (var i = 0; i < state.institutions.length; i++) if (state.institutions[i].id === inst.instId) return state.institutions[i];
    return {};
  }
  function sessionInstitution() { return institutionOf({ instId: state.session ? state.session.instId : '' }); }

  function chip(text, cls) { return '<span class="chip ' + cls + '">' + esc(text) + '</span>'; }

  function statusClass(status) {
    switch (status) {
      case 'Active': return 'ok';
      case 'Expiring': return 'warn';
      case 'Matured': return 'danger';
      case 'Pending Verification': return 'info';
      case 'Release in Progress': return 'violet';
      case 'Release Rejected': return 'danger';
      case 'Released': return 'muted';
      case 'Renewed': return 'teal';
      case 'Exempt': return 'violet';
      default: return 'muted';
    }
  }
  function verificationClass(v) {
    if (v === 'Bank-confirmed') return 'ok';
    if (v === 'Discrepancy') return 'danger';
    if (v === 'Exempt') return 'violet';
    return 'warn';
  }
  function roleLabel(key) {
    for (var k in ROLES) if (ROLES[k].role === key) return ROLES[k].label;
    return key;
  }

  /* ------------------------------------------------------------
     Persistence (resets automatically on a new day)
     ------------------------------------------------------------ */
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        savedOn: DEMO_TODAY,
        institutions: state.institutions,
        instruments: state.instruments,
        audit: state.audit
      }));
    } catch (e) { /* storage may be unavailable on file:// in some browsers */ }
  }
  function loadSaved() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.savedOn !== DEMO_TODAY || !data.instruments) return null;
      return data;
    } catch (e) { return null; }
  }
  function initData(force) {
    var saved = force ? null : loadSaved();
    if (saved) {
      state.institutions = saved.institutions;
      state.instruments = saved.instruments;
      state.audit = saved.audit;
    } else {
      var seed = D.buildSeed();
      state.institutions = seed.institutions;
      state.instruments = seed.instruments;
      state.audit = seed.audit;
      save();
    }
  }

  /* ------------------------------------------------------------
     Derived rules
     ------------------------------------------------------------ */
  function effStatus(inst) {
    if (inst.status === 'Exempt') return 'Exempt';
    if (inst.status === 'Released') return 'Released';
    if (inst.release && inst.release.releasedAt) return 'Released';
    if (inst.release && inst.release.rejected) return 'Release Rejected';
    if (inst.release) return 'Release in Progress';
    if (inst.status === 'Renewed') return 'Renewed';
    if (inst.status === 'Rejected') return 'Rejected';
    var d = daysToMat(inst);
    if (d < 0) return 'Matured';
    if (d <= 30) return 'Expiring';
    if (inst.status === 'Pending Verification') return 'Pending Verification';
    return 'Active';
  }

  function pendingVerification(inst) {
    if (['Released', 'Exempt', 'Renewed'].indexOf(inst.status) >= 0) return false;
    return inst.verification === 'Self-declared' || inst.verification === 'Discrepancy';
  }

  function isInRelease(inst) {
    return !!(inst.release && !inst.release.releasedAt && !inst.release.rejected);
  }

  function stageIdx(inst) {
    var r = inst.release;
    if (!r) return -1;
    if (r.releasedAt) return 7;
    if (r.rejected) return -3;
    if (r.nocAt) return 6;
    if (r.vigilance) return 5;
    if (r.grievance) return 4;
    if (r.approval) return 3;
    if (r.ro) return 2;
    return 1;
  }

  function relStageLabel(inst) {
    if (!inst.release) return '\u2014';
    if (inst.release.rejected) return 'Returned';
    if (inst.release.releasedAt) return 'Released';
    return STAGES[stageIdx(inst)];
  }

  function relAction(inst) {
    if (!state.session) return null;
    if (!inst.release || inst.release.rejected || inst.release.releasedAt) return null;
    var idx = stageIdx(inst);
    if (idx < 0 || idx >= STAGE_OWNER.length || !STAGE_OWNER[idx]) return null;
    var owner = STAGE_OWNER[idx];
    if (state.session.role === owner || state.session.role === 'admin') return { idx: idx, owner: owner };
    return null;
  }

  function actionKind(idx) {
    if (idx === 5) return 'noc';
    if (idx === 6) return 'release';
    return 'clear';
  }

  function canVerify(inst) {
    if (!state.session) return false;
    if (['ro', 'bureau', 'admin'].indexOf(state.session.role) < 0) return false;
    return ['Released', 'Exempt', 'Renewed'].indexOf(inst.status) < 0 && !!inst.ifsc && inst.ifsc !== '-';
  }

  function verifyLabel(inst) {
    return inst.verification === 'Bank-confirmed' ? 'Re-verify' : 'Verify';
  }

  function missingReleaseDocs(rel) {
    if (!rel) return [];
    var have = rel.docs.map(function (d) { return d.type; });
    return ['Request Letter', 'Affidavit', 'FDR Copy'].filter(function (t) { return have.indexOf(t) < 0; });
  }

  function evaluate(inst, all) {
    var flags = [];
    function add(sev, code, msg) { flags.push({ sev: sev, code: code, msg: msg }); }

    if (inst.status === 'Exempt') return { flags: [], health: null };
    if (inst.status === 'Released' || (inst.release && inst.release.releasedAt)) return { flags: [], health: 100 };

    var d = daysToMat(inst);
    var rel = inst.release;
    var institution = institutionOf(inst);

    if (!inst.fdrNumber || inst.fdrNumber === '-') add('critical', 'NO_FDR', 'FDR / deposit number is not recorded.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(inst.ifsc || '')) add('major', 'IFSC', 'IFSC code is missing or not in the valid 11-character format.');
    if (!(Number(inst.amount) > 0)) add('critical', 'AMOUNT', 'Deposit amount is missing.');
    if (daysBetween(inst.issueDate, inst.maturityDate) <= 0) add('critical', 'DATES', 'Maturity date must be after the issue date.');

    var jointOk = (inst.jointNames || []).some(function (n) { return /aicte/i.test(n); });
    if (!jointOk) add('major', 'JOINT', 'Joint holder list does not include the AICTE officer, as required for a joint FDR.');

    var types = (inst.docs || []).map(function (x) { return x.type; });
    if (types.indexOf('FDR Copy') < 0) add('critical', 'DOC_FDR', 'FDR copy is not on record.');
    if (types.indexOf('Bank Confirmation') < 0) add('minor', 'DOC_BANK', 'Bank confirmation letter is not on record.');

    if (inst.verification === 'Self-declared') add('major', 'UNVERIFIED', 'Instrument is self-declared and has not been confirmed by the bank.');
    if (inst.verification === 'Discrepancy') add('critical', 'DISCREPANCY', 'Bank verification raised a discrepancy that is pending resolution.');

    if (inst.bankConfirmed) {
      if (Number(inst.bankConfirmed.amount) !== Number(inst.amount)) {
        add('critical', 'AMT_MISMATCH', 'Declared amount (' + money(inst.amount) + ') does not match the bank-confirmed amount (' + money(inst.bankConfirmed.amount) + ').');
      }
      if (inst.bankConfirmed.maturityDate && inst.bankConfirmed.maturityDate !== inst.maturityDate) {
        add('major', 'DATE_MISMATCH', 'Declared maturity date differs from the bank-confirmed maturity date.');
      }
      if (ageOf(inst.bankConfirmed.checkedAt) > 180) add('minor', 'STALE_CONFIRM', 'Bank confirmation is older than 180 days.');
    }

    var duplicate = all.some(function (o) {
      return o.id !== inst.id && o.status !== 'Released' && o.fdrNumber && o.fdrNumber === inst.fdrNumber && o.bank === inst.bank;
    });
    if (duplicate) add('critical', 'DUPLICATE', 'Another active record uses the same FDR number and bank.');

    if (institution.minDeposit > 0 && Number(inst.amount) < Number(institution.minDeposit)) {
      add('major', 'BELOW_MIN', 'Amount is below the indicative deposit requirement for this institution (' + money(institution.minDeposit) + ').');
    }

    if (d < 0 && inst.status !== 'Renewed') {
      add('critical', 'MATURED', 'Matured ' + Math.abs(d) + ' day(s) ago; renewal or refund action is required.');
    } else if (d >= 0 && d <= 7) {
      add('major', 'EXP7', 'Matures in ' + d + ' day(s).');
    } else if (d <= 15) {
      add('minor', 'EXP15', 'Matures in ' + d + ' day(s).');
    }

    if (rel) {
      var missing = missingReleaseDocs(rel);
      if (missing.indexOf('Request Letter') >= 0) add('critical', 'REL_LETTER', 'Release request letter is missing.');
      if (missing.indexOf('Affidavit') >= 0) add('critical', 'REL_AFFIDAVIT', 'Affidavit is missing from the release file.');
      if (missing.indexOf('FDR Copy') >= 0) add('critical', 'REL_FDR', 'FDR copy is missing from the release file.');
      if (rel.rejected) add('critical', 'REL_REJECTED', 'Release request was returned: ' + rel.rejected.reason);
    }

    var health = 100;
    flags.forEach(function (f) { health -= f.sev === 'critical' ? 25 : f.sev === 'major' ? 12 : 5; });

    flags.sort(function (a, b) {
      var rank = { critical: 0, major: 1, minor: 2 };
      return rank[a.sev] - rank[b.sev];
    });
    return { flags: flags, health: Math.max(0, health) };
  }

  function healthColor(score) {
    if (score == null) return '#94a3b8';
    if (score >= 85) return '#0E7A5F';
    if (score >= 65) return '#D97706';
    return '#B42318';
  }

  function scopeInstruments() {
    if (!state.session) return [];
    if (state.session.role === 'college') {
      return state.instruments.filter(function (i) { return i.instId === state.session.instId; });
    }
    return state.instruments.slice();
  }

  /* ------------------------------------------------------------
     Audit
     ------------------------------------------------------------ */
  function logAction(action, inst, detail) {
    if (!state.session) return;
    var idNum = state.audit.length + 1;
    state.audit.unshift({
      id: 'AUD-' + String(idNum).padStart(4, '0'),
      at: nowISO(),
      actor: state.session.name,
      role: state.session.role,
      action: action,
      targetId: inst ? inst.id : '',
      targetLabel: inst ? inst.fdrNumber : '',
      detail: detail || ''
    });
    save();
  }

  /* ------------------------------------------------------------
     Toasts
     ------------------------------------------------------------ */
  var toastTimer = null;
  function toast(msg, kind) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast hidden'; }, 4200);
  }

  /* ------------------------------------------------------------
     Role-aware rendering
     ------------------------------------------------------------ */
  function applyRoleVisibility() {
    $$('[data-role-visible]').forEach(function (el) {
      var allowed = el.getAttribute('data-role-visible').split(',');
      el.hidden = allowed.indexOf(state.session.role) < 0;
    });
  }

  function showView(view) {
    if (!state.session) return;
    var section = document.querySelector('.view[data-view="' + view + '"]');
    if (!section) view = 'dashboard';
    if (section && section.hidden) view = 'dashboard';
    state.view = view;
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAll() {
    if (!state.session) return;

    $('#session-role').textContent = state.session.label;
    $('#session-user').textContent = state.session.name + ' \u00B7 ' + state.session.org;
    $('#view-title').textContent = VIEW_TITLES[state.view] || 'Dashboard';
    $('#today-chip').textContent = fmtDate(DEMO_TODAY);

    applyRoleVisibility();

    $$('.nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === state.view);
    });
    $$('.view').forEach(function (sec) {
      sec.classList.toggle('active', sec.getAttribute('data-view') === state.view && !sec.hidden);
    });

    state._alerts = buildAlerts(scopeInstruments());
    renderDashboard();
    renderInstruments();
    renderReleases();
    renderAlerts();
    renderReports();
    renderAudit();
    renderUsers();
    renderModal();

    var criticalCount = state._alerts.filter(function (a) { return a.sev === 'critical'; }).length;
    var countEl = $('#alert-count');
    if (countEl) countEl.textContent = String(state._alerts.length);
    var chipEl = $('#alert-chip');
    if (chipEl) chipEl.classList.toggle('has-critical', criticalCount > 0);
  }

  /* ------------------------------------------------------------
     Dashboard
     ------------------------------------------------------------ */
  function renderDashboard() {
    var list = scopeInstruments();
    var active = list.filter(function (i) { return ['Active', 'Expiring'].indexOf(effStatus(i)) >= 0; });
    var exp30 = list.filter(function (i) {
      var d = daysToMat(i);
      return d >= 0 && d <= 30 && ['Released', 'Exempt', 'Renewed'].indexOf(effStatus(i)) < 0;
    });
    var overdue = list.filter(function (i) {
      return daysToMat(i) < 0 && ['Released', 'Exempt', 'Renewed'].indexOf(effStatus(i)) < 0;
    });
    var rels = list.filter(function (i) { return isInRelease(i); });
    var released = list.filter(function (i) { return effStatus(i) === 'Released'; });

    $('#kpi-active').textContent = active.length;
    $('#kpi-exp30').textContent = exp30.length;
    $('#kpi-overdue').textContent = overdue.length;
    $('#kpi-releases').textContent = rels.length;
    $('#kpi-released').textContent = released.length;

    var cover = list.filter(function (i) { return ['Released', 'Exempt'].indexOf(effStatus(i)) < 0; })
      .reduce(function (s, i) { return s + Number(i.amount || 0); }, 0);
    var verified = list.filter(function (i) { return i.verification === 'Bank-confirmed'; }).length;
    var verifiable = list.filter(function (i) { return i.verification !== 'Exempt'; }).length;
    var healths = list.filter(function (i) { return ['Released', 'Exempt'].indexOf(effStatus(i)) < 0; })
      .map(function (i) { return evaluate(i, state.instruments).health; })
      .filter(function (h) { return h != null; });
    var avgHealth = healths.length ? Math.round(healths.reduce(function (a, b) { return a + b; }, 0) / healths.length) : 0;
    var instCount = {};
    list.forEach(function (i) { instCount[i.instId] = 1; });

    var strip = $('#portfolio-strip');
    if (strip) {
      strip.innerHTML =
        '<div class="strip-item"><span>Deposit cover</span><strong>' + money(cover) + '</strong></div>' +
        '<div class="strip-item"><span>Institutions</span><strong>' + Object.keys(instCount).length + '</strong></div>' +
        '<div class="strip-item"><span>Bank-confirmed</span><strong>' + (verifiable ? Math.round(verified / verifiable * 100) : 0) + '%</strong></div>' +
        '<div class="strip-item"><span>Avg. record health</span><strong style="color:' + healthColor(avgHealth) + '">' + avgHealth + '/100</strong></div>';
    }

    var isCollege = state.session.role === 'college';
    $('#dash-title').textContent = isCollege ? 'Your security deposit portfolio' : 'Security deposit portfolio';
    $('#dash-sub').textContent = isCollege
      ? state.session.org + ' \u00B7 FDRs, alerts and release requests in one place'
      : 'Live view of security deposits and FDRs across AICTE-approved institutions';

    /* Upcoming maturities */
    var upcoming = list.filter(function (i) {
      return ['Released', 'Exempt', 'Renewed'].indexOf(effStatus(i)) < 0 && daysToMat(i) <= 45;
    }).sort(function (a, b) { return daysToMat(a) - daysToMat(b); }).slice(0, 6);

    var upBody = $('#dash-upcoming');
    if (upBody) {
      upBody.innerHTML = upcoming.length ? upcoming.map(function (i) {
        var d = daysToMat(i);
        var dc = d < 0 ? 'danger' : d <= 7 ? 'danger' : d <= 15 ? 'warn' : 'info';
        return '<tr class="row-click" data-open="' + i.id + '">' +
          '<td><strong>' + esc(i.fdrNumber) + '</strong><div class="cell-sub">' + money(i.amount) + '</div></td>' +
          '<td>' + esc(institutionOf(i).name || '') + '</td>' +
          '<td>' + fmtDate(i.maturityDate) + '</td>' +
          '<td><span class="days ' + dc + '">' + (d < 0 ? Math.abs(d) + 'd overdue' : d + 'd left') + '</span></td>' +
          '<td>' + chip(effStatus(i), statusClass(effStatus(i))) + '</td></tr>';
      }).join('') : emptyRow(5, 'No instruments maturing in the next 45 days.');
    }

    /* Pending verifications */
    var pending = list.filter(function (i) { return pendingVerification(i); })
      .sort(function (a, b) { return ageOf(b.submittedAt) - ageOf(a.submittedAt); }).slice(0, 6);
    var pendBody = $('#dash-pending');
    if (pendBody) {
      pendBody.innerHTML = pending.length ? pending.map(function (i) {
        var docs = (i.docs || []).length;
        return '<tr class="row-click" data-open="' + i.id + '">' +
          '<td><strong>' + esc(i.fdrNumber) + '</strong><div class="cell-sub">' + esc(i.bank) + '</div></td>' +
          '<td>' + esc(institutionOf(i).name || '') + '</td>' +
          '<td>' + ageOf(i.submittedAt) + ' day(s) ago</td>' +
          '<td>' + docs + ' file(s)</td>' +
          '<td>' + (canVerify(i) ? '<button class="btn tiny" data-verify="' + i.id + '">Verify</button>' : '<span class="muted">Awaiting bank</span>') + '</td></tr>';
      }).join('') : emptyRow(5, 'No pending verifications.');
    }

    /* Releases snapshot */
    var relBody = $('#dash-releases');
    if (relBody) {
      var openRels = list.filter(function (i) { return isInRelease(i); });
      relBody.innerHTML = openRels.length ? openRels.slice(0, 5).map(function (i) {
        return '<tr class="row-click" data-open="' + i.id + '">' +
          '<td><strong>' + esc(i.fdrNumber) + '</strong><div class="cell-sub">' + money(i.amount) + '</div></td>' +
          '<td>' + esc(institutionOf(i).name || '') + '</td>' +
          '<td>' + fmtDate(i.release.requestedAt) + '</td>' +
          '<td>' + chip(relStageLabel(i), 'violet') + '</td></tr>';
      }).join('') : emptyRow(4, 'No release requests in process.');
    }

    /* Discrepancy watchlist */
    var watch = [];
    list.forEach(function (i) {
      var ev = evaluate(i, state.instruments);
      ev.flags.forEach(function (f) {
        if (f.sev !== 'minor') watch.push({ inst: i, flag: f });
      });
    });
    watch.sort(function (a, b) {
      var rank = { critical: 0, major: 1, minor: 2 };
      return rank[a.flag.sev] - rank[b.flag.sev];
    });
    var watchEl = $('#dash-watchlist');
    if (watchEl) {
      watchEl.innerHTML = watch.length ? watch.slice(0, 6).map(function (w) {
        return '<button class="watch-item" data-open="' + w.inst.id + '">' +
          '<span class="sev-dot ' + w.flag.sev + '"></span>' +
          '<span class="watch-text"><strong>' + esc(w.flag.msg) + '</strong>' +
          '<span>' + esc(w.inst.fdrNumber) + ' \u00B7 ' + esc(institutionOf(w.inst).name || '') + '</span></span>' +
          '<span class="chev">\u203A</span></button>';
      }).join('') : '<div class="empty-state small">No open discrepancies. All records are clean.</div>';
    }
  }

  function emptyRow(cols, msg) {
    return '<tr><td colspan="' + cols + '"><div class="empty-state small">' + esc(msg) + '</div></td></tr>';
  }

  /* ------------------------------------------------------------
     Instruments table
     ------------------------------------------------------------ */
  function filteredInstruments() {
    var list = scopeInstruments();
    var q = state.filters.q.trim().toLowerCase();
    if (q) {
      list = list.filter(function (i) {
        var inst = institutionOf(i);
        return [i.id, i.fdrNumber, i.bank, i.branch, i.ifsc, inst.name, inst.aicteId, inst.state, (i.jointNames || []).join(' ')]
          .join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (state.filters.status !== 'all') {
      list = list.filter(function (i) { return effStatus(i) === state.filters.status; });
    }
    if (state.filters.ver !== 'all') {
      list = list.filter(function (i) { return i.verification === state.filters.ver; });
    }
    var order = { Matured: 0, Expiring: 1, 'Release Rejected': 2, 'Pending Verification': 2, 'Release in Progress': 3, Active: 4, Renewed: 5, Released: 6, Exempt: 7 };
    return list.sort(function (a, b) {
      var oa = order[effStatus(a)] == null ? 9 : order[effStatus(a)];
      var ob = order[effStatus(b)] == null ? 9 : order[effStatus(b)];
      if (oa !== ob) return oa - ob;
      return daysToMat(a) - daysToMat(b);
    });
  }

  function renderInstruments() {
    var body = $('#inst-table');
    if (!body) return;
    var list = filteredInstruments();

    body.innerHTML = list.length ? list.map(function (i) {
      var inst = institutionOf(i);
      var st = effStatus(i);
      var ev = evaluate(i, state.instruments);
      var d = daysToMat(i);
      var flags = ev.flags;
      var critical = flags.filter(function (f) { return f.sev === 'critical'; }).length;
      var flagChip = flags.length
        ? chip(flags.length + ' flag' + (flags.length === 1 ? '' : 's'), critical ? 'danger' : 'warn')
        : chip('Clean', 'ok');

      return '<tr>' +
        '<td><button class="link-btn" data-open="' + i.id + '">' + esc(i.id) + '</button><div class="cell-sub">' + (i.renewalOf ? 'Renewal of ' + esc(i.renewalOf) : '&nbsp;') + '</div></td>' +
        '<td><strong>' + esc(inst.name || '') + '</strong><div class="cell-sub">' + esc(inst.aicteId || '') + ' \u00B7 ' + esc(inst.region || '') + '</div></td>' +
        '<td>' + esc(i.fdrNumber) + '</td>' +
        '<td>' + esc(i.bank) + '<div class="cell-sub">' + esc(i.branch) + '</div></td>' +
        '<td><strong>' + moneyFull(i.amount) + '</strong></td>' +
        '<td>' + fmtDate(i.issueDate) + '<div class="cell-sub">' + fmtDate(i.maturityDate) + ' ' +
        (st === 'Released' || st === 'Exempt' || st === 'Renewed' ? '' : '<span class="days ' + (d < 0 ? 'danger' : d <= 7 ? 'danger' : d <= 30 ? 'warn' : 'info') + '">' + (d < 0 ? Math.abs(d) + 'd overdue' : d + 'd') + '</span>') + '</div></td>' +
        '<td><span class="joint-names" title="' + esc((i.jointNames || []).join(' | ')) + '">' + esc((i.jointNames || []).join(', ') || '\u2014') + '</span></td>' +
        '<td>' + chip(i.verification, verificationClass(i.verification)) + '</td>' +
        '<td>' + chip(st, statusClass(st)) + '</td>' +
        '<td>' + flagChip + '</td>' +
        '<td><div class="row-actions"><button class="btn tiny ghost" data-open="' + i.id + '">Open</button>' +
        (canVerify(i) ? '<button class="btn tiny" data-verify="' + i.id + '">' + verifyLabel(i) + '</button>' : '') + '</div></td>' +
        '</tr>';
    }).join('') : emptyRow(11, 'No records match the current filters.');

    if ($('#inst-filter-status')) $('#inst-filter-status').value = state.filters.status;
    if ($('#inst-filter-ver')) $('#inst-filter-ver').value = state.filters.ver;
  }

  /* ------------------------------------------------------------
     Releases
     ------------------------------------------------------------ */
  function clearanceCell(c) {
    if (!c) return '<span class="cell-sub">Pending</span>';
    return '<span class="cleared">\u2713 ' + fmtDate(c.at) + '</span><div class="cell-sub">' + esc(c.by) + '</div>';
  }

  function renderReleases() {
    var body = $('#rel-table');
    if (!body) return;
    var list = scopeInstruments().filter(function (i) { return !!i.release; })
      .sort(function (a, b) {
        var sa = a.release.releasedAt ? 2 : 1, sb = b.release.releasedAt ? 2 : 1;
        if (sa !== sb) return sa - sb;
        return new Date(b.release.requestedAt) - new Date(a.release.requestedAt);
      });

    body.innerHTML = list.length ? list.map(function (i) {
      var r = i.release;
      var act = relAction(i);
      var stage = relStageLabel(i);
      var stageCls = r.releasedAt ? 'muted' : r.rejected ? 'danger' : stage === 'NOC Issuance' || stage === 'Fund Release' ? 'ok' : 'violet';
      var noc = r.releasedAt
        ? '<span class="cleared">\u2713 ' + fmtDate(r.releasedAt) + '</span><div class="cell-sub">Released</div>'
        : r.nocAt
          ? '<span class="cleared">\u2713 ' + fmtDate(r.nocAt) + '</span><div class="cell-sub">' + esc(r.nocRef) + '</div>'
          : '<span class="cell-sub">Pending</span>';

      return '<tr>' +
        '<td><button class="link-btn" data-open="' + i.id + '">' + esc(i.fdrNumber) + '</button><div class="cell-sub">' + money(i.amount) + '</div></td>' +
        '<td><strong>' + esc(institutionOf(i).name || '') + '</strong></td>' +
        '<td><span class="reason">' + esc(r.reason) + '</span></td>' +
        '<td>' + fmtDate(r.requestedAt) + '</td>' +
        '<td>' + clearanceCell(r.ro) + '</td>' +
        '<td>' + clearanceCell(r.approval) + '</td>' +
        '<td>' + clearanceCell(r.grievance) + '</td>' +
        '<td>' + clearanceCell(r.vigilance) + '</td>' +
        '<td>' + noc + '</td>' +
        '<td>' + chip(stage, stageCls) + '</td>' +
        '<td>' + (act
          ? '<button class="btn tiny" data-act="' + i.id + '">Act now</button>'
          : '<button class="btn tiny ghost" data-open="' + i.id + '" data-tab="release">View</button>') + '</td>' +
        '</tr>';
    }).join('') : emptyRow(11, 'No release / refund requests yet.');

    var panel = $('#rel-request-panel');
    if (panel && !panel.hidden) {
      var sel = $('#rel-inst');
      if (sel) {
        var eligible = scopeInstruments().filter(function (i) {
          return ['Released', 'Exempt', 'Renewed'].indexOf(effStatus(i)) < 0 && !i.release;
        });
        var selected = state.preselectRelease || sel.value;
        sel.innerHTML = eligible.length
          ? eligible.map(function (i) {
            return '<option value="' + i.id + '">' + esc(i.fdrNumber) + ' \u00B7 ' + esc(institutionOf(i).name) + ' \u00B7 ' + money(i.amount) + '</option>';
          }).join('')
          : '<option value="">No eligible instrument</option>';
        if (selected && eligible.some(function (i) { return i.id === selected; })) sel.value = selected;
        var btn = $('#rel-submit');
        if (btn) btn.disabled = !eligible.length;
      }
    }
  }

  /* ------------------------------------------------------------
     Alerts
     ------------------------------------------------------------ */
  function buildAlerts(list) {
    var out = [];
    list.forEach(function (i) {
      var st = effStatus(i);
      if (['Released', 'Exempt'].indexOf(st) >= 0) return;
      var d = daysToMat(i);
      var instName = institutionOf(i).name || '';

      if (st !== 'Renewed') {
        if (d < 0) {
          out.push({ inst: i, sev: 'critical', tier: 'L4 \u00B7 Overdue', title: 'Matured ' + Math.abs(d) + ' day(s) ago', detail: 'Renewal or release action is pending for ' + instName + '. Escalated to the Regional Officer and Regulation Bureau.' });
        } else if (d <= 7) {
          out.push({ inst: i, sev: 'critical', tier: 'L3 \u00B7 7-day alert', title: 'Matures in ' + d + ' day(s)', detail: 'Final reminder for ' + instName + '. Renewal / replacement must be initiated immediately.' });
        } else if (d <= 15) {
          out.push({ inst: i, sev: 'warning', tier: 'L2 \u00B7 15-day alert', title: 'Matures in ' + d + ' day(s)', detail: 'Institution and Regional Office notified for renewal planning.' });
        } else if (d <= 30) {
          out.push({ inst: i, sev: 'info', tier: 'L1 \u00B7 30-day notice', title: 'Matures in ' + d + ' day(s)', detail: 'Advance notice generated for ' + instName + '.' });
        }
      }

      if (pendingVerification(i)) {
        var age = ageOf(i.submittedAt);
        if (age > 7) {
          out.push({ inst: i, sev: 'warning', tier: 'L2 \u00B7 Verification ageing', title: 'Verification pending for ' + age + ' days', detail: i.fdrNumber + ' is still self-declared. Bank confirmation / scrutiny is pending.' });
        }
      }

      if (isInRelease(i)) {
        var missing = missingReleaseDocs(i.release);
        if (missing.length) {
          out.push({ inst: i, sev: 'critical', tier: 'L2 \u00B7 Incomplete file', title: missing.length + ' release document(s) missing', detail: 'Missing: ' + missing.join(', ') + '. Request cannot be treated as complete.' });
        }
        var last = i.release.nocAt || (i.release.vigilance && i.release.vigilance.at) || (i.release.grievance && i.release.grievance.at) || (i.release.approval && i.release.approval.at) || (i.release.ro && i.release.ro.at) || i.release.requestedAt;
        var wait = ageOf(last);
        if (wait > 7) {
          out.push({ inst: i, sev: 'warning', tier: 'L2 \u00B7 Workflow ageing', title: 'Release case idle for ' + wait + ' days', detail: 'Currently at stage: ' + relStageLabel(i) + '. Follow up with the concerned desk.' });
        }
      }

      var ev = evaluate(i, state.instruments);
      ev.flags.forEach(function (f) {
        if (f.code === 'AMT_MISMATCH') {
          out.push({ inst: i, sev: 'critical', tier: 'Bank mismatch', title: 'Amount mismatch with bank record', detail: f.msg });
        }
        if (f.code === 'JOINT') {
          out.push({ inst: i, sev: 'warning', tier: 'Document scrutiny', title: 'Joint holder requirement not met', detail: f.msg });
        }
        if (f.code === 'IFSC') {
          out.push({ inst: i, sev: 'warning', tier: 'Validation', title: 'Invalid / missing IFSC', detail: f.msg });
        }
      });
    });

    var rank = { critical: 0, warning: 1, info: 2 };
    out.sort(function (a, b) {
      if (rank[a.sev] !== rank[b.sev]) return rank[a.sev] - rank[b.sev];
      return daysToMat(a.inst) - daysToMat(b.inst);
    });
    return out;
  }

  function renderAlerts() {
    var wrap = $('#alert-grid');
    if (!wrap) return;
    var alerts = state._alerts || [];
    var crit = alerts.filter(function (a) { return a.sev === 'critical'; });
    var warn = alerts.filter(function (a) { return a.sev === 'warning'; });
    var info = alerts.filter(function (a) { return a.sev === 'info'; });

    function cards(items) {
      return items.map(function (a) {
        return '<article class="alert-card ' + a.sev + '">' +
          '<div class="alert-top"><span class="chip ' + (a.sev === 'critical' ? 'danger' : a.sev === 'warning' ? 'warn' : 'info') + '">' + esc(a.tier) + '</span>' +
          '<span class="alert-date">' + fmtDate(a.inst.maturityDate) + '</span></div>' +
          '<h3>' + esc(a.title) + '</h3>' +
          '<p>' + esc(a.detail) + '</p>' +
          '<div class="alert-foot"><span>' + esc(a.inst.fdrNumber) + ' \u00B7 ' + esc(institutionOf(a.inst).name || '') + '</span>' +
          '<button class="link-btn" data-open="' + a.inst.id + '">Open record \u2192</button></div>' +
          '</article>';
      }).join('');
    }

    wrap.innerHTML =
      '<div class="alert-summary">' +
      '<div class="alert-stat critical"><strong>' + crit.length + '</strong><span>Critical / escalated</span></div>' +
      '<div class="alert-stat warning"><strong>' + warn.length + '</strong><span>Warnings</span></div>' +
      '<div class="alert-stat info"><strong>' + info.length + '</strong><span>Advance notices</span></div>' +
      '<div class="alert-ladder"><strong>Escalation ladder</strong><span>L1 30-day \u2192 L2 15-day \u2192 L3 7-day \u2192 L4 overdue</span></div>' +
      '</div>' +
      (crit.length ? '<h2 class="section-title">Critical &amp; overdue</h2><div class="alert-cards">' + cards(crit) + '</div>' : '') +
      (warn.length ? '<h2 class="section-title">Warnings</h2><div class="alert-cards">' + cards(warn) + '</div>' : '') +
      (info.length ? '<h2 class="section-title">Advance notices</h2><div class="alert-cards">' + cards(info) + '</div>' : '') +
      (!alerts.length ? '<div class="empty-state">No alerts. All records are within prescribed timelines.</div>' : '');
  }

  /* ------------------------------------------------------------
     Reports
     ------------------------------------------------------------ */
  function renderReports() {
    if (!state.session || ['ro', 'bureau', 'admin'].indexOf(state.session.role) < 0) return;

    var statusOrder = [
      ['Active', '#0E7A5F'], ['Expiring', '#D97706'], ['Pending Verification', '#2563EB'],
      ['Matured', '#B42318'], ['Release in Progress', '#7C3AED'], ['Renewed', '#0F766E'],
      ['Released', '#64748B'], ['Exempt', '#8B5CF6']
    ];
    var counts = {};
    state.instruments.forEach(function (i) {
      var s = effStatus(i);
      counts[s] = (counts[s] || 0) + 1;
    });
    var max = Math.max.apply(null, statusOrder.map(function (s) { return counts[s[0]] || 0; }).concat([1]));

    var statusEl = $('#chart-status');
    if (statusEl) {
      statusEl.innerHTML = statusOrder.map(function (s) {
        var n = counts[s[0]] || 0;
        return '<div class="hbar">' +
          '<div class="hbar-top"><span>' + s[0] + '</span><span>' + n + ' record' + (n === 1 ? '' : 's') + ' \u00B7 ' + Math.round(n / state.instruments.length * 100) + '%</span></div>' +
          '<div class="track"><div class="fill" style="width:' + Math.round(n / max * 100) + '%;background:' + s[1] + '"></div></div>' +
          '</div>';
      }).join('');
    }

    var buckets = [
      ['Overdue', -99999, -1, '#B42318'],
      ['0\u201330 d', 0, 30, '#D97706'],
      ['31\u201360 d', 31, 60, '#E4A23B'],
      ['61\u201390 d', 61, 90, '#2563EB'],
      ['91\u2013180 d', 91, 180, '#0F766E'],
      ['181\u2013365 d', 181, 365, '#0E7A5F'],
      ['365+ d', 366, 99999, '#64748B']
    ];
    var bcounts = buckets.map(function (b) {
      return state.instruments.filter(function (i) {
        if (['Released', 'Exempt', 'Renewed'].indexOf(effStatus(i)) >= 0) return false;
        var d = daysToMat(i);
        return d >= b[1] && d <= b[2];
      }).length;
    });
    var bmax = Math.max.apply(null, bcounts.concat([1]));
    var matEl = $('#chart-maturity');
    if (matEl) {
      matEl.innerHTML = '<div class="col-chart">' + buckets.map(function (b, idx) {
        return '<div class="col-item">' +
          '<div class="col-val">' + bcounts[idx] + '</div>' +
          '<div class="col-bar-wrap"><div class="col-bar" style="height:' + Math.max(4, Math.round(bcounts[idx] / bmax * 100)) + '%;background:' + b[3] + '"></div></div>' +
          '<div class="col-label">' + b[0] + '</div></div>';
      }).join('') + '</div>';
    }

    /* Region summary */
    var regions = {};
    state.institutions.forEach(function (inst) {
      if (!regions[inst.region]) regions[inst.region] = { institutions: 0, active: 0, value: 0, expiring: 0 };
      regions[inst.region].institutions += 1;
    });
    state.instruments.forEach(function (i) {
      var inst = institutionOf(i);
      if (!inst.region) return;
      var st = effStatus(i);
      if (['Released', 'Exempt'].indexOf(st) >= 0) return;
      regions[inst.region].active += 1;
      regions[inst.region].value += Number(i.amount || 0);
      var d = daysToMat(i);
      if (d >= 0 && d <= 30) regions[inst.region].expiring += 1;
    });

    var repBody = $('#rep-region');
    if (repBody) {
      repBody.innerHTML = Object.keys(regions).sort().map(function (name) {
        var r = regions[name];
        return '<tr><td><strong>' + esc(name) + '</strong></td><td>' + r.institutions + '</td><td>' + r.active + '</td><td>' + moneyFull(r.value) + '</td><td>' + r.expiring + '</td></tr>';
      }).join('');
    }
  }

  /* ------------------------------------------------------------
     Audit trail
     ------------------------------------------------------------ */
  function renderAudit() {
    var body = $('#audit-table');
    if (!body) return;
    var q = state.auditQ.trim().toLowerCase();
    var list = state.audit.filter(function (a) {
      if (!q) return true;
      return [a.actor, a.action, a.targetLabel, a.detail, roleLabel(a.role)].join(' ').toLowerCase().indexOf(q) >= 0;
    }).slice(0, 120);

    body.innerHTML = list.length ? list.map(function (a) {
      var target = a.targetId && instById(a.targetId)
        ? '<button class="link-btn" data-open="' + a.targetId + '">' + esc(a.targetLabel) + '</button>'
        : esc(a.targetLabel || '\u2014');
      return '<tr>' +
        '<td><span class="nowrap">' + fmtDateTime(a.at) + '</span></td>' +
        '<td><strong>' + esc(a.actor) + '</strong></td>' +
        '<td>' + chip(roleLabel(a.role), a.role === 'college' ? 'info' : a.role === 'system' ? 'muted' : 'violet') + '</td>' +
        '<td>' + esc(a.action) + '</td>' +
        '<td>' + target + '</td>' +
        '<td class="audit-detail">' + esc(a.detail) + '</td>' +
        '</tr>';
    }).join('') : emptyRow(6, 'No audit entries match this search.');
  }

  function renderUsers() {
    var body = $('#users-table');
    if (!body) return;
    var users = [
      ['Dr. Meera Kulkarni', 'Institution Admin', 'Sunrise Institute of Technology', 'Active', 'Today, 09:12'],
      ['Prof. A. Deshmukh', 'Institution Admin', 'Greenfield College of Engineering', 'Active', 'Yesterday, 17:40'],
      ['R. K. Sharma', 'Regional Officer', 'AICTE Western Region', 'Active', 'Today, 10:05'],
      ['S. Nair', 'Approval Bureau', 'AICTE Approval Bureau', 'Active', 'Today, 09:48'],
      ['P. Menon', 'Grievance Cell', 'AICTE Grievance Cell', 'Active', '2 days ago'],
      ['D. Chaturvedi', 'Vigilance Cell', 'AICTE Vigilance Cell', 'Active', '3 days ago'],
      ['A. Verma', 'System Administrator', 'AICTE Regulation Bureau', 'Active', 'Today, 08:30']
    ];
    body.innerHTML = users.map(function (u) {
      return '<tr><td><strong>' + u[0] + '</strong></td><td>' + chip(u[1], 'info') + '</td><td>' + u[2] + '</td><td>' + chip(u[3], 'ok') + '</td><td>' + u[4] + '</td></tr>';
    }).join('');
  }

  /* ------------------------------------------------------------
     Modal shell
     ------------------------------------------------------------ */
  function openRecord(id, tab) {
    var inst = instById(id);
    if (!inst) return;
    state.modal = { mode: 'record', id: id, tab: tab || 'overview' };
    renderModal();
  }

  function closeModal() {
    state.modal = null;
    $('#detail-modal').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function renderModal() {
    var modal = $('#detail-modal');
    if (!modal) return;
    var m = state.modal;
    if (!m) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
      return;
    }
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    var titleEl = $('#modal-title');
    var subEl = $('#modal-subtitle');
    var bodyEl = $('#modal-body');

    if (m.mode === 'record') {
      var inst = instById(m.id);
      if (!inst) { closeModal(); return; }
      var st = effStatus(inst);
      titleEl.innerHTML = esc(inst.fdrNumber) + ' ' + chip(st, statusClass(st));
      subEl.textContent = (institutionOf(inst).name || '') + ' \u00B7 ' + moneyFull(inst.amount);
      bodyEl.innerHTML = recordBody(inst, m.tab || 'overview');
    } else if (m.mode === 'verify') {
      titleEl.textContent = 'Bank verification (simulated)';
      subEl.textContent = m.id + ' \u00B7 ' + (instById(m.id) ? instById(m.id).bank : '');
      bodyEl.innerHTML = verifyBody(m);
    } else if (m.mode === 'action') {
      titleEl.textContent = actionTitle(m);
      subEl.textContent = m.id ? (instById(m.id) ? instById(m.id).fdrNumber + ' \u00B7 ' + institutionOf(instById(m.id)).name : '') : '';
      bodyEl.innerHTML = actionBody(m);
    } else if (m.mode === 'guide') {
      titleEl.textContent = 'Demo guide';
      subEl.textContent = '6 test scenarios mapped to the prototype';
      bodyEl.innerHTML = guideBody();
    }
  }

  /* ------------------------------------------------------------
     Record detail
     ------------------------------------------------------------ */
  function recordBody(inst, tab) {
    var ev = evaluate(inst, state.instruments);
    var counts = { docs: (inst.docs || []).length, flags: ev.flags.length };
    var tabs = [
      ['overview', 'Overview', ''],
      ['documents', 'Documents', String(counts.docs)],
      ['flags', 'Flags', counts.flags ? String(counts.flags) : '0'],
      ['release', 'Release', inst.release ? '1' : '0'],
      ['timeline', 'Timeline', '']
    ];
    var tabHtml = tabs.map(function (t) {
      return '<button class="tab ' + (tab === t[0] ? 'active' : '') + '" data-tab="' + t[0] + '">' + t[1] +
        (t[2] ? ' <span class="tab-count' + (t[0] === 'flags' && counts.flags ? ' alert' : '') + '">' + t[2] + '</span>' : '') + '</button>';
    }).join('');

    var content = '';
    if (tab === 'overview') content = overviewTab(inst, ev);
    else if (tab === 'documents') content = documentsTab(inst);
    else if (tab === 'flags') content = flagsTab(inst, ev);
    else if (tab === 'release') content = releaseTab(inst, ev);
    else content = timelineTab(inst);

    return '<div class="tabs">' + tabHtml + '</div><div class="tab-body">' + content + '</div>';
  }

  function overviewTab(inst, ev) {
    var instName = institutionOf(inst);
    var d = daysToMat(inst);
    var bc = inst.bankConfirmed;
    var actionButtons = '';
    if (canVerify(inst)) actionButtons += '<button class="btn primary small" data-verify="' + inst.id + '">' + (inst.verification === 'Bank-confirmed' ? 'Re-run bank verification' : 'Run bank verification') + '</button>';
    if (state.session.role === 'college' && !inst.release && ['Released', 'Exempt', 'Renewed'].indexOf(effStatus(inst)) < 0) {
      actionButtons += '<button class="btn small" data-request-release="' + inst.id + '">Request release / refund</button>';
    }

    return '<div class="detail-grid">' +
      field('Institution', esc(instName.name || '\u2014'), esc((instName.aicteId || '') + ' \u00B7 ' + (instName.region || '') + ' region')) +
      field('FDR / Deposit No.', esc(inst.fdrNumber), '') +
      field('Issuing bank', esc(inst.bank), esc(inst.branch)) +
      field('IFSC', esc(inst.ifsc), '') +
      field('Deposit amount', '<strong>' + moneyFull(inst.amount) + '</strong>', '') +
      field('Maturity', fmtDate(inst.maturityDate), (d < 0 ? Math.abs(d) + ' days overdue' : d + ' days remaining')) +
      field('Issue date', fmtDate(inst.issueDate), '') +
      field('Verification source', chip(inst.verification, verificationClass(inst.verification)), '') +
      '<div class="field span-2"><span class="field-label">Joint holders</span><div class="field-value">' +
      ((inst.jointNames || []).length ? (inst.jointNames || []).map(function (n) { return '<div class="joint-line">' + esc(n) + '</div>'; }).join('') : '<span class="muted">Not recorded</span>') +
      '</div></div>' +
      (inst.note ? '<div class="field span-2"><span class="field-label">Note</span><div class="field-value">' + esc(inst.note) + '</div></div>' : '') +
      '</div>' +

      '<div class="source-compare">' +
      '<div class="source-card declared"><div class="source-head"><span class="source-dot"></span>Self-declared by institution</div>' +
      '<div class="source-row"><span>Amount</span><strong>' + moneyFull(inst.amount) + '</strong></div>' +
      '<div class="source-row"><span>Maturity</span><strong>' + fmtDate(inst.maturityDate) + '</strong></div>' +
      '<div class="source-row"><span>Holder</span><strong>' + esc((inst.jointNames || []).join(', ') || '\u2014') + '</strong></div></div>' +
      '<div class="source-card confirmed ' + (bc ? '' : 'empty') + '"><div class="source-head"><span class="source-dot"></span>Bank-confirmed record</div>' +
      (bc
        ? '<div class="source-row"><span>Amount</span><strong class="' + (Number(bc.amount) !== Number(inst.amount) ? 'text-danger' : '') + '">' + moneyFull(bc.amount) + '</strong></div>' +
        '<div class="source-row"><span>Maturity</span><strong class="' + (bc.maturityDate !== inst.maturityDate ? 'text-danger' : '') + '">' + fmtDate(bc.maturityDate) + '</strong></div>' +
        '<div class="source-row"><span>Checked</span><strong>' + fmtDateTime(bc.checkedAt) + ' \u00B7 ' + esc(bc.reference) + '</strong></div>'
        : '<div class="source-empty">Not confirmed by the bank yet. Run verification to compare against the bank feed.</div>') +
      '</div></div>' +

      '<div class="insight-row">' + healthBlock(ev.health) +
      '<div class="insight-copy"><strong>' + (ev.flags.length ? ev.flags.length + ' open observation(s)' : 'No open observations') + '</strong>' +
      '<p>' + (ev.flags.length ? esc(ev.flags[0].msg) : 'Record passes all automated checks.') + '</p>' +
      (actionButtons ? '<div class="action-row">' + actionButtons + '</div>' : '') +
      '</div></div>';
  }

  function field(label, value, sub) {
    return '<div class="field"><span class="field-label">' + esc(label) + '</span><div class="field-value">' + value +
      (sub ? '<div class="field-sub">' + esc(sub) + '</div>' : '') + '</div></div>';
  }

  function healthBlock(score) {
    var color = healthColor(score);
    return '<div class="health-wrap"><div class="health-ring" style="background:conic-gradient(' + color + ' ' + (score || 0) + '%, #edf1f7 0)">' +
      '<div class="health-inner"><strong>' + (score == null ? '\u2014' : score) + '</strong><span>health</span></div></div>' +
      '<div class="health-caption">Automated<br>record score</div></div>';
  }

  function documentsTab(inst) {
    var required = [
      ['FDR Copy', 'FDR copy / deposit receipt', true],
      ['Bank Confirmation', 'Bank-issued confirmation letter', false],
      ['Trust Resolution', 'Trust / society resolution', false]
    ];
    var present = (inst.docs || []).map(function (d) { return d.type; });
    var rows = required.map(function (r) {
      var doc = (inst.docs || []).filter(function (d) { return d.type === r[0]; })[0];
      return '<div class="doc-row ' + (doc ? 'present' : 'missing') + '">' +
        '<div class="doc-icon">' + (doc ? '\u2713' : '!') + '</div>' +
        '<div class="doc-main"><strong>' + r[1] + '</strong><span>' + (doc ? esc(doc.name) + ' \u00B7 uploaded ' + fmtDate(doc.uploadedAt) : 'Not on record' + (r[2] ? ' (required)' : '')) + '</span></div>' +
        (doc ? '<button class="btn tiny ghost" data-preview="' + esc(doc.name) + '">Preview</button>' : '<span class="chip ' + (r[2] ? 'danger' : 'warn') + '">' + (r[2] ? 'Required' : 'Recommended') + '</span>') +
        '</div>';
    }).join('');

    var extras = (inst.docs || []).filter(function (d) {
      return ['FDR Copy', 'Bank Confirmation', 'Trust Resolution'].indexOf(d.type) < 0;
    });

    return '<div class="doc-list">' + rows + '</div>' +
      (extras.length ? '<h4 class="sub-head">Other documents</h4><div class="doc-list">' + extras.map(function (d) {
        return '<div class="doc-row present"><div class="doc-icon">\u2713</div><div class="doc-main"><strong>' + esc(d.type) + '</strong><span>' + esc(d.name) + ' \u00B7 ' + fmtDate(d.uploadedAt) + '</span></div>' +
          '<button class="btn tiny ghost" data-preview="' + esc(d.name) + '">Preview</button></div>';
      }).join('') + '</div>' : '') +
      '<div class="callout info">Secure document storage would use encrypted object storage with signed, time-limited access URLs. Preview is simulated in this prototype.</div>';
  }

  function flagsTab(inst, ev) {
    if (!ev.flags.length) {
      return '<div class="empty-state">No discrepancies detected for this record. The automated rule engine will re-run on any change.</div>';
    }
    var counts = { critical: 0, major: 0, minor: 0 };
    ev.flags.forEach(function (f) { counts[f.sev] += 1; });
    return '<div class="flag-summary">' +
      '<span class="flag-pill critical">' + counts.critical + ' critical</span>' +
      '<span class="flag-pill major">' + counts.major + ' major</span>' +
      '<span class="flag-pill minor">' + counts.minor + ' minor</span>' +
      '<span class="flag-note">Rule engine \u00B7 last scan just now</span></div>' +
      '<div class="flag-list">' + ev.flags.map(function (f) {
        return '<div class="flag-item ' + f.sev + '"><span class="sev-dot ' + f.sev + '"></span>' +
          '<div><strong>' + esc(f.msg) + '</strong><span class="flag-code">' + esc(f.code) + ' \u00B7 ' + f.sev.toUpperCase() + '</span></div></div>';
      }).join('') + '</div>' +
      '<div class="callout warn">Officers can record scrutiny observations in the audit trail. Discrepancies do not change the bank-confirmed record.</div>';
  }

  function releaseTab(inst, ev) {
    var r = inst.release;
    if (!r) {
      var eligible = state.session.role === 'college' && ['Released', 'Exempt', 'Renewed'].indexOf(effStatus(inst)) < 0;
      return '<div class="empty-state">No release / refund request recorded for this instrument.' +
        (eligible ? '<div style="margin-top:14px"><button class="btn primary small" data-request-release="' + inst.id + '">Start release / refund request</button></div>' : '') +
        '</div>' +
        '<div class="callout info">Release is processed after fulfillment of prescribed conditions and clearances from the Regional Office, Approval Bureau, Grievance Cell and Vigilance Cell, followed by NOC.</div>';
    }

    var idx = stageIdx(inst);
    var rejected = r.rejected;
    var rejectedIdx = rejected && typeof rejected.stageIdx === 'number' ? rejected.stageIdx : 1;
    var stepper = '<div class="stepper">' + STAGES.map(function (s, i) {
      var cls;
      if (rejected) cls = i < rejectedIdx ? 'done' : i === rejectedIdx ? 'rejected' : 'pending';
      else if (idx >= 7) cls = 'done';
      else cls = i < idx ? 'done' : i === idx ? 'current' : 'pending';
      return '<div class="step ' + cls + '"><span class="step-dot">' + (cls === 'done' ? '\u2713' : i + 1) + '</span><span class="step-label">' + s + '</span></div>';
    }).join('') + '</div>';

    var missing = missingReleaseDocs(r);
    var docs = '<div class="release-docs">' + ['Request Letter', 'Affidavit', 'FDR Copy', 'Trust Resolution'].map(function (t) {
      var doc = r.docs.filter(function (d) { return d.type === t; })[0];
      var req = ['Request Letter', 'Affidavit', 'FDR Copy'].indexOf(t) >= 0;
      return '<div class="mini-doc ' + (doc ? 'ok' : req ? 'miss' : '') + '">' + (doc ? '\u2713' : req ? '!' : '\u2013') + ' ' + t + '</div>';
    }).join('') + '</div>';

    var clearances = [['ro', 'Regional Office'], ['approval', 'Approval Bureau'], ['grievance', 'Grievance Cell'], ['vigilance', 'Vigilance Cell']].map(function (c) {
      var item = r[c[0]];
      return '<div class="clearance ' + (item ? 'done' : '') + '">' +
        '<span class="clearance-dot">' + (item ? '\u2713' : '\u25CB') + '</span>' +
        '<div><strong>' + c[1] + '</strong><span>' + (item ? esc(item.by) + ' \u00B7 ' + fmtDateTime(item.at) : 'Awaiting clearance') + '</span>' +
        (item && item.note ? '<em>' + esc(item.note) + '</em>' : '') + '</div></div>';
    }).join('');

    var action = relAction(inst);
    var actions = '';
    if (action) {
      var label = actionKind(action.idx) === 'noc' ? 'Issue NOC' : actionKind(action.idx) === 'release' ? 'Mark deposit released' : 'Clear and forward';
      actions = '<div class="action-row"><button class="btn primary small" data-act="' + inst.id + '">' + label + '</button>' +
        '<button class="btn danger-ghost small" data-reject="' + inst.id + '">Return with remarks</button></div>';
    } else if (!r.releasedAt && !rejected) {
      actions = '<div class="callout info">Awaiting action from <strong>' + roleLabel(STAGE_OWNER[idx] || '') + '</strong>.</div>';
    }

    return stepper +
      (rejected ? '<div class="callout danger"><strong>Returned:</strong> ' + esc(rejected.reason) + '<br><span class="muted">By ' + esc(rejected.by) + ' at ' + esc(rejected.stage) + ' \u00B7 ' + fmtDateTime(rejected.at) + '</span></div>' : '') +
      '<div class="release-grid">' +
      '<div><span class="field-label">Reason</span><p class="release-reason">' + esc(r.reason) + '</p>' +
      '<span class="field-label">Requested</span><p>' + fmtDateTime(r.requestedAt) + '</p>' +
      (r.note ? '<span class="field-label">Institution note</span><p class="muted">' + esc(r.note) + '</p>' : '') +
      (r.nocAt ? '<span class="field-label">NOC</span><p>' + esc(r.nocRef) + ' \u00B7 ' + fmtDate(r.nocAt) + '</p>' : '') +
      (r.releasedAt ? '<span class="field-label">Released on</span><p>' + fmtDateTime(r.releasedAt) + '</p>' : '') +
      '</div><div><span class="field-label">Release file</span>' + docs +
      (missing.length ? '<div class="callout warn small">Missing: ' + esc(missing.join(', ')) + '</div>' : '<div class="callout ok small">All required documents are on record.</div>') +
      '</div></div>' +
      '<h4 class="sub-head">Clearance trail</h4><div class="clearance-grid">' + clearances + '</div>' +
      (actions ? '<div class="modal-actions">' + actions + '</div>' : '');
  }

  function timelineTab(inst) {
    var entries = state.audit.filter(function (a) { return a.targetId === inst.id; })
      .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    if (!entries.length) return '<div class="empty-state">No events recorded for this instrument yet.</div>';
    return '<div class="timeline">' + entries.map(function (a) {
      return '<div class="tl-item"><span class="tl-dot"></span><div class="tl-main"><div class="tl-top"><strong>' + esc(a.action) + '</strong><span>' + fmtDateTime(a.at) + '</span></div>' +
        '<p>' + esc(a.detail) + '</p><span class="tl-actor">' + esc(a.actor) + ' \u00B7 ' + roleLabel(a.role) + '</span></div></div>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------
     Bank verification (simulated)
     ------------------------------------------------------------ */
  function openVerify(id) {
    var inst = instById(id);
    if (!inst || !canVerify(inst)) { toast('Verification is not available for this record / role.', 'error'); return; }
    state.modal = { mode: 'verify', id: id, phase: 'loading' };
    renderModal();
    setTimeout(function () {
      if (!state.modal || state.modal.mode !== 'verify' || state.modal.id !== id) return;
      state.modal.phase = 'result';
      state.modal.result = simulateBankResponse(inst);
      renderModal();
    }, 1100);
  }

  function simulateBankResponse(inst) {
    var validIfsc = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(inst.ifsc || '');
    if (!validIfsc) {
      return {
        ok: false,
        reason: 'IFSC could not be resolved in the bank directory. The instrument cannot be verified until a valid IFSC and branch are provided.',
        reference: 'BV-ERR-' + Math.floor(1000 + Math.random() * 9000)
      };
    }
    var bc = inst.bankConfirmed;
    return {
      ok: true,
      amount: bc ? Number(bc.amount) : Number(inst.amount),
      maturityDate: bc ? bc.maturityDate : inst.maturityDate,
      holder: bc ? bc.holder : (inst.jointNames || []).join(' & '),
      reference: bc ? bc.reference : 'BV-' + Math.floor(1000 + Math.random() * 9000)
    };
  }

  function verifyBody(m) {
    var inst = instById(m.id);
    if (!inst) return '';
    if (m.phase === 'loading') {
      return '<div class="verify-loading"><div class="spinner"></div><strong>Contacting bank verification service\u2026</strong>' +
        '<p>Checking FDR number, amount, maturity date and joint holders against the bank record.</p>' +
        '<div class="verify-steps"><span class="done">\u2713 Instrument identified</span><span class="done">\u2713 IFSC lookup</span><span class="pending">\u2026 Fetching bank response</span></div></div>' +
        '<div class="callout info">Demo note: this is a simulated bank feed. In production, an authorised bank verification API / signed confirmation would be used.</div>';
    }

    var res = m.result;
    if (!res.ok) {
      return '<div class="verify-fail"><strong>Verification could not be completed</strong><p>' + esc(res.reason) + '</p>' +
        '<span class="mono">Response ref: ' + esc(res.reference) + '</span></div>' +
        '<div class="modal-actions"><button class="btn danger" data-flag-discrepancy="' + inst.id + '">Flag discrepancy</button>' +
        '<button class="btn ghost" data-close="1">Close</button></div>';
    }

    var amtMatch = Number(res.amount) === Number(inst.amount);
    var dateMatch = res.maturityDate === inst.maturityDate;
    return '<div class="verify-result">' +
      '<div class="verify-banner ' + (amtMatch && dateMatch ? 'ok' : 'warn') + '">' +
      (amtMatch && dateMatch ? '\u2713 Bank record matches the institution declaration.' : '! Bank record differs from the institution declaration. Review the highlighted fields.') +
      '</div>' +
      '<table class="compare-table"><thead><tr><th>Field</th><th>Institution declared</th><th>Bank response</th><th>Match</th></tr></thead><tbody>' +
      '<tr><td>FDR number</td><td>' + esc(inst.fdrNumber) + '</td><td>' + esc(inst.fdrNumber) + '</td><td>' + chip('Match', 'ok') + '</td></tr>' +
      '<tr><td>Amount</td><td>' + moneyFull(inst.amount) + '</td><td>' + moneyFull(res.amount) + '</td><td>' + chip(amtMatch ? 'Match' : 'Mismatch', amtMatch ? 'ok' : 'danger') + '</td></tr>' +
      '<tr><td>Maturity</td><td>' + fmtDate(inst.maturityDate) + '</td><td>' + fmtDate(res.maturityDate) + '</td><td>' + chip(dateMatch ? 'Match' : 'Mismatch', dateMatch ? 'ok' : 'danger') + '</td></tr>' +
      '<tr><td>Joint holder</td><td colspan="2">' + esc(res.holder || '\u2014') + '</td><td>' + chip('Captured', 'info') + '</td></tr>' +
      '</tbody></table>' +
      '<div class="callout info">Bank response reference: <strong>' + esc(res.reference) + '</strong> \u00B7 Simulation for prototype demonstration.</div>' +
      '<div class="modal-actions"><button class="btn primary" data-accept-bank="' + inst.id + '">Accept &amp; mark bank-confirmed</button>' +
      '<button class="btn danger-ghost" data-flag-discrepancy="' + inst.id + '">Flag discrepancy</button>' +
      '<button class="btn ghost" data-close="1">Close</button></div></div>';
  }

  /* ------------------------------------------------------------
     Release actions
     ------------------------------------------------------------ */
  function actionTitle(m) {
    if (m.kind === 'reject') return 'Return release request';
    if (m.kind === 'noc') return 'Issue No-Objection Certificate';
    if (m.kind === 'release') return 'Mark deposit as released';
    return 'Advance release request';
  }

  function actionBody(m) {
    var inst = instById(m.id);
    if (!inst) return '';
    var r = inst.release;
    var idx = m.idx != null ? m.idx : stageIdx(inst);
    var missing = missingReleaseDocs(r);

    var intro = '';
    if (m.kind === 'clear') {
      intro = '<p>You are recording <strong>' + roleLabel(state.session.role) + ' clearance</strong> for <strong>' + esc(inst.fdrNumber) + '</strong> (' + esc(institutionOf(inst).name) + '). The case will move to the next stage.</p>';
    } else if (m.kind === 'noc') {
      intro = '<p>All four clearances are complete. Issue the NOC for <strong>' + esc(inst.fdrNumber) + '</strong>; the case will then await fund release.</p>';
    } else if (m.kind === 'release') {
      intro = '<p>This will mark the deposit of <strong>' + moneyFull(inst.amount) + '</strong> as released and close the workflow. The action is recorded in the audit trail.</p>';
    } else {
      intro = '<p>Return the release request to the institution with a clear reason. The case will be marked as returned.</p>';
    }

    return '<div class="action-modal">' + intro +
      (missing.length ? '<div class="callout warn">Missing documents: <strong>' + esc(missing.join(', ')) + '</strong>. The case still carries document flags.</div>' : '') +
      '<form id="action-form" class="form">' +
      (m.kind === 'noc' ? '<label class="form-field"><span class="form-label">NOC reference number</span><input class="input" id="action-ref" placeholder="AICTE/RO/.../NOC/2026/XXXX" value="' + esc(defaultNocRef()) + '"></label>' : '') +
      '<label class="form-field"><span class="form-label">' + (m.kind === 'reject' ? 'Reason for return (required)' : 'Remarks / scrutiny observation') + '</span>' +
      '<textarea class="textarea" id="action-note" placeholder="' + (m.kind === 'reject' ? 'Explain what needs to be corrected...' : 'Optional note for the audit trail...') + '"></textarea></label>' +
      '<div class="form-actions"><button type="submit" class="btn ' + (m.kind === 'reject' ? 'danger' : 'primary') + '">' + (m.kind === 'reject' ? 'Return request' : 'Confirm action') + '</button>' +
      '<button type="button" class="btn ghost" data-close="1">Cancel</button></div></form></div>';
  }

  function defaultNocRef() {
    var y = new Date().getFullYear();
    var n = Math.floor(100 + Math.random() * 900);
    return 'AICTE/RO/NOC/' + y + '/' + n;
  }

  function openAction(id, forceKind) {
    var inst = instById(id);
    if (!inst || !inst.release) return;
    if (forceKind === 'reject') {
      if (!relAction(inst)) { toast('You cannot act on this case at its current stage.', 'error'); return; }
      state.modal = { mode: 'action', id: id, kind: 'reject', idx: stageIdx(inst) };
    } else {
      var act = relAction(inst);
      if (!act) { toast('This case is not awaiting action from your role.', 'error'); return; }
      state.modal = { mode: 'action', id: id, kind: actionKind(act.idx), idx: act.idx };
    }
    renderModal();
  }

  function submitActionForm(form) {
    var m = state.modal;
    if (!m || m.mode !== 'action') return;
    var inst = instById(m.id);
    if (!inst || !inst.release) return;
    var noteEl = $('#action-note');
    var note = noteEl ? noteEl.value.trim() : '';
    var idx = m.idx != null ? m.idx : stageIdx(inst);

    if (m.kind === 'reject') {
      if (!note) { toast('Please enter a reason for returning the request.', 'error'); return; }
      inst.release.rejected = {
        at: nowISO(), by: state.session.name, role: state.session.role,
        stageIdx: idx, stage: STAGES[idx] || 'Release', reason: note
      };
      logAction('Release request returned', inst, 'Returned at ' + (STAGES[idx] || 'release') + ' stage. Reason: ' + note);
      toast('Release request returned to the institution with remarks.');
    } else if (m.kind === 'clear') {
      var key = STAGE_KEY[idx];
      inst.release[key] = { at: nowISO(), by: state.session.name, note: note || 'Verified and cleared.' };
      logAction(roleLabel(state.session.role) + ' clearance recorded', inst, note || 'Verified and cleared.');
      toast(roleLabel(state.session.role) + ' clearance recorded. Case moved to the next stage.');
    } else if (m.kind === 'noc') {
      var ref = ($('#action-ref') ? $('#action-ref').value.trim() : '') || defaultNocRef();
      inst.release.nocAt = nowISO();
      inst.release.nocRef = ref;
      logAction('NOC issued', inst, 'NOC reference: ' + ref + '. ' + (note || ''));
      toast('NOC issued. Case is now awaiting fund release.');
    } else if (m.kind === 'release') {
      inst.release.releasedAt = nowISO();
      inst.status = 'Released';
      logAction('Deposit released', inst, note || 'FDR released to the joint holders after all prescribed clearances.');
      toast('Deposit marked as released. Workflow closed and audit trail updated.');
    }

    state.modal = { mode: 'record', id: inst.id, tab: 'release' };
    save();
    renderAll();
  }

  /* ------------------------------------------------------------
     Submit new FDR
     ------------------------------------------------------------ */
  function renderUploads() {
    var el = $('#upload-list');
    if (!el) return;
    if (!state.uploads.length) {
      el.innerHTML = '<div class="upload-empty">No documents attached yet. FDR copy is required for a clean submission; missing documents will be flagged.</div>';
      return;
    }
    el.innerHTML = state.uploads.map(function (u, idx) {
      return '<div class="upload-item"><div class="file-badge">' + (u.type === 'FDR Copy' ? 'FDR' : u.type === 'Bank Confirmation' ? 'BNK' : 'DOC') + '</div>' +
        '<div class="upload-main"><strong>' + esc(u.name) + '</strong><span>' + esc(u.type) + ' \u00B7 ' + (u.size || 'sample') + '</span></div>' +
        '<button class="icon-x" data-remove-upload="' + idx + '" title="Remove">\u2715</button></div>';
    }).join('');
  }

  function guessDocType(name) {
    var n = name.toLowerCase();
    if (n.indexOf('bank') >= 0) return 'Bank Confirmation';
    if (n.indexOf('trust') >= 0 || n.indexOf('resolution') >= 0) return 'Trust Resolution';
    if (n.indexOf('affidavit') >= 0) return 'Affidavit';
    if (n.indexOf('request') >= 0) return 'Request Letter';
    return 'FDR Copy';
  }

  function addUpload(name, type, size) {
    if (state.uploads.length >= 5) { toast('Maximum 5 files allowed in the prototype.', 'error'); return; }
    state.uploads.push({ name: name, type: type || guessDocType(name), size: size || 'sample' });
    renderUploads();
  }

  function resetSubmitForm() {
    ['#sub-fdrno', '#sub-bank', '#sub-branch', '#sub-ifsc', '#sub-amt'].forEach(function (s) {
      var el = $(s); if (el) el.value = '';
    });
    var issue = $('#sub-issue'), mat = $('#sub-mat');
    if (issue) issue.value = D.addDays(-30);
    if (mat) mat.value = D.addDays(365);
    var joint = $('#sub-joint');
    if (joint) joint.value = '';
    state.uploads = [];
    renderUploads();
  }

  function submitFdr() {
    var instId = $('#sub-inst') ? $('#sub-inst').value : '';
    var fdrno = ($('#sub-fdrno') || {}).value || '';
    var bank = ($('#sub-bank') || {}).value || '';
    var branch = ($('#sub-branch') || {}).value || '';
    var ifsc = (($('#sub-ifsc') || {}).value || '').toUpperCase().trim();
    var amount = Number(($('#sub-amt') || {}).value || 0);
    var issue = ($('#sub-issue') || {}).value || '';
    var mat = ($('#sub-mat') || {}).value || '';
    var joint = ($('#sub-joint') || {}).value || '';

    fdrno = fdrno.trim();
    bank = bank.trim();
    branch = branch.trim();

    if (!instId || !fdrno || !bank || !branch || !ifsc || !amount || !issue || !mat) {
      toast('Please fill all mandatory fields before submitting.', 'error');
      return;
    }
    if (amount <= 0) { toast('Deposit amount must be greater than zero.', 'error'); return; }
    if (new Date(mat) <= new Date(issue)) { toast('Maturity date must be after the issue date.', 'error'); return; }

    var year = new Date().getFullYear();
    var prefix = 'FDR-' + year + '-';
    var nums = state.instruments.map(function (i) { return i.id; })
      .filter(function (id) { return id.indexOf(prefix) === 0; })
      .map(function (id) { return parseInt(id.slice(prefix.length), 10) || 0; });
    var next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    var newId = prefix + String(next).padStart(3, '0');

    var docs = state.uploads.map(function (u) {
      return { name: u.name, type: u.type, uploadedAt: nowISO() };
    });

    var inst = {
      id: newId,
      instId: instId,
      fdrNumber: fdrno,
      bank: bank,
      branch: branch,
      ifsc: ifsc,
      amount: amount,
      issueDate: issue,
      maturityDate: mat,
      jointNames: joint.split(/,|&/).map(function (s) { return s.trim(); }).filter(Boolean),
      status: 'Pending Verification',
      verification: 'Self-declared',
      bankConfirmed: null,
      docs: docs,
      release: null,
      renewalOf: null,
      renewalTo: null,
      note: '',
      submittedAt: nowISO()
    };

    state.instruments.push(inst);
    logAction('FDR submitted', inst, 'Instrument submitted through the institution portal. Source: self-declared. Documents: ' +
      (docs.length ? docs.map(function (d) { return d.type; }).join(', ') : 'none'));

    var ev = evaluate(inst, state.instruments);
    save();
    resetSubmitForm();
    state.modal = { mode: 'record', id: inst.id, tab: 'overview' };
    renderAll();
    toast(ev.flags.length
      ? 'FDR submitted with ' + ev.flags.length + ' observation(s). Open the record to review the flags.'
      : 'FDR submitted successfully. Pending bank verification.', ev.flags.length ? 'warn' : 'ok');
  }

  /* ------------------------------------------------------------
     Release request (institution)
     ------------------------------------------------------------ */
  function submitReleaseRequest() {
    var sel = $('#rel-inst');
    var inst = sel && sel.value ? instById(sel.value) : null;
    if (!inst) { toast('Select an eligible instrument first.', 'error'); return; }
    if (inst.release) { toast('A release request already exists for this instrument.', 'error'); return; }
    var declare = $('#rel-declare');
    if (declare && !declare.checked) { toast('Please confirm the declaration before submitting.', 'error'); return; }

    var docs = [];
    function addDoc(id, type, name) {
      var cb = $(id);
      if (cb && cb.checked) docs.push({ name: name, type: type, uploadedAt: nowISO() });
    }
    addDoc('#rel-doc-letter', 'Request Letter', 'Release request letter - demo.pdf');
    addDoc('#rel-doc-affidavit', 'Affidavit', 'Affidavit - demo.pdf');
    addDoc('#rel-doc-fdr', 'FDR Copy', 'FDR copy - demo.pdf');
    addDoc('#rel-doc-resolution', 'Trust Resolution', 'Trust resolution - demo.pdf');

    var reason = $('#rel-reason') ? $('#rel-reason').value : 'Release requested';
    var note = $('#rel-note') ? $('#rel-note').value.trim() : '';

    inst.release = {
      requestedAt: nowISO(), reason: reason, note: note, docs: docs,
      ro: null, approval: null, grievance: null, vigilance: null,
      nocAt: null, nocRef: '', releasedAt: null, rejected: null
    };

    logAction('Release request submitted', inst, 'Reason: ' + reason + '. Documents attached: ' + (docs.length ? docs.map(function (d) { return d.type; }).join(', ') : 'none') + '.');
    save();
    state.preselectRelease = null;
    state.modal = { mode: 'record', id: inst.id, tab: 'release' };
    renderAll();
    var missing = missingReleaseDocs(inst.release);
    toast(missing.length
      ? 'Request submitted, but ' + missing.length + ' required document(s) are missing and have been flagged.'
      : 'Release request submitted. It will now move to the Regional Office for review.', missing.length ? 'warn' : 'ok');
  }

  /* ------------------------------------------------------------
     Demo guide
     ------------------------------------------------------------ */
  function guideBody() {
    var items = [
      ['1. New FDR submission', 'Login as Institution \u2192 Submit FDR. Fill details, click "Use sample documents" (or submit without documents to trigger flags), then submit. The record opens with the discrepancy scan.'],
      ['2. Validity & maturity tracking', 'Dashboard \u2192 Upcoming Maturities / Alerts. FDR-2026-033 matures in 3 days; FDR-2025-009 is already overdue.'],
      ['3. Verification & discrepancy', 'Login as Regional Officer \u2192 open FDR-2026-002 \u2192 "Run bank verification". The bank response shows a \u20B910 L amount against \u20B912 L declared.'],
      ['4. Renewal history', 'Open FDR-2025-022 (Renewed) and FDR-2026-051 (renewal). The note + timeline show the chain of instruments.'],
      ['5. Release workflow', 'Login as Institution \u2192 Release / Refund \u2192 request release (uncheck the affidavit to demo a missing-document flag). Then act as RO \u2192 Bureau \u2192 Grievance \u2192 Vigilance \u2192 NOC \u2192 released.'],
      ['6. Audit trail', 'Admin / RO \u2192 Audit Trail. Every submission, verification, clearance and release is recorded with actor, time and remarks.']
    ];
    return '<div class="guide-list">' + items.map(function (it) {
      return '<div class="guide-item"><strong>' + it[0] + '</strong><p>' + it[1] + '</p></div>';
    }).join('') + '</div><div class="callout info">All data is fictional. Bank verification is simulated. No real money, FDR or personal data is processed.</div>';
  }

  /* ------------------------------------------------------------
     CSV export
     ------------------------------------------------------------ */
  function downloadCSV(rows, filename) {
    var csv = rows.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportInstruments() {
    var list = filteredInstruments();
    var rows = [['Instrument ID', 'Institution', 'AICTE ID', 'FDR No.', 'Bank', 'Branch', 'IFSC', 'Amount (INR)', 'Issue Date', 'Maturity Date', 'Joint Holders', 'Verification', 'Status', 'Health', 'Flags']];
    list.forEach(function (i) {
      var ev = evaluate(i, state.instruments);
      rows.push([i.id, institutionOf(i).name || '', institutionOf(i).aicteId || '', i.fdrNumber, i.bank, i.branch, i.ifsc,
        i.amount, i.issueDate, i.maturityDate, (i.jointNames || []).join(' | '), i.verification, effStatus(i),
        ev.health == null ? '' : ev.health, ev.flags.map(function (f) { return f.code; }).join(' | ')]);
    });
    downloadCSV(rows, 'fdr-vault-instruments.csv');
    toast('Repository exported as CSV.', 'ok');
  }

  /* ------------------------------------------------------------
     Login / session
     ------------------------------------------------------------ */
  function login(key) {
    var meta = ROLES[key];
    if (!meta) return;
    state.session = meta;
    state.view = key === 'college' ? 'dashboard' : 'dashboard';
    state.modal = null;
    state.filters = { q: '', status: 'all', ver: 'all' };
    var search = $('#inst-search'); if (search) search.value = '';
    var auditSearch = $('#audit-search'); if (auditSearch) auditSearch.value = '';

    $('#login-screen').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');

    if (key === 'college') {
      var inst = sessionInstitution();
      var sel = $('#sub-inst');
      if (sel) sel.innerHTML = '<option value="' + inst.id + '">' + esc(inst.name) + ' \u00B7 ' + esc(inst.aicteId) + '</option>';
      var joint = $('#sub-joint');
      if (joint && !joint.value) joint.value = 'Chairman, Sunrise Education Trust, Regional Officer, AICTE Western Region';
      var issue = $('#sub-issue'), mat = $('#sub-mat');
      if (issue && !issue.value) issue.value = D.addDays(-30);
      if (mat && !mat.value) mat.value = D.addDays(365);
    }

    renderAll();
    toast('Signed in as ' + meta.label + ' (demo role).', 'ok');
  }

  function logout() {
    state.session = null;
    state.modal = null;
    $('#app-shell').classList.add('hidden');
    $('#login-screen').classList.remove('hidden');
    $('#detail-modal').classList.add('hidden');
    document.body.style.overflow = '';
    state.uploads = [];
    resetSubmitForm();
  }

  /* ------------------------------------------------------------
     Event wiring
     ------------------------------------------------------------ */
  function wireEvents() {
    document.addEventListener('click', function (e) {
      var roleBtn = e.target.closest('[data-role]');
      if (roleBtn && roleBtn.closest('#login-screen')) { login(roleBtn.getAttribute('data-role')); return; }

      var navBtn = e.target.closest('.nav-item');
      if (navBtn) { showView(navBtn.getAttribute('data-view')); return; }

      var goBtn = e.target.closest('[data-go]');
      if (goBtn) { showView(goBtn.getAttribute('data-go')); return; }

      if (e.target.closest('#logout-btn')) { logout(); return; }
      if (e.target.closest('#reset-demo')) {
        initData(true);
        state.preselectRelease = null;
        renderAll();
        toast('Demo data reset with fresh dates.', 'ok');
        return;
      }
      if (e.target.closest('#demo-guide')) { state.modal = { mode: 'guide' }; renderModal(); return; }
      if (e.target.closest('#alert-chip')) { showView('alerts'); return; }

      var openBtn = e.target.closest('[data-open]');
      if (openBtn) { openRecord(openBtn.getAttribute('data-open'), openBtn.getAttribute('data-tab') || 'overview'); return; }

      var verifyBtn = e.target.closest('[data-verify]');
      if (verifyBtn) { openVerify(verifyBtn.getAttribute('data-verify')); return; }

      var actBtn = e.target.closest('[data-act]');
      if (actBtn) { openAction(actBtn.getAttribute('data-act')); return; }

      var rejBtn = e.target.closest('[data-reject]');
      if (rejBtn) { openAction(rejBtn.getAttribute('data-reject'), 'reject'); return; }

      var tabBtn = e.target.closest('[data-tab]');
      if (tabBtn && state.modal && state.modal.mode === 'record') {
        state.modal.tab = tabBtn.getAttribute('data-tab');
        renderModal();
        return;
      }

      if (e.target.closest('[data-close]') || e.target.id === 'modal-close' || e.target.id === 'modal-backdrop') {
        closeModal();
        return;
      }

      var acceptBtn = e.target.closest('[data-accept-bank]');
      if (acceptBtn) {
        var id = acceptBtn.getAttribute('data-accept-bank');
        acceptBankResponse(id);
        return;
      }

      var flagBtn = e.target.closest('[data-flag-discrepancy]');
      if (flagBtn) {
        flagDiscrepancy(flagBtn.getAttribute('data-flag-discrepancy'));
        return;
      }

      var removeUp = e.target.closest('[data-remove-upload]');
      if (removeUp) {
        state.uploads.splice(Number(removeUp.getAttribute('data-remove-upload')), 1);
        renderUploads();
        return;
      }

      var reqRel = e.target.closest('[data-request-release]');
      if (reqRel) {
        var rid = reqRel.getAttribute('data-request-release');
        state.preselectRelease = rid;
        closeModal();
        showView('releases');
        var sel = $('#rel-inst');
        if (sel) sel.value = rid;
        toast('Instrument selected. Review the release file checklist and submit.', 'ok');
        return;
      }

      var preview = e.target.closest('[data-preview]');
      if (preview) { toast('Document preview is simulated in this prototype: ' + preview.getAttribute('data-preview'), 'ok'); return; }

      if (e.target.closest('#use-sample-docs')) {
        state.uploads = [
          { name: 'FDR copy - sample.pdf', type: 'FDR Copy', size: '242 KB' },
          { name: 'Bank confirmation - sample.pdf', type: 'Bank Confirmation', size: '118 KB' },
          { name: 'Trust resolution - sample.pdf', type: 'Trust Resolution', size: '96 KB' }
        ];
        renderUploads();
        toast('Sample documents attached for the demo.', 'ok');
        return;
      }

      if (e.target.closest('#sub-reset')) { resetSubmitForm(); toast('Form cleared.', 'ok'); return; }

      if (e.target.closest('#export-instruments')) { exportInstruments(); return; }

      if (e.target.closest('#rel-submit')) { submitReleaseRequest(); return; }

      if (e.target.closest('#upload-zone')) {
        var input = $('#upload-input');
        if (input && e.target !== input) input.click();
        return;
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target.id === 'inst-filter-status') { state.filters.status = e.target.value; renderInstruments(); }
      if (e.target.id === 'inst-filter-ver') { state.filters.ver = e.target.value; renderInstruments(); }
      if (e.target.id === 'upload-input') {
        Array.prototype.slice.call(e.target.files || []).forEach(function (f) {
          addUpload(f.name, guessDocType(f.name), Math.round(f.size / 1024) + ' KB');
        });
        e.target.value = '';
      }
    });

    document.addEventListener('input', function (e) {
      if (e.target.id === 'inst-search') { state.filters.q = e.target.value; renderInstruments(); }
      if (e.target.id === 'audit-search') { state.auditQ = e.target.value; renderAudit(); }
    });

    document.addEventListener('submit', function (e) {
      if (e.target.id === 'submit-form') {
        e.preventDefault();
        submitFdr();
      }
      if (e.target.id === 'action-form') {
        e.preventDefault();
        submitActionForm(e.target);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.modal) closeModal();
    });
  }

  function acceptBankResponse(id) {
    var inst = instById(id);
    if (!inst) return;
    if (!canVerify(inst)) { toast('You are not authorised to record this verification.', 'error'); return; }
    var m = state.modal;
    if (!m || m.mode !== 'verify' || !m.result || !m.result.ok) { toast('A valid bank response is required.', 'error'); return; }
    var r = m.result;
    inst.bankConfirmed = {
      amount: r.amount, maturityDate: r.maturityDate, holder: r.holder,
      checkedAt: nowISO(), reference: r.reference
    };
    inst.verification = 'Bank-confirmed';
    if (inst.status === 'Pending Verification') inst.status = 'Active';
    logAction('Bank verification accepted', inst, 'Bank response ' + r.reference + ' recorded. Amount ' + moneyFull(r.amount) + ', maturity ' + fmtDate(r.maturityDate) + '.');
    save();
    state.modal = { mode: 'record', id: inst.id, tab: 'overview' };
    renderAll();
    toast('Bank-confirmed details saved. The declaration and bank record are now shown separately.', 'ok');
  }

  function flagDiscrepancy(id) {
    var inst = instById(id);
    if (!inst) return;
    if (!state.session || ['ro', 'bureau', 'admin'].indexOf(state.session.role) < 0) {
      toast('Only authorised officers can flag a discrepancy.', 'error');
      return;
    }
    inst.verification = 'Discrepancy';
    logAction('Discrepancy flagged', inst, 'Officer flagged a verification discrepancy. Self-declared data retained; bank confirmation not recorded.');
    save();
    state.modal = { mode: 'record', id: inst.id, tab: 'flags' };
    renderAll();
    toast('Discrepancy flagged and added to the watchlist.', 'warn');
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  function init() {
    initData(false);
    wireEvents();
    var chip = $('#today-chip');
    if (chip) chip.textContent = fmtDate(DEMO_TODAY);
    renderUploads();
    resetSubmitForm();
    var demoToday = $('#demo-today');
    if (demoToday) demoToday.textContent = fmtDate(DEMO_TODAY);

    /* Quick deep-link for demos: index.html?role=admin (or ro / college / bureau / grievance / vigilance) */
    try {
      var params = new URLSearchParams(window.location.search);
      var autoRole = params.get('role');
      if (autoRole && ROLES[autoRole]) login(autoRole);
    } catch (e) { /* ignore */ }
  }

  init();
})();
