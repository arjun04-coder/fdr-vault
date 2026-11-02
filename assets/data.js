/* ============================================================
   FDR Vault — demo dataset
   All institutions, banks, amounts and events are fictional.
   Dates are generated relative to "today" so the demo always
   shows live-looking maturity / expiry alerts.
   ============================================================ */
(function () {
  'use strict';

  var DAY = 86400000;
  var pad = function (n) { return String(n).padStart(2, '0'); };

  function addDays(n) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayISO() { return addDays(0); }

  function diffDays(fromISO, toISO) {
    var a = String(fromISO).slice(0, 10).split('-').map(Number);
    var b = String(toISO).slice(0, 10).split('-').map(Number);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / DAY);
  }

  function stamp(daysAgo, hh, mm) {
    var d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hh == null ? 11 : hh, mm == null ? 0 : mm, 0, 0);
    return d.toISOString();
  }

  function at(dateISO, hh, mm) {
    var p = String(dateISO).slice(0, 10).split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2], hh == null ? 11 : hh, mm == null ? 0 : mm, 0, 0);
    return d.toISOString();
  }

  /* ---------------- Institutions ---------------- */
  var INSTITUTIONS = [
    { id: 'INST-001', name: 'Sunrise Institute of Technology', aicteId: '1-10234567', type: 'New institution', state: 'Maharashtra', region: 'Western', minDeposit: 2000000, contact: 'Dr. Meera Kulkarni · Registrar' },
    { id: 'INST-002', name: 'Greenfield College of Engineering', aicteId: '1-10456789', type: 'New institution', state: 'Maharashtra', region: 'Western', minDeposit: 2000000, contact: 'Prof. A. Deshmukh · Principal' },
    { id: 'INST-003', name: 'Deccan Institute of Technology', aicteId: '1-10876543', type: 'Existing (est. 2011)', state: 'Telangana', region: 'Southern', minDeposit: 4000000, contact: 'Dr. K. Rao · Director' },
    { id: 'INST-004', name: 'Bharat College of Management', aicteId: '1-10987654', type: 'New institution', state: 'Rajasthan', region: 'Northern', minDeposit: 1500000, contact: 'Ms. R. Agarwal · Registrar' },
    { id: 'INST-005', name: 'Nalanda Institute of Engineering', aicteId: '1-10678901', type: 'Existing (est. 2008)', state: 'Bihar', region: 'Eastern', minDeposit: 3000000, contact: 'Dr. S. Prasad · Director' },
    { id: 'INST-006', name: 'Cochin College of Applied Sciences', aicteId: '1-10789012', type: 'New institution', state: 'Kerala', region: 'Southern', minDeposit: 1200000, contact: 'Fr. T. Joseph · Registrar' },
    { id: 'INST-007', name: 'Sahyadri Polytechnic', aicteId: '1-10123456', type: 'Govt. / aided', state: 'Maharashtra', region: 'Western', minDeposit: 0, contact: 'Shri P. Patil · Principal' },
    { id: 'INST-008', name: 'Vidya Institute of Technology', aicteId: '1-10543210', type: 'New institution', state: 'Madhya Pradesh', region: 'Central', minDeposit: 1800000, contact: 'Dr. N. Jain · Registrar' },
    { id: 'INST-009', name: 'Aryavart College of Engineering', aicteId: '1-10345678', type: 'Existing (est. 2013)', state: 'Uttar Pradesh', region: 'Northern', minDeposit: 2200000, contact: 'Mr. V. Singh · Registrar' },
    { id: 'INST-010', name: 'Kalinga Institute of Management', aicteId: '1-10098765', type: 'New institution', state: 'Odisha', region: 'Eastern', minDeposit: 1500000, contact: 'Dr. M. Mohanty · Director' }
  ];

  var byId = {};
  INSTITUTIONS.forEach(function (i) { byId[i.id] = i; });

  /* ---------------- helpers to build records ---------------- */
  function docs(items, daysAgo) {
    return items.map(function (pair) {
      return {
        name: pair[0],
        type: pair[1],
        uploadedAt: pair[2] != null ? stamp(pair[2], 10, 20) : stamp(daysAgo, 10, 20)
      };
    });
  }

  var D = {
    fdr: function (n) { return 'FDR copy - ' + n + '.pdf'; },
    bank: function (n) { return 'Bank confirmation - ' + n + '.pdf'; },
    trust: function (n) { return 'Trust resolution - ' + n + '.pdf'; }
  };

  function release(obj) {
    return Object.assign({
      requestedAt: null,
      reason: '',
      note: '',
      docs: [],
      ro: null,
      approval: null,
      grievance: null,
      vigilance: null,
      nocAt: null,
      nocRef: '',
      releasedAt: null,
      rejected: null
    }, obj);
  }

  function mk(o) {
    return Object.assign({
      id: '',
      instId: '',
      fdrNumber: '',
      bank: '',
      branch: '',
      ifsc: '',
      amount: 0,
      issueDate: addDays(-365),
      maturityDate: addDays(365),
      jointNames: [],
      status: 'Active',
      verification: 'Self-declared',
      bankConfirmed: null,
      docs: [],
      release: null,
      renewalOf: null,
      renewalTo: null,
      note: '',
      submittedAt: stamp(30, 10, 30)
    }, o);
  }

  var AICTE_OFFICER = {
    Western: 'Regional Officer, AICTE Western Region',
    Southern: 'Regional Officer, AICTE Southern Region',
    Northern: 'Regional Officer, AICTE Northern Region',
    Eastern: 'Regional Officer, AICTE Eastern Region',
    Central: 'Regional Officer, AICTE Central Region'
  };

  function joint(inst, officeHolder) {
    return [officeHolder || ('Chairman, ' + inst.name.replace(/ (Institute|College|Polytechnic).*/, '') + ' Trust'), AICTE_OFFICER[inst.region]];
  }

  /* ---------------- Instruments ---------------- */
  var instruments = [
    mk({
      id: 'FDR-2026-014', instId: 'INST-001', fdrNumber: 'FDR 2026-014', bank: 'State Bank of India',
      branch: 'Pune Camp Branch', ifsc: 'SBIN0001234', amount: 2500000,
      issueDate: addDays(-320), maturityDate: addDays(8),
      jointNames: joint(byId['INST-001'], 'Chairman, Sunrise Education Trust'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 2500000, maturityDate: addDays(8), holder: 'Sunrise Education Trust & AICTE', checkedAt: stamp(25, 15, 5), reference: 'BV-8841' },
      docs: docs([[D.fdr('FDR 2026-014'), 'FDR Copy', 320], [D.bank('FDR 2026-014'), 'Bank Confirmation', 25], [D.trust('Sunrise Education Trust'), 'Trust Resolution', 321]]),
      submittedAt: stamp(322, 10, 30)
    }),
    mk({
      id: 'FDR-2026-021', instId: 'INST-001', fdrNumber: 'FDR 2026-021', bank: 'HDFC Bank',
      branch: 'Kothrud Branch', ifsc: 'HDFC0000456', amount: 1000000,
      issueDate: addDays(-700), maturityDate: addDays(24),
      jointNames: joint(byId['INST-001'], 'Chairman, Sunrise Education Trust'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 1000000, maturityDate: addDays(24), holder: 'Sunrise Education Trust & AICTE', checkedAt: stamp(60, 12, 10), reference: 'BV-8790' },
      docs: docs([[D.fdr('FDR 2026-021'), 'FDR Copy', 700], [D.bank('FDR 2026-021'), 'Bank Confirmation', 60]]),
      submittedAt: stamp(701, 11, 5)
    }),
    mk({
      id: 'FDR-2026-033', instId: 'INST-002', fdrNumber: 'FDR 2026-033', bank: 'Bank of Baroda',
      branch: 'Nagpur Main Branch', ifsc: 'BARB0NAGPUR', amount: 2000000,
      issueDate: addDays(-350), maturityDate: addDays(3),
      jointNames: joint(byId['INST-002'], 'President, Greenfield Education Society'),
      status: 'Active', verification: 'Self-declared',
      docs: docs([[D.fdr('FDR 2026-033'), 'FDR Copy', 350]]),
      submittedAt: stamp(352, 9, 45)
    }),
    mk({
      id: 'FDR-2026-041', instId: 'INST-003', fdrNumber: 'FDR 2026-041', bank: 'ICICI Bank',
      branch: 'Banjara Hills Branch', ifsc: 'ICIC0001234', amount: 4000000,
      issueDate: addDays(-2000), maturityDate: addDays(45),
      jointNames: joint(byId['INST-003'], 'Chairman, Deccan Education Trust'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 4000000, maturityDate: addDays(45), holder: 'Deccan Education Trust & AICTE', checkedAt: stamp(100, 14, 0), reference: 'BV-8610' },
      docs: docs([[D.fdr('FDR 2026-041'), 'FDR Copy', 2000], [D.bank('FDR 2026-041'), 'Bank Confirmation', 100], [D.trust('Deccan Education Trust'), 'Trust Resolution', 1998]]),
      submittedAt: stamp(2003, 10, 15)
    }),
    mk({
      id: 'FDR-2025-009', instId: 'INST-004', fdrNumber: 'FDR 2025-009', bank: 'Punjab National Bank',
      branch: 'MI Road Branch', ifsc: 'PUNB0123400', amount: 1500000,
      issueDate: addDays(-420), maturityDate: addDays(-10),
      jointNames: joint(byId['INST-004'], 'Chairman, Bharat Shiksha Samiti'),
      status: 'Active', verification: 'Self-declared',
      docs: docs([[D.fdr('FDR 2025-009'), 'FDR Copy', 420]]),
      submittedAt: stamp(423, 12, 20)
    }),
    mk({
      id: 'FDR-2025-017', instId: 'INST-005', fdrNumber: 'FDR 2025-017', bank: 'Canara Bank',
      branch: 'Patna Main Branch', ifsc: 'CNRB0001234', amount: 3000000,
      issueDate: addDays(-800), maturityDate: addDays(120),
      jointNames: joint(byId['INST-005'], 'Chairman, Nalanda Shiksha Trust'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 3000000, maturityDate: addDays(120), holder: 'Nalanda Shiksha Trust & AICTE', checkedAt: stamp(30, 11, 40), reference: 'BV-8899' },
      docs: docs([[D.fdr('FDR 2025-017'), 'FDR Copy', 800], [D.bank('FDR 2025-017'), 'Bank Confirmation', 30], [D.trust('Nalanda Shiksha Trust'), 'Trust Resolution', 799]]),
      submittedAt: stamp(803, 9, 10)
    }),
    mk({
      id: 'FDR-2026-002', instId: 'INST-006', fdrNumber: 'FDR 2026-002', bank: 'Federal Bank',
      branch: 'Marine Drive Branch', ifsc: 'FDRL0001234', amount: 1200000,
      issueDate: addDays(-300), maturityDate: addDays(200),
      jointNames: joint(byId['INST-006'], 'Chairman, Cochin Applied Sciences Trust'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 1000000, maturityDate: addDays(200), holder: 'Cochin Applied Sciences Trust & AICTE', checkedAt: stamp(20, 16, 15), reference: 'BV-8871' },
      docs: docs([[D.fdr('FDR 2026-002'), 'FDR Copy', 300], [D.bank('FDR 2026-002'), 'Bank Confirmation', 20]]),
      submittedAt: stamp(303, 10, 55)
    }),
    mk({
      id: 'FDR-2024-006', instId: 'INST-007', fdrNumber: '-', bank: '-', branch: '-', ifsc: '-', amount: 0,
      issueDate: addDays(-900), maturityDate: addDays(2750),
      jointNames: [], status: 'Exempt', verification: 'Exempt',
      docs: [], submittedAt: stamp(901, 10, 0),
      note: 'Exempted category - Govt./aided institution. No security deposit required as per applicable provisions. Exemption reference: AICTE/RO/WR/EXM/2024/118.'
    }),
    mk({
      id: 'FDR-2026-028', instId: 'INST-008', fdrNumber: 'FDR 2026-028', bank: 'Union Bank of India',
      branch: 'Bhopal Main Branch', ifsc: 'UBIN0543210', amount: 1800000,
      issueDate: addDays(-260), maturityDate: addDays(60),
      jointNames: joint(byId['INST-008'], 'Chairman, Vidya Shiksha Samiti'),
      status: 'Active', verification: 'Self-declared',
      docs: docs([[D.fdr('FDR 2026-028'), 'FDR Copy', 260], [D.bank('FDR 2026-028'), 'Bank Confirmation', 220]]),
      submittedAt: stamp(262, 11, 25)
    }),
    mk({
      id: 'FDR-2026-035', instId: 'INST-009', fdrNumber: 'FDR 2026-035', bank: 'Axis Bank',
      branch: 'Hazratganj Branch', ifsc: 'UTIB0001234', amount: 2200000,
      issueDate: addDays(-180), maturityDate: addDays(15),
      jointNames: ['Secretary, Aryavart Shiksha Samiti'],
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 2200000, maturityDate: addDays(15), holder: 'Aryavart Shiksha Samiti', checkedAt: stamp(40, 13, 5), reference: 'BV-8802' },
      docs: docs([[D.fdr('FDR 2026-035'), 'FDR Copy', 180], [D.bank('FDR 2026-035'), 'Bank Confirmation', 40], [D.trust('Aryavart Shiksha Samiti'), 'Trust Resolution', 179]]),
      submittedAt: stamp(183, 10, 40)
    }),
    mk({
      id: 'FDR-2026-044', instId: 'INST-010', fdrNumber: 'FDR 2026-044', bank: 'Kotak Mahindra Bank',
      branch: 'Bhubaneswar Branch', ifsc: 'KKBK0001234', amount: 1500000,
      issueDate: addDays(-90), maturityDate: addDays(330),
      jointNames: joint(byId['INST-010'], 'Chairman, Kalinga Education Trust'),
      status: 'Pending Verification', verification: 'Self-declared',
      docs: docs([[D.fdr('FDR 2026-044'), 'FDR Copy', 90], [D.bank('FDR 2026-044'), 'Bank Confirmation', 2]]),
      submittedAt: stamp(2, 12, 5)
    }),
    mk({
      id: 'FDR-2026-045', instId: 'INST-004', fdrNumber: 'FDR 2026-045', bank: 'Indian Bank',
      branch: 'Jaipur Branch', ifsc: 'IDIB0001234', amount: 1500000,
      issueDate: addDays(-400), maturityDate: addDays(7),
      jointNames: joint(byId['INST-004'], 'Chairman, Bharat Shiksha Samiti'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 1500000, maturityDate: addDays(7), holder: 'Bharat Shiksha Samiti & AICTE', checkedAt: stamp(50, 10, 30), reference: 'BV-8775' },
      docs: docs([[D.fdr('FDR 2026-045'), 'FDR Copy', 400], [D.bank('FDR 2026-045'), 'Bank Confirmation', 50], [D.trust('Bharat Shiksha Samiti'), 'Trust Resolution', 399]]),
      submittedAt: stamp(402, 9, 55),
      release: release({
        requestedAt: stamp(3, 14, 20),
        reason: 'Deposit no longer required - institution not admitting new batch',
        note: 'Requesting release of the joint FDR after completion of the current academic session.',
        docs: [
          { name: 'Release request letter - Bharat College.pdf', type: 'Request Letter', uploadedAt: stamp(3, 14, 20) }
        ]
      })
    }),
    mk({
      id: 'FDR-2026-046', instId: 'INST-002', fdrNumber: 'FDR 2026-046', bank: 'Bank of India',
      branch: 'Nagpur Branch', ifsc: 'BKID0001234', amount: 2000000,
      issueDate: addDays(-380), maturityDate: addDays(90),
      jointNames: joint(byId['INST-002'], 'President, Greenfield Education Society'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 2000000, maturityDate: addDays(90), holder: 'Greenfield Education Society & AICTE', checkedAt: stamp(30, 11, 15), reference: 'BV-8830' },
      docs: docs([[D.fdr('FDR 2026-046'), 'FDR Copy', 380], [D.bank('FDR 2026-046'), 'Bank Confirmation', 30], [D.trust('Greenfield Education Society'), 'Trust Resolution', 379]]),
      submittedAt: stamp(382, 10, 5),
      release: release({
        requestedAt: stamp(9, 10, 15),
        reason: 'Replacement of instrument with a fresh FDR',
        note: 'Existing instrument to be replaced by a fresh 10-year FDR from the same branch.',
        docs: [
          { name: 'Release request letter - Greenfield.pdf', type: 'Request Letter', uploadedAt: stamp(9, 10, 15) },
          { name: 'Affidavit - Greenfield.pdf', type: 'Affidavit', uploadedAt: stamp(9, 10, 15) },
          { name: 'FDR copy - 2026-046.pdf', type: 'FDR Copy', uploadedAt: stamp(9, 10, 15) }
        ],
        ro: { at: stamp(5, 15, 40), by: 'R. K. Sharma', note: 'Institution records and original FDR copy verified. Forwarded for Bureau clearance.' }
      })
    }),
    mk({
      id: 'FDR-2023-011', instId: 'INST-005', fdrNumber: 'FDR 2023-011', bank: 'State Bank of India',
      branch: 'Patna Branch', ifsc: 'SBIN0009876', amount: 3000000,
      issueDate: addDays(-1500), maturityDate: addDays(-200),
      jointNames: joint(byId['INST-005'], 'Chairman, Nalanda Shiksha Trust'),
      status: 'Released', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 3000000, maturityDate: addDays(-200), holder: 'Nalanda Shiksha Trust & AICTE', checkedAt: stamp(600, 12, 0), reference: 'BV-8200' },
      docs: docs([[D.fdr('FDR 2023-011'), 'FDR Copy', 1500], [D.bank('FDR 2023-011'), 'Bank Confirmation', 600], [D.trust('Nalanda Shiksha Trust'), 'Trust Resolution', 1499]]),
      submittedAt: stamp(1503, 11, 45),
      release: release({
        requestedAt: stamp(120, 10, 0),
        reason: 'Deposit no longer required - course closure',
        note: 'All prescribed clearances obtained; FDR released to the joint holders.',
        docs: [
          { name: 'Release request letter - Nalanda.pdf', type: 'Request Letter', uploadedAt: stamp(120, 10, 0) },
          { name: 'Affidavit - Nalanda.pdf', type: 'Affidavit', uploadedAt: stamp(120, 10, 0) },
          { name: 'FDR copy - 2023-011.pdf', type: 'FDR Copy', uploadedAt: stamp(120, 10, 0) }
        ],
        ro: { at: stamp(110, 11, 30), by: 'R. K. Sharma', note: 'Eligibility and documents verified.' },
        approval: { at: stamp(95, 15, 10), by: 'S. Nair', note: 'No pending approval dues against the institution.' },
        grievance: { at: stamp(80, 12, 45), by: 'P. Menon', note: 'No grievance pending.' },
        vigilance: { at: stamp(60, 16, 20), by: 'D. Chaturvedi', note: 'No vigilance case pending.' },
        nocAt: stamp(40, 10, 30), nocRef: 'AICTE/RO/ER/NOC/2026/0214',
        releasedAt: stamp(30, 11, 0)
      })
    }),
    mk({
      id: 'FDR-2025-022', instId: 'INST-006', fdrNumber: 'FDR 2025-022', bank: 'South Indian Bank',
      branch: 'Kochi Branch', ifsc: 'SIBL0000123', amount: 1200000,
      issueDate: addDays(-600), maturityDate: addDays(-40),
      jointNames: joint(byId['INST-006'], 'Chairman, Cochin Applied Sciences Trust'),
      status: 'Renewed', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 1200000, maturityDate: addDays(-40), holder: 'Cochin Applied Sciences Trust & AICTE', checkedAt: stamp(200, 10, 10), reference: 'BV-8500' },
      docs: docs([[D.fdr('FDR 2025-022'), 'FDR Copy', 600], [D.bank('FDR 2025-022'), 'Bank Confirmation', 200]]),
      submittedAt: stamp(603, 10, 25),
      renewalTo: 'FDR-2026-051',
      note: 'Matured instrument renewed. Replacement instrument: FDR-2026-051 (same bank, same amount).'
    }),
    mk({
      id: 'FDR-2026-051', instId: 'INST-006', fdrNumber: 'FDR 2026-051', bank: 'South Indian Bank',
      branch: 'Kochi Branch', ifsc: 'SIBL0000456', amount: 1200000,
      issueDate: addDays(-40), maturityDate: addDays(325),
      jointNames: joint(byId['INST-006'], 'Chairman, Cochin Applied Sciences Trust'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 1200000, maturityDate: addDays(325), holder: 'Cochin Applied Sciences Trust & AICTE', checkedAt: stamp(35, 11, 0), reference: 'BV-8878' },
      docs: docs([[D.fdr('FDR 2026-051'), 'FDR Copy', 40], [D.bank('FDR 2026-051'), 'Bank Confirmation', 35], [D.trust('Cochin Applied Sciences Trust'), 'Trust Resolution', 39]]),
      submittedAt: stamp(41, 9, 35),
      renewalOf: 'FDR-2025-022',
      note: 'Renewal of FDR-2025-022. Maturity extended by one year; bank confirmation on record.'
    }),
    mk({
      id: 'FDR-2025-031', instId: 'INST-008', fdrNumber: 'FDR 2025-031', bank: 'Central Bank of India',
      branch: 'Bhopal Branch', ifsc: 'CBIN0001234', amount: 1800000,
      issueDate: addDays(-500), maturityDate: addDays(40),
      jointNames: joint(byId['INST-008'], 'Chairman, Vidya Shiksha Samiti'),
      status: 'Active', verification: 'Self-declared',
      docs: docs([[D.fdr('FDR 2025-031'), 'FDR Copy', 500]]),
      submittedAt: stamp(503, 12, 40)
    }),
    mk({
      id: 'FDR-2026-047', instId: 'INST-003', fdrNumber: 'FDR 2026-047', bank: 'State Bank of India',
      branch: 'Hyderabad Main Branch', ifsc: 'SBIN0004321', amount: 4000000,
      issueDate: addDays(-120), maturityDate: addDays(400),
      jointNames: joint(byId['INST-003'], 'Chairman, Deccan Education Trust'),
      status: 'Pending Verification', verification: 'Self-declared',
      docs: docs([[D.fdr('FDR 2026-047'), 'FDR Copy', 120]]),
      submittedAt: stamp(9, 10, 50)
    }),
    mk({
      id: 'FDR-2026-048', instId: 'INST-009', fdrNumber: 'FDR 2026-048', bank: 'HDFC Bank',
      branch: 'Gomti Nagar Branch', ifsc: 'HDFC0000789', amount: 2200000,
      issueDate: addDays(-150), maturityDate: addDays(12),
      jointNames: joint(byId['INST-009'], 'Secretary, Aryavart Shiksha Samiti'),
      status: 'Active', verification: 'Bank-confirmed',
      bankConfirmed: { amount: 2200000, maturityDate: addDays(12), holder: 'Aryavart Shiksha Samiti & AICTE', checkedAt: stamp(10, 15, 30), reference: 'BV-8891' },
      docs: docs([[D.fdr('FDR 2026-048'), 'FDR Copy', 150], [D.bank('FDR 2026-048'), 'Bank Confirmation', 10], [D.trust('Aryavart Shiksha Samiti'), 'Trust Resolution', 149]]),
      submittedAt: stamp(153, 9, 20)
    }),
    mk({
      id: 'FDR-2026-049', instId: 'INST-010', fdrNumber: 'FDR 2026-049', bank: 'ICICI Bank',
      branch: 'Bhubaneswar Branch', ifsc: 'ICI0000456', amount: 1500000,
      issueDate: addDays(-60), maturityDate: addDays(280),
      jointNames: joint(byId['INST-010'], 'Chairman, Kalinga Education Trust'),
      status: 'Pending Verification', verification: 'Self-declared',
      docs: docs([[D.fdr('FDR 2026-049'), 'FDR Copy', 60]]),
      submittedAt: stamp(1, 16, 10)
    }),
    mk({
      id: 'FDR-2026-050', instId: 'INST-004', fdrNumber: 'FDR 2026-050', bank: 'State Bank of India',
      branch: 'Jaipur Branch', ifsc: 'SBIN0003456', amount: 1000000,
      issueDate: addDays(-100), maturityDate: addDays(250),
      jointNames: joint(byId['INST-004'], 'Chairman, Bharat Shiksha Samiti'),
      status: 'Pending Verification', verification: 'Self-declared',
      docs: docs([[D.fdr('FDR 2026-050'), 'FDR Copy', 100], [D.bank('FDR 2026-050'), 'Bank Confirmation', 4]]),
      submittedAt: stamp(4, 13, 15)
    })
  ];

  /* ---------------- Audit trail (seeded) ---------------- */
  var audit = [];
  var seq = 0;

  function A(inst, atISO, actor, role, action, detail) {
    seq += 1;
    audit.push({
      id: 'AUD-' + String(seq).padStart(4, '0'),
      at: atISO,
      actor: actor,
      role: role,
      action: action,
      targetId: inst.id,
      targetLabel: inst.fdrNumber,
      detail: detail
    });
  }

  instruments.forEach(function (inst) {
    var institution = byId[inst.instId];
    var who = institution.contact.split(' · ')[0];

    if (inst.status === 'Exempt') {
      A(inst, inst.submittedAt, who, 'institution', 'Exemption recorded', 'Govt./aided institution marked exempt from security deposit. Reference: AICTE/RO/WR/EXM/2024/118.');
      return;
    }

    A(inst, inst.submittedAt, who, 'institution', 'FDR submitted', 'Instrument submitted through the institution portal. Source: self-declared.');
    A(inst, inst.submittedAt, 'System', 'system', 'Discrepancy scan completed', 'Automated validation of mandatory fields and documents triggered on submission.');

    if (inst.bankConfirmed) {
      A(inst, inst.bankConfirmed.checkedAt, 'Bank verification service', 'system', 'Bank verification completed',
        'Simulated bank response received (' + inst.bankConfirmed.reference + '). Amount and maturity matched against submission.');
    }

    if (inst.verification === 'Self-declared' && inst.status !== 'Exempt') {
      A(inst, stamp(Math.max(1, diffDays(inst.submittedAt, todayISO())), 9, 0), 'System', 'system', 'Verification reminder sent',
        'Automated reminder: bank confirmation pending for this instrument.');
    }

    if (inst.status === 'Renewed' && inst.renewalTo) {
      A(inst, stamp(40, 10, 45), 'System', 'system', 'Renewal linked', 'Matured instrument marked renewed. Replacement instrument: ' + inst.renewalTo + '.');
    }

    var r = inst.release;
    if (!r) return;

    A(inst, r.requestedAt, who, 'institution', 'Release request submitted',
      'Reason: ' + r.reason + '. Documents attached: ' + (r.docs.length ? r.docs.map(function (d) { return d.type; }).join(', ') : 'none') + '.');

    var steps = [
      ['ro', 'Regional Office clearance', 'Regional Officer'],
      ['approval', 'Approval Bureau clearance', 'Approval Bureau'],
      ['grievance', 'Grievance Cell clearance', 'Grievance Cell'],
      ['vigilance', 'Vigilance Cell clearance', 'Vigilance Cell']
    ];
    steps.forEach(function (s) {
      var c = r[s[0]];
      if (c) A(inst, c.at, c.by, s[0] === 'ro' ? 'regional' : s[0], s[1], c.note || 'Cleared.');
    });
    if (r.nocAt) A(inst, r.nocAt, 'R. K. Sharma', 'regional', 'NOC issued', 'No-objection certificate issued: ' + r.nocRef + '.');
    if (r.releasedAt) A(inst, r.releasedAt, 'R. K. Sharma', 'regional', 'Deposit released', 'FDR released to the joint holders after all prescribed clearances.');
  });

  audit.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });

  function buildSeed() {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      institutions: JSON.parse(JSON.stringify(INSTITUTIONS)),
      instruments: JSON.parse(JSON.stringify(instruments)),
      audit: JSON.parse(JSON.stringify(audit))
    };
  }

  window.FDRVaultData = {
    buildSeed: buildSeed,
    addDays: addDays,
    todayISO: todayISO,
    diffDays: diffDays,
    stamp: stamp
  };
})();
