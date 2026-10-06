/* ProcessGrit demo engine, synthetic records, gate evaluation, actions, KPIs, SPC, imports, acceptance tests. */
(function () {
  if (window.PG) return;
  const KEY = 'pg-app-v2b';
  const clone = o => JSON.parse(JSON.stringify(o));
  const iso = d => (d || new Date()).toISOString();
  const pad = (n, w) => String(n).padStart(w, '0');
  const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6); }
  function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function gauss(r) { const u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const BASE_DATE = new Date('2026-10-05T09:00:00+05:30');
  const fmtT = s => { if (!s) return 'None'; const d = new Date(s); return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const fmtD = s => { if (!s) return 'None'; return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };

  const USERS = {
    anika: { id: 'anika', name: 'Anika Rao', roles: ['eng'], title: 'Process engineer' },
    kiran: { id: 'kiran', name: 'Kiran Patel', roles: ['eng', 'qa'], title: 'Process engineer · QA delegate' },
    daniel: { id: 'daniel', name: 'Daniel Cho', roles: ['qa'], title: 'QA lead' },
    ravi: { id: 'ravi', name: 'Ravi Menon', roles: ['operator'], title: 'Line operator' },
    lena: { id: 'lena', name: 'Lena Ortiz', roles: ['customer'], customer: 'CUST-A', title: 'Customer approver · Customer A' },
    tom: { id: 'tom', name: 'Tom Reyes', roles: ['customer'], customer: 'CUST-B', title: 'Customer approver · Customer B' },
    marta: { id: 'marta', name: 'Marta Silva', roles: ['mgmt'], title: 'Plant manager (read only)' },
    sam: { id: 'sam', name: 'Sam Ito', roles: ['admin'], title: 'Administrator' }
  };
  const ROLE_LBL = { eng: 'Process engineer', qa: 'QA', operator: 'Operator', customer: 'Customer approver', mgmt: 'Management', admin: 'Administrator' };
  const PERMS = {
    operator: ['scan', 'enter', 'check', 'capture', 'rework.exec', 'import.results'],
    eng: ['ctq.edit', 'conflict.resolve', 'query.raise', 'program.change', 'sign.eng', 'coverage.validate', 'ncr.create', 'ncr.edit', 'limits.propose', 'baseline.freeze', 'rework.instruct', 'pred.ack', 'impact.review', 'concession.request', 'testplan.upload', 'spc.annotate'],
    qa: ['sign.qa', 'hold', 'hold.release', 'disposition', 'release', 'concession.approve', 'na.approve', 'effect.review', 'capa.close', 'ncr.create', 'ncr.edit', 'hyp.validate', 'report.approve', 'pred.ack', 'limits.approve', 'verify.setup', 'spc.annotate'],
    customer: ['sign.cust'],
    mgmt: [],
    admin: ['import', 'config', 'reset', 'roles']
  };
  const SCREENS = [
    { id: 'command', group: 'Overview', name: 'Command centre', icon: 'grid' },
    { id: 'eng', group: 'Prevent', name: 'Engineering & CTQs', icon: 'file' },
    { id: 'fa', group: 'Prevent', name: 'First article', icon: 'check' },
    { id: 'prod', group: 'Monitor', name: 'Production board', icon: 'layers' },
    { id: 'spc', group: 'Monitor', name: 'SPC & defects', icon: 'chart' },
    { id: 'pred', group: 'Monitor', name: 'Predictive insights', icon: 'spark' },
    { id: 'trace', group: 'Respond', name: 'Traceability', icon: 'tree' },
    { id: 'ncr', group: 'Respond', name: 'NCR & 8D', icon: 'alert' },
    { id: 'release', group: 'Respond', name: 'Release & reports', icon: 'ship' },
    { id: 'data', group: 'Platform', name: 'Data & configuration', icon: 'db' },
    { id: 'at', group: 'Platform', name: 'Acceptance tests', icon: 'flask' }
  ];
  const SCEN = {
    A: { id: 'A', name: 'Prevent before batch', order: 'WO-24817', customer: 'CUST-A', home: 'eng' },
    B: { id: 'B', name: 'Reconstruct the escape', order: 'WO-23602', customer: 'CUST-A', home: 'trace' },
    C: { id: 'C', name: 'Drift before defect', order: 'WO-24790', customer: 'CUST-A', home: 'spc' },
    D: { id: 'D', name: 'Test coverage gap', order: 'WO-24831', customer: 'CUST-B', home: 'fa' },
    E: { id: 'E', name: 'Effectiveness', order: 'WO-24655', customer: 'CUST-A', home: 'ncr' },
    F: { id: 'F', name: 'Data integrity', order: 'WO-24702', customer: 'CUST-A', home: 'data' }
  };
  const CUSTOMER_VIEW = ['command', 'fa', 'release'];
  const GATECOL = { setup: 'Setup scan', fa: 'FA independent check', spi: 'SPI', aoi: 'AOI post-reflow', xray: 'X-ray', dip: 'Post-DIP inspection', ft: 'Functional test' };
  const APPR_LBL = { eng: 'Engineering', qa: 'QA', cust: 'Customer' };

  /* ---------- seeds ---------- */
  function seedA() {
    return {
      order: { id: 'WO-24817', customer: 'CUST-A', customerName: 'Customer A', product: 'MB-7420', rev: 'C', qty: 1200, line: 'SMT-L2', route: 'R-MB-A v3', released: false, inProduction: false },
      prog: { bom: { id: 'BOM-MB-A', rev: 'C', hash: 'b71e2c' }, placement: { id: 'PLC-MB-A', rev: 'r6', hash: '4d09aa' }, aoi: { id: 'AOI-MB-A', rev: 'v4', hash: '9c3f10' }, profile: { id: 'PRF-MB-A', rev: '2', hash: 'e5a771' }, test: { id: 'TP-MB-A', rev: '1.2', hash: '71bd03' } },
      conflict: { status: 'open', query: null, resolution: null },
      cov: { aoiPin1: false, challenge: null },
      setup: { slot14: 'wrong', machineProg: 'r6', loadedBy: null, verified: null, initial: null },
      fa: { serial: 'MB-A-FA01', photo: null, results: null, approvals: { eng: null, qa: null, cust: null }, superseded: [], submittedAt: null, approvedAt: null, rerun: 0 },
      impacts: [], holds: [], ncrs: [], releaseHistory: [], attempts: []
    };
  }
  function seedB(now) {
    return {
      order: { id: 'WO-23602', customer: 'CUST-A', customerName: 'Customer A', product: 'MB-7420', rev: 'B', qty: 1200, line: 'SMT-L2', route: 'R-MB-A v2 (historical)' },
      complaint: { id: 'CMP-0017', serial: 'MB-A-1437', received: now, text: 'Board fails to boot in customer system test. Return analysis: U3 rotated 180° (observed PIN1-SE, expected PIN1-NW).', confirmed: true },
      detectedAt: now, query: { type: 'incident', value: 'CMP-0017' }, selSerial: 'MB-A-1437',
      holds: [], manifest: null, containedAt: null, holdAt: null, recall: null,
      hyps: [
        { id: 'OH-1', kind: 'occurrence', text: 'Orientation interpreted from assembly drawing; centroid rotation not mapped to machine convention', status: 'hypothesis', evidence: 'PLC-MB-A r5 rotation 0°; ASM rev B Pin 1 NW' },
        { id: 'OH-2', kind: 'occurrence', text: 'Feeder loaded with tray in rotated orientation', status: 'hypothesis', evidence: 'No tray orientation record (Unknown)' },
        { id: 'EH-1', kind: 'escape', text: 'AOI program v3 had no Pin 1 polarity feature for U3', status: 'hypothesis', evidence: 'AOI-MB-A v3 feature list (EVD-221)' },
        { id: 'EH-2', kind: 'escape', text: 'First-article golden board carried the same wrong orientation', status: 'hypothesis', evidence: 'FA report has signatures but no U3 photo (EVD-219)' },
        { id: 'EH-3', kind: 'escape', text: 'Functional test TP-MB-A 1.0 does not exercise U3', status: 'hypothesis', evidence: 'Test case list FT-01…FT-11 (EVD-224)' },
        { id: 'EH-4', kind: 'escape', text: 'Release checklist overridden with 2 boards missing AOI records', status: 'hypothesis', evidence: 'REL-2201 override note (EVD-230)' }
      ],
      aiDraft: null
    };
  }
  function seedC() {
    return {
      order: { id: 'WO-24790', customer: 'CUST-A', customerName: 'Customer A', product: 'MB-7420', rev: 'C', qty: 200, line: 'SMT-L2', lot: 'LOT-D-01', route: 'R-MB-A v3' },
      spc: { frozen: { by: 'anika', at: '2026-09-28T08:00:00+05:30', n: 40 }, annotations: [{ i: 44, text: 'Paste lot SP-2291 opened', by: 'Ravi Menon' }], ack: null },
      xray0117: false,
      rework: { serial: 'MB-C-0042', step: 4, steps: [
        { k: 'Failed board', who: 'FT-02 auto', at: '2026-10-04T10:02:00+05:30', note: 'FT-12 USB enumeration fail (first attempt preserved)' },
        { k: 'NCR and hold', who: 'Daniel Cho', at: '2026-10-04T10:20:00+05:30', note: 'NCR-C-014 · hold H-C-014 on MB-C-0042' },
        { k: 'Rework instruction', who: 'Anika Rao', at: '2026-10-04T11:05:00+05:30', note: 'RWI-088: reflow J5 USB connector, inspect U7 corner joints' },
        { k: 'Technician execution', who: 'Ravi Menon', at: '2026-10-04T13:40:00+05:30', note: 'Attempt 1 completed; hot-air station HA-02' },
        { k: 'Repeat inspection and test', who: null, at: null, note: '' },
        { k: 'Independent disposition', who: null, at: null, note: '' }
      ] },
      dispatch: null, attempts: [], pred: { ack: {}, assigned: {} }
    };
  }
  function seedD(now) {
    const d = {
      order: { id: 'WO-24831', customer: 'CUST-B', customerName: 'Customer B', product: 'MB-5110', rev: 'A', qty: 300, line: 'SMT-L1', route: 'R-MB-B v2', released: false },
      prog: { bom: { id: 'BOM-MB-B', rev: 'A', hash: '0c4471' }, placement: { id: 'PLC-MB-B', rev: 'r3', hash: '51ae02' }, aoi: { id: 'AOI-MB-B', rev: 'v2', hash: 'd2b8e9' }, profile: { id: 'PRF-MB-B', rev: '1', hash: '3f0c55' }, test: { id: 'TP-MB-B', rev: 'none', hash: '000000' } },
      testPlan: null, ftResults: null, concession: null, naAttempts: [],
      fa: { serial: 'MB-B-FA01', photo: { mode: 'asPlaced', by: 'ravi', at: now }, results: { at: now }, approvals: { eng: null, qa: null, cust: null }, superseded: [], submittedAt: now, rerun: 0 },
      holds: [], releaseHistory: [], attempts: []
    };
    d.fa.approvals.eng = { by: 'anika', at: now, hash: snapOf(d.prog) };
    return d;
  }
  function seedE() {
    return {
      order: { id: 'WO-24655', customer: 'CUST-A', customerName: 'Customer A', product: 'MB-7420', rev: 'C', qty: 600, line: 'SMT-L2 / SMT-L3', route: 'R-MB-A v3' },
      lots: [
        { id: 'LOT-V-01', boards: 200, checks: 200, fails: 0, evidence: 200, shifts: 'A, B', setup: 'SET-1102 · SMT-L2', bypass: 0, dates: '21 to 22 Sep 2026' },
        { id: 'LOT-V-02', boards: 200, checks: 200, fails: 0, evidence: 200, shifts: 'B, C', setup: 'SET-1107 · SMT-L3', bypass: 0, dates: '25 to 26 Sep 2026' },
        { id: 'LOT-V-03', boards: 200, checks: 200, fails: 0, evidence: 200, shifts: 'C, A', setup: 'SET-1102 · SMT-L2 after changeover', bypass: 0, dates: '30 Sep to 1 Oct 2026' }
      ],
      capa: {
        id: 'CAPA-U3-001', ncr: 'NCR-U3-001',
        actions: [
          { id: 'CA-1', kind: 'Occurrence', text: 'Orientation mapping corrected; CTQ-U3-ORI rev 2 approved', owner: 'anika', status: 'Implemented', evidence: 'PLC-MB-A r7 · REF-U3-0007' },
          { id: 'CA-2', kind: 'Escape', text: 'AOI Pin 1 polarity feature added; challenge set CH-U3-ORI-01 detected 12 / 12', owner: 'kiran', status: 'Implemented', evidence: 'AOI-MB-A v5 · CH-U3-ORI-01' },
          { id: 'CA-3', kind: 'Escape', text: 'Functional case FT-19 added: U3 address read-back', owner: 'anika', status: 'Implemented', evidence: 'TP-MB-A 1.3' },
          { id: 'CA-4', kind: 'System', text: 'PFMEA PF-MB-A rev 6, control plan CP-MB-A rev 4, operator training TR-221', owner: 'anika', status: 'Implemented', evidence: 'DOC-PF-6 · DOC-CP-4 · TR-221' },
          { id: 'CA-5', kind: 'Horizontal', text: 'Applicability review of similar QFN parts: U9, U12 on MB-7420; U4 on MB-5110', owner: 'anika', status: 'Implemented', evidence: 'HR-031' }
        ],
        agreed: null, review: null, recurrence: false, reopened: false, closed: null
      }
    };
  }
  function seedF() {
    return {
      order: { id: 'WO-24702', customer: 'CUST-A', customerName: 'Customer A', product: 'MB-7420', rev: 'C', qty: 200, lot: 'LOT-F-01', route: 'R-MB-A v3' },
      events: {}, baseValid: 1248, expected: 1280, imports: [], quarantine: [], review: [], incidents: [], holds: [], late: 0, preview: null,
      shipment: { id: 'SHP-3101', qty: 200, serials: 'MB-F-0001 … MB-F-0200', history: [
        { at: '2026-10-03T16:40:00+05:30', event: 'Released for dispatch · dossier 22 / 22 items', by: 'Daniel Cho' },
        { at: '2026-10-04T08:15:00+05:30', event: 'Dispatched to Customer A', by: 'Logistics' }
      ], exposure: null }
    };
  }
  function seed() {
    const now = iso();
    return {
      v: 1, persona: 'anika', scen: 'A', screen: 'command', guide: { on: false, step: 0 }, clock: 0, seq: 100, audit: [],
      A: seedA(), B: seedB(now), C: seedC(), D: seedD(now), E: seedE(), F: seedF(),
      config: {
        dipYes: 'insertion', aoiPos: 'post-reflow', mixedShipment: 'exclude', level: 1,
        limits: [
          { id: 'L-PASTE', param: 'Paste volume · U7 pads', lsl: 85, usl: 115, unit: '%', rev: 3, by: 'Anika Rao', pending: null },
          { id: 'L-PEAK', param: 'Reflow measured peak', lsl: 238, usl: 248, unit: '°C', rev: 2, by: 'Anika Rao', pending: null },
          { id: 'L-TAL', param: 'Time above liquidus', lsl: 45, usl: 75, unit: 's', rev: 2, by: 'Anika Rao', pending: null }
        ]
      }
    };
  }
  function snapOf(prog) { return hash(Object.values(prog).map(p => p.id + p.rev + p.hash).join('|')); }

  /* ---------- helpers ---------- */
  const can = (u, p) => !!u && u.roles.some(r => (PERMS[r] || []).includes(p));
  const roleTxt = u => u.roles.map(r => ROLE_LBL[r]).join(' + ');
  const ok = (msg, extra) => Object.assign({ ok: true, msg }, extra || {});
  const E = (m, extra) => Object.assign({ ok: false, error: m }, extra || {});
  const deny = (u, what) => E(`Access denied: ${u.name} (${roleTxt(u)}) cannot ${what}.`, { code: 403 });
  function log(st, u, action, scen, detail, rejected, before, after) {
    st.audit.push({ n: st.audit.length + 1, t: iso(), actor: u ? u.name : 'System', role: u ? roleTxt(u) : 'System', action, scen: scen || '', detail: detail || '', rejected: !!rejected, before: before || '', after: after || '' });
  }
  const demoDate = st => new Date(BASE_DATE.getTime() + st.clock * 86400000);
  const addDays = (st, n) => iso(new Date(demoDate(st).getTime() + n * 86400000));
  const uname = id => (USERS[id] ? USERS[id].name : id || 'None');

  /* ---------- A + D product logic ---------- */
  function u3Fields(a) {
    const r = a.conflict.status === 'resolved';
    return [
      ['Product revision', 'MB-7420 rev C'], ['RefDes', 'U3'], ['Manufacturer part / package', 'PMIC-Q32-A · QFN-32 5×5 (synthetic)'],
      ['Package drawing revision', 'PKG-U3 rev 3'], ['Viewing convention', 'Top view; board datum lower-left'], ['Footprint Pin 1', 'Pad 1 at footprint origin'],
      ['Board datum', 'Fiducial FID1, lower-left'], ['Source rotation (centroid)', '0°'],
      ['Machine rotation mapping', r ? 'Centroid 0° → machine 180° (machine origin Pin-1-SW, CCW)' : ''],
      ['Expected Pin 1 location', r ? 'PIN1-NW (synthetic board-datum label)' : ''],
      ['Reference image', r ? 'REF-U3-0007 (approved)' : ''],
      ['Evidence method', 'FA independent visual vs approved source; AOI post-reflow polarity feature'],
      ['Check frequency', 'Every first article; 100% AOI per board'], ['Applicability', 'All MB-7420 rev C orders'],
      ['Engineering owner', 'Anika Rao'], ['Approvers', 'Engineering and QA (distinct users)'],
      ['Reaction plan', 'Critical NCR; block release; identify units since last verified conforming check; independent inspection']
    ];
  }
  const CTQ_A = [
    { id: 'CTQ-U3-ORI', feat: 'U3 Pin 1 / orientation', fm: 'Wrong orientation', type: 'Categorical', limits: 'Expected PIN1-NW', method: 'FA independent visual + AOI polarity', freq: 'FA; 100% AOI', critical: true, src: 'PKG-U3 rev 3 §2 fig. 1' },
    { id: 'CTQ-BOM-MPN', feat: 'BOM / MPN match', fm: 'Wrong part', type: 'Categorical', limits: 'BOM-MB-A rev C', method: 'Reel / feeder scan', freq: 'Each setup and reload', critical: true, src: 'BOM-MB-A rev C' },
    { id: 'CTQ-C12-POL', feat: 'C12 polarity', fm: 'Reversed polarity', type: 'Categorical', limits: '+ toward J1', method: 'AOI polarity', freq: '100% AOI', critical: true, src: 'ASM-MB-A rev B sh. 2' },
    { id: 'CTQ-U7-BGA', feat: 'U7 hidden joints', fm: 'Hidden solder open', type: 'Categorical + void %', limits: 'Contracted criteria CS-14 §4', method: 'X-ray, all hidden joints', freq: '100% applicable boards', critical: true, src: 'Customer spec CS-14 §4' },
    { id: 'CTQ-PASTE-U7', feat: 'Paste volume, U7 pads', fm: 'Insufficient / excess paste', type: 'Numeric %', limits: '85 to 115 % (synthetic)', method: 'SPI', freq: '100% panels', critical: false, src: 'Stencil ST-MB-A r2' },
    { id: 'CTQ-RFL-PK', feat: 'Reflow peak / TAL', fm: 'Thermal excursion', type: 'Numeric °C, s', limits: '238 to 248 °C; 45 to 75 s (synthetic)', method: 'Profiler run', freq: 'Each shift + changeover', critical: false, src: 'PRF-MB-A rev 2' },
    { id: 'CTQ-J1-THT', feat: 'J1 seating / joint', fm: 'Lifted part / poor joint', type: 'Categorical', limits: 'Contracted acceptance class', method: 'Post-DIP inspection', freq: '100%', critical: true, src: 'ASM-MB-A rev B sh. 3' },
    { id: 'CTQ-FW', feat: 'Firmware version / hash', fm: 'Wrong firmware', type: 'Categorical', limits: 'FW 2.4.1 · 0x5be1… (synthetic)', method: 'Programming verify', freq: '100%', critical: true, src: 'TP-MB-A 1.2 §3' },
    { id: 'CTQ-FT', feat: 'Functional sequence', fm: 'Incomplete function', type: 'Test cases', limits: 'TP-MB-A 1.2 FT-01…FT-18', method: 'Functional test', freq: '100%', critical: true, src: 'TP-MB-A 1.2' },
    { id: 'CTQ-CLEAN', feat: 'Ionic cleanliness', fm: 'Residue', type: 'Numeric', limits: 'None', method: 'None', freq: 'None', critical: false, src: 'Route R-MB-A v3', na: 'No-clean flux route; cleaning not in R-MB-A v3 · approved Daniel Cho' }
  ];
  function ctqs(st, sc) {
    if (sc === 'D') {
      const d = st.D, tp = !!d.testPlan;
      return [
        { id: 'CTQ-B-APPEAR', feat: 'Appearance / workmanship', fm: 'Visible defect', type: 'Categorical', limits: 'Contracted acceptance class', method: 'Visual', freq: 'FA + 100%', critical: false, src: 'Customer B PO §6', complete: true, missing: [] },
        { id: 'CTQ-B-SOLDER', feat: 'Visible solder joints', fm: 'Bridge / insufficient', type: 'Categorical', limits: 'Contracted acceptance class', method: 'AOI post-reflow', freq: '100%', critical: true, src: 'ASM-MB-B rev A', complete: true, missing: [] },
        { id: 'CTQ-B-BGA', feat: 'U2 hidden joints', fm: 'Hidden solder open', type: 'Categorical', limits: 'Contracted criteria', method: 'X-ray', freq: '100%', critical: true, src: 'ASM-MB-B rev A', complete: true, missing: [] },
        { id: 'CTQ-B-FW', feat: 'Firmware programming', fm: 'Wrong firmware', type: 'Categorical', limits: 'FW 1.0.7 (synthetic)', method: 'Programming verify', freq: '100%', critical: true, src: 'Customer B FW release note', complete: true, missing: [] },
        { id: 'CTQ-B-FT', feat: 'Functional sequence', fm: 'Incomplete function', type: 'Test cases', limits: tp ? 'TP-MB-B 1.0 FT-01…FT-14' : '', method: tp ? 'Functional test' : '', freq: tp ? '100%' : '', critical: true, src: tp ? 'TP-MB-B 1.0 (agreed ' + fmtD(d.testPlan.at) + ')' : 'No customer functional SOP supplied', complete: tp, missing: tp ? [] : ['limits', 'method', 'frequency'] }
      ];
    }
    const a = st.A;
    return CTQ_A.map(c => {
      if (c.na) return Object.assign({}, c, { complete: true, missing: [] });
      if (c.id === 'CTQ-U3-ORI') { const f = u3Fields(a); const miss = f.filter(x => !x[1]).map(x => x[0]); return Object.assign({}, c, { complete: !miss.length, missing: miss, fields: f }); }
      return Object.assign({}, c, { complete: true, missing: [] });
    });
  }
  function coverage(st, sc) {
    if (sc === 'D') {
      const d = st.D, ftc = d.ftResults ? 'validated' : d.testPlan ? 'capable' : 'unknown';
      const L = [
        { id: 'FM-B-FUNC', name: 'Incomplete function', ctq: 'CTQ-B-FT', req: ['ft'], cells: { setup: 'na', fa: 'not capable', spi: 'na', aoi: 'not capable', xray: 'not capable', dip: 'na', ft: ftc }, notes: { ft: d.ftResults ? 'TP-MB-B 1.0 run on FA: 14 / 14' : d.testPlan ? 'Plan agreed; FA results not imported' : 'No agreed functional method', fa: 'Appearance inspection is not functional testing' } },
        { id: 'FM-B-OPEN', name: 'U2 hidden solder open', ctq: 'CTQ-B-BGA', req: ['xray'], cells: { setup: 'na', fa: 'na', spi: 'capable', aoi: 'not capable', xray: 'validated', dip: 'na', ft: ftc === 'validated' ? 'capable' : 'unknown' }, notes: {} },
        { id: 'FM-B-FW', name: 'Wrong firmware', ctq: 'CTQ-B-FW', req: ['ft'], cells: { setup: 'na', fa: 'na', spi: 'na', aoi: 'na', xray: 'na', dip: 'na', ft: 'validated' }, notes: { ft: 'Programming verify step (hash read-back)' } },
        { id: 'FM-B-SOLDER', name: 'Visible solder defect', ctq: 'CTQ-B-SOLDER', req: ['aoi'], cells: { setup: 'na', fa: 'capable', spi: 'capable', aoi: 'validated', xray: 'na', dip: 'na', ft: 'na' }, notes: {} }
      ];
      L.forEach(f => f.covered = f.req.every(r => f.cells[r] === 'validated'));
      return L;
    }
    const a = st.A, res = a.conflict.status === 'resolved';
    const u3aoi = a.cov.challenge ? 'validated' : a.cov.aoiPin1 ? 'capable' : 'not capable';
    const L = [
      { id: 'FM-U3-ORI', name: 'U3 wrong orientation', ctq: 'CTQ-U3-ORI', req: ['fa', 'aoi'], cells: { setup: 'not capable', fa: res ? 'validated' : 'unknown', spi: 'na', aoi: u3aoi, xray: 'not capable', dip: 'na', ft: 'capable' },
        notes: { setup: 'Feeder scan confirms part, not rotation', fa: res ? 'Independent check against REF-U3-0007 and PKG-U3 rev 3' : 'No approved reference: sources conflict', aoi: a.cov.challenge ? `AOI-MB-A ${a.prog.aoi.rev}: challenge ${a.cov.challenge.detected} / ${a.cov.challenge.total} orientation errors detected` : a.cov.aoiPin1 ? `AOI-MB-A ${a.prog.aoi.rev}: Pin 1 feature added; challenge set not run` : 'AOI-MB-A v4 checks presence and offset only; no Pin 1 feature', xray: 'X-ray is not a Pin 1 control', ft: 'FT-07 exercises U3; rotation detection not validated' } },
      { id: 'FM-U7-OPEN', name: 'U7 hidden solder open', ctq: 'CTQ-U7-BGA', req: ['xray'], cells: { setup: 'na', fa: 'na', spi: 'capable', aoi: 'not capable', xray: 'validated', dip: 'na', ft: 'capable' }, notes: { aoi: 'Optical inspection cannot certify hidden joints', xray: 'XR-MB-A recipe 4, all hidden joints' } },
      { id: 'FM-FW', name: 'Wrong firmware / incomplete function', ctq: 'CTQ-FT', req: ['ft'], cells: { setup: 'na', fa: 'capable', spi: 'na', aoi: 'na', xray: 'na', dip: 'na', ft: 'validated' }, notes: { ft: 'Firmware hash read-back + FT-01…FT-18' } },
      { id: 'FM-MPN', name: 'Wrong MPN placed', ctq: 'CTQ-BOM-MPN', req: ['setup'], cells: { setup: 'validated', fa: 'capable', spi: 'na', aoi: 'capable', xray: 'na', dip: 'na', ft: 'capable' }, notes: {} },
      { id: 'FM-C12', name: 'C12 reversed polarity', ctq: 'CTQ-C12-POL', req: ['aoi'], cells: { setup: 'na', fa: 'capable', spi: 'na', aoi: 'validated', xray: 'na', dip: 'na', ft: 'unknown' }, notes: {} },
      { id: 'FM-J1', name: 'J1 seating / joint', ctq: 'CTQ-J1-THT', req: ['dip'], cells: { setup: 'na', fa: 'capable', spi: 'na', aoi: 'na', xray: 'na', dip: 'validated', ft: 'capable' }, notes: { dip: 'Post-DIP gate; SMT pass is not carried forward' } }
    ];
    L.forEach(f => f.covered = f.req.every(r => f.cells[r] === 'validated'));
    return L;
  }
  function concessionStatus(st) {
    const c = st.D.concession; if (!c) return null;
    if (!(c.approvals.qa && c.approvals.cust)) return 'Pending approval';
    if (demoDate(st) > new Date(c.expiry)) return 'Expired';
    return 'Active';
  }
  function checklist(st, sc) {
    if (sc === 'D') {
      const d = st.D, cs = concessionStatus(st);
      return [
        { id: 'CTQ-B-APPEAR', name: 'Appearance / workmanship', method: 'Visual vs ASM-MB-B rev A', result: 'Pass', why: 'Inspector Ravi Menon · photo set FA-B-01' },
        { id: 'CTQ-B-SOLDER', name: 'Visible solder joints', method: 'AOI-MB-B v2', result: 'Pass', why: 'AOI run 1: 0 confirmed defects' },
        { id: 'CTQ-B-BGA', name: 'U2 hidden joints', method: 'X-ray', result: 'Pass', why: 'XR-1022: 196 / 196 joints accepted' },
        { id: 'CTQ-B-FW', name: 'Firmware programming', method: 'Hash read-back', result: 'Pass', why: 'FW 1.0.7 hash match' },
        { id: 'CTQ-B-FT', name: 'Functional sequence', method: d.testPlan ? 'TP-MB-B 1.0' : 'No agreed method', result: d.ftResults ? 'Pass' : 'Unknown', concession: !d.ftResults && cs === 'Active' ? d.concession.id : null,
          why: d.ftResults ? 'TP-MB-B 1.0: 14 / 14 cases passed' : d.testPlan ? 'Plan agreed; results not yet imported' : cs === 'Active' ? `No agreed method. Covered by concession ${d.concession.id}; result stays Unknown` : 'No customer functional SOP. Appearance inspection does not count as functional testing.' }
      ];
    }
    const a = st.A, r = a.fa.results, ph = a.fa.photo;
    const pass = (c, t, f) => c ? ['Pass', t] : ['Unknown', f];
    const rows = [
      ['CTQ-BOM-MPN', 'BOM / MPN match', 'Setup scan', ...pass(a.setup.verified && a.setup.verified.prog === a.prog.placement.rev, 'Setup verified by ' + (a.setup.verified ? uname(a.setup.verified.by) : ''), 'Setup not independently verified')],
      ['CTQ-U3-ORI', 'U3 Pin 1 orientation', 'Independent visual vs REF-U3-0007 + AOI polarity'].concat(!ph ? ['Unknown', 'Actual image not captured'] : ph.mode === 'misoriented' ? ['Fail', 'Observed PIN1-SE; expected PIN1-NW'] : !a.cov.challenge ? ['Unknown', 'Image matches, but AOI polarity coverage not validated'] : ['Pass', 'Observed PIN1-NW matches approved source; AOI polarity pass']),
      ['CTQ-C12-POL', 'C12 polarity', 'AOI polarity', ...pass(r, 'AOI run 1: pass', 'AOI result not imported')],
      ['CTQ-U7-BGA', 'U7 hidden joints', 'X-ray', ...pass(r, 'XR-0911: 256 / 256 joints accepted', 'X-ray result not imported')],
      ['CTQ-PASTE-U7', 'Paste volume, U7 pads', 'SPI', ...pass(r, 'Mean 99.2 %, min 91.4 %', 'SPI result not imported')],
      ['CTQ-RFL-PK', 'Reflow peak / TAL', 'Profiler run PR-311', ...pass(r, 'Peak 243.1 °C · TAL 61 s', 'Profile not imported')],
      ['CTQ-J1-THT', 'J1 seating / joint', 'Post-DIP inspection', ...pass(r, 'Inspected, accepted', 'Inspection not recorded')],
      ['CTQ-FW', 'Firmware version / hash', 'Programming verify', ...pass(r, 'FW 2.4.1 hash match', 'No record')],
      ['CTQ-FT', 'Functional sequence', 'TP-MB-A 1.2', ...pass(r, '18 / 18 cases passed', 'Test results not imported')],
      ['CTQ-CLEAN', 'Ionic cleanliness', 'None', 'Not applicable', 'No-clean route R-MB-A v3 · N/A approved by Daniel Cho']
    ];
    return rows.map(x => ({ id: x[0], name: x[1], method: x[2], result: x[3], why: x[4] }));
  }
  function snap(st, sc) { return snapOf(st[sc].prog); }
  function approvalBlockers(st, sc) {
    const d = st[sc], cur = snap(st, sc), out = [];
    ['eng', 'qa', 'cust'].forEach(k => {
      const ap = d.fa.approvals[k];
      if (!ap) out.push({ code: 'APPROVAL-MISSING', msg: `${APPR_LBL[k]} approval missing`, owner: k === 'cust' ? 'Customer approver' : APPR_LBL[k], action: `Record ${APPR_LBL[k].toLowerCase()} decision`, screen: 'fa' });
      else if (ap.hash !== cur) out.push({ code: 'APPROVAL-STALE', msg: `${APPR_LBL[k]} approval by ${uname(ap.by)} is bound to snapshot ${ap.hash}; current configuration is ${cur}`, owner: k === 'cust' ? 'Customer approver' : APPR_LBL[k], action: 'Re-verify affected CTQs and re-approve', screen: 'fa' });
    });
    return out;
  }
  function gates(st, sc) {
    sc = sc || st.scen;
    if (sc === 'A' || sc === 'D') return gatesAD(st, sc);
    if (sc === 'C') return gatesC(st);
    if (sc === 'B') return gatesB(st);
    if (sc === 'E') return gatesE(st);
    return gatesF(st);
  }
  function G(id, name, blockers, pending, note) { const real = blockers.filter(b => b.code !== 'PRIOR-GATE'); const waiting = blockers.length > 0 && !real.length; return { id, name, blockers: real, status: real.length ? 'Blocked' : waiting ? 'Waiting' : pending ? 'Pending' : 'Pass', note: waiting ? 'Waiting for the previous gate to pass' : (note || '') }; }
  const GN = ['Engineering readiness', 'Setup readiness', 'First article', 'Production continuation', 'Dispatch release'];
  function gatesAD(st, sc) {
    const d = st[sc], out = [];
    const b0 = [];
    if (sc === 'A' && d.conflict.status !== 'resolved') b0.push({ code: 'ORI-CONFLICT', ctq: 'CTQ-U3-ORI', msg: 'Unresolved orientation conflict: assembly drawing rev B shows Pin 1 NW; placement CSV r6 at 0° maps Pin 1 SE under the machine convention.', owner: 'Process engineer', action: 'Resolve mapping against PKG-U3 rev 3 and the approved manufacturing package', screen: 'eng' });
    ctqs(st, sc).filter(c => !c.na && !c.complete).forEach(c => { if (sc === 'D' && concessionStatus(st) === 'Active') return; b0.push({ code: sc === 'D' ? 'TEST-COVERAGE-GAP' : 'CTQ-INCOMPLETE', ctq: c.id, msg: `${c.id} missing mandatory fields: ${c.missing.join(', ')}`, owner: sc === 'D' ? 'Process engineer + Customer B' : 'Process engineer', action: sc === 'D' ? 'Agree a test plan, or route a scoped concession' : 'Complete CTQ record with source locator', screen: 'eng' }); });
    coverage(st, sc).filter(f => !f.covered).forEach(f => { if (sc === 'D' && concessionStatus(st) === 'Active' && f.id === 'FM-B-FUNC') return; b0.push({ code: 'COVERAGE-GAP', ctq: f.ctq, msg: `${f.name}: required detection not validated (${f.req.filter(r => f.cells[r] !== 'validated').map(r => GATECOL[r] + ' = ' + f.cells[r]).join('; ')})`, owner: 'Process engineer', action: 'Validate detection coverage', screen: 'eng' }); });
    out.push(G('G0', GN[0], b0));
    const b1 = [];
    if (sc === 'A') {
      if (b0.length) b1.push({ code: 'PRIOR-GATE', msg: 'G0 Engineering readiness not passed', owner: 'None', screen: 'eng' });
      else {
        if (d.setup.slot14 === 'wrong') b1.push({ code: 'WRONG-MATERIAL', msg: 'Feeder slot 14: scanned C-0402-10N; BOM expects C-0402-100N (C21 to C28)', owner: 'Operator', action: 'Rescan correct reel', screen: 'fa' });
        if (d.setup.machineProg !== d.prog.placement.rev) b1.push({ code: 'STALE-PROGRAM', msg: `Machine holds PLC-MB-A ${d.setup.machineProg}; approved revision is ${d.prog.placement.rev} (${d.prog.placement.hash})`, owner: 'Operator', action: 'Load approved program', screen: 'fa' });
        if (!d.setup.verified) b1.push({ code: 'SETUP-UNVERIFIED', msg: 'Setup not independently verified', owner: 'QA (second verifier)', action: 'Record independent setup verification', screen: 'fa' });
        else if (d.setup.verified.prog !== d.prog.placement.rev) b1.push({ code: 'SETUP-STALE', msg: `Setup verified against ${d.setup.verified.prog}; program is now ${d.prog.placement.rev}`, owner: 'QA (second verifier)', action: 'Repeat setup verification after change', screen: 'fa' });
      }
    }
    out.push(G('G1', GN[1], b1, false, sc === 'D' ? 'Seeded: setup SET-B-201 verified by Daniel Cho' : ''));
    const b2 = [];
    if (b1.length || (sc === 'A' && b0.length)) b2.push({ code: 'PRIOR-GATE', msg: 'Earlier gate not passed', owner: 'None', screen: sc === 'A' ? 'fa' : 'eng' });
    else {
      checklist(st, sc).filter(c => (c.result === 'Fail' || c.result === 'Unknown') && !c.concession).forEach(c => b2.push({ code: c.result === 'Fail' ? 'CTQ-FAIL' : 'CTQ-UNKNOWN', ctq: c.id, msg: `${c.id} ${c.result}: ${c.why}`, owner: c.result === 'Fail' ? 'QA' : 'Operator / Process engineer', action: c.result === 'Fail' ? 'Disposition NCR; rerun first article' : 'Provide evidence', screen: 'fa' }));
      approvalBlockers(st, sc).forEach(b => b2.push(b));
    }
    out.push(G('G2', GN[2], b2));
    const b3 = [];
    const activeHold = d.holds.find(h => h.status === 'Active');
    const everRel = d.releaseHistory.some(h => h.event === 'Released for batch');
    if (d.order.released || d.order.inProduction || everRel) {
      approvalBlockers(st, sc).filter(b => b.code === 'APPROVAL-STALE').forEach(b => b3.push(Object.assign({}, b, { code: 'REVISION-CHANGE', msg: 'Revision change invalidates approval: ' + b.msg })));
    }
    if (activeHold) b3.push({ code: 'HOLD', msg: `${activeHold.id} active: ${activeHold.reason}`, owner: 'QA', action: 'Resolve hold (returns to review stage)', screen: 'release' });
    out.push(G('G3', GN[3], b3, !(d.order.released || d.order.inProduction || everRel) && !b3.length, d.order.released ? '' : everRel ? 'Release suspended' : 'Starts after batch release'));
    const b4 = [];
    if (sc === 'D' && d.concession) { const cs = concessionStatus(st); if (cs === 'Expired') b4.push({ code: 'CONCESSION-EXPIRED', msg: `Concession ${d.concession.id} expired ${fmtD(d.concession.expiry)}`, owner: 'QA + Customer B', action: 'Renew concession or provide approved test results', screen: 'release' }); }
    out.push(G('G4', GN[4], b4, !b4.length, 'Batch not yet produced in this scenario'));
    return out;
  }
  function gatesB(st) {
    const b = st.B, h = b.holds.find(x => x.status === 'Active');
    const b4 = [{ code: 'RELEASE-OVERRIDE', msg: 'MB-A-1523 and MB-A-1524 released without AOI records (override on REL-2201)', owner: 'QA', action: 'Treat as unverified; include in containment', screen: 'ncr' }];
    if (h) b4.push({ code: 'HOLD', msg: `${h.id} active on ${h.count} finished-goods serials`, owner: 'QA', action: 'Disposition after independent inspection', screen: 'trace' });
    return [
      G('G0', GN[0], [{ code: 'NO-ORIENTATION-DECISION', ctq: 'CTQ-U3-ORI', msg: 'Historical rev B package has no recorded U3 orientation decision or rotation mapping', owner: 'Process engineer', action: 'Covered by CAPA-U3-001', screen: 'ncr' }], false, 'Retrospective evaluation under current rules'),
      G('G1', GN[1], [], false, 'SET-0918 feeder scan recorded'),
      G('G2', GN[2], [{ code: 'CTQ-UNKNOWN', ctq: 'CTQ-U3-ORI', msg: 'First-article report carries two signatures but no U3 image or source reference (Unknown)', owner: 'QA', action: 'Escape hypothesis EH-2', screen: 'ncr' }]),
      G('G3', GN[3], [{ code: 'COVERAGE-GAP', ctq: 'CTQ-U3-ORI', msg: 'AOI-MB-A v3 not capable of U3 Pin 1 detection; FT 1.0 has no U3 case', owner: 'Process engineer', action: 'Escape hypotheses EH-1, EH-3', screen: 'ncr' }]),
      G('G4', GN[4], b4)
    ];
  }
  function gatesE(st) { return [G('G0', GN[0], []), G('G1', GN[1], [], false, 'SET-1102, SET-1107'), G('G2', GN[2], [], false, 'Snapshot 7e21c0'), G('G3', GN[3], []), G('G4', GN[4], [], false, 'LOT-V-01…03 released')]; }
  function gatesF(st) {
    const f = st.F, b4 = f.incidents.map(i => ({ code: 'LATE-CRITICAL', msg: `${i.id}: ${i.text}. Prior release record preserved; dispatched exposure flagged.`, owner: 'QA', action: 'Authorized recall / containment review', screen: 'data' }));
    return [G('G0', GN[0], []), G('G1', GN[1], []), G('G2', GN[2], []), G('G3', GN[3], []), G('G4', GN[4], b4, false, 'SHP-3101 released 03 Oct')];
  }
  function orderState(st, sc) {
    sc = sc || st.scen; const d = st[sc];
    if (sc === 'A' || sc === 'D') {
      const g = gates(st, sc);
      if (d.holds.some(h => h.status === 'Active')) return 'On hold';
      if (d.order.inProduction) return 'In production';
      if (d.order.released) return 'Released for batch';
      if (g[0].blockers.length && sc === 'A') return 'Engineering review';
      if (sc === 'A' && g[1].blockers.length) return 'Ready for first article';
      const ap = d.fa.approvals, cur = snap(st, sc);
      if (ap.eng && ap.qa && ap.eng.hash === cur && ap.qa.hash === cur && !(ap.cust && ap.cust.hash === cur)) return 'Customer approval pending';
      return 'First article pending';
    }
    if (sc === 'B') return st.B.holdAt ? 'Closed · containment active' : 'Closed · complaint open';
    if (sc === 'C') return st.C.dispatch ? 'Released for dispatch' : 'Final QA pending';
    if (sc === 'E') return st.E.capa.closed ? 'Closed' : 'In production · effectiveness window';
    return st.F.incidents.length ? 'On hold · late evidence' : 'Closed · dispatched';
  }

  /* ---------- B: escape cohort ---------- */
  function serialB(n) {
    const i = n - 1001;
    return {
      serial: 'MB-A-' + n, n, panel: 'PNL-H-' + pad(Math.floor(i / 6) + 1, 4), pos: (i % 6) + 1,
      lot: n <= 1600 ? 'LOT-U3-H1' : 'LOT-U3-H2', reel: n >= 1777 && n <= 1800 ? null : n <= 1800 ? 'R-U3-5521' : 'R-U3-5530',
      pcb: n <= 1600 ? 'PCB-L-7731' : 'PCB-L-7740', paste: 'SP-2290', program: 'PLC-MB-A r5 · 4d09aa', setup: 'SET-0918', aoi: (n === 1523 || n === 1524) ? null : 'AOI-MB-A v3 · pass', ft: 'TP-MB-A 1.0 · pass (FT-01…FT-11)',
      ship: n <= 1480 ? 'SHP-2201' : n <= 1960 ? 'SHP-2202' : null, confirmed: n === 1437,
      built: new Date(Date.parse('2026-08-11T06:00:00+05:30') + i * 4.1 * 60000).toISOString()
    };
  }
  function queryB(type, value) {
    const v = String(value || '').trim().toUpperCase();
    const all = []; for (let n = 1001; n <= 2200; n++) all.push(serialB(n));
    let exact = [], uncertain = [], basis = '', kind = 'cohort', serial = null, warn = '';
    if (!v) return { kind: 'empty', exact, uncertain, basis: 'Enter a serial, lot, reel, program, setup or incident' };
    if (type === 'serial' || /^MB-A-\d{4}$/.test(v)) {
      const n = parseInt(v.replace('MB-A-', ''), 10); if (n >= 1001 && n <= 2200) { serial = serialB(n); kind = 'serial'; basis = 'Serial genealogy'; }
      else return { kind: 'none', exact, uncertain, basis: `No record for ${v} in WO-23602` };
      return { kind, serial, exact: [serial], uncertain, basis };
    }
    if (v === 'CMP-0017' || v === 'PLC-MB-A R5' || v === 'SET-0918') {
      exact = all; basis = (v === 'CMP-0017' ? 'Incident CMP-0017 → serial MB-A-1437 → ' : '') + 'setup SET-0918 with program PLC-MB-A r5. No verified conforming U3 check exists in the window, so exposure runs from the first to the last board built on this setup.';
    } else if (v === 'R-U3-5521') {
      exact = all.filter(s => s.reel === 'R-U3-5521'); uncertain = all.filter(s => s.reel === null);
      basis = 'Boards linked to reel R-U3-5521. 24 boards built in the same window have no reel link; scope is broadened to include them as uncertain.'; warn = 'Incomplete genealogy broadens scope';
    } else if (v === 'R-U3-5530') { exact = all.filter(s => s.reel === 'R-U3-5530'); basis = 'Boards linked to reel R-U3-5530'; }
    else if (v === 'LOT-U3-H1' || v === 'LOT-U3-H2') { exact = all.filter(s => s.lot === v); basis = 'Production lot ' + v; }
    else if (/^PNL-H-\d{4}$/.test(v)) { exact = all.filter(s => s.panel === v); basis = 'Panel ' + v + ' child serials'; }
    else return { kind: 'none', exact, uncertain, basis: `No genealogy match for "${value}". Try MB-A-1437, CMP-0017, SET-0918, PLC-MB-A r5, R-U3-5521, LOT-U3-H1 or PNL-H-0073.` };
    const set = exact.concat(uncertain);
    return { kind, exact, uncertain, basis, warn, total: set.length, shipped: set.filter(s => s.ship).length, stock: set.filter(s => !s.ship).length, confirmed: set.filter(s => s.confirmed).length,
      byShip: ['SHP-2201', 'SHP-2202', null].map(k => ({ ship: k || 'Finished-goods stock', n: set.filter(s => s.ship === k).length })) };
  }

  /* ---------- C: production, SPC ---------- */
  const C_FAIL = [7, 19, 23, 31, 42, 48, 56, 63, 77, 81, 94, 102, 115, 128, 133, 141, 156, 167, 179, 191];
  const C_SCRAP = [31, 77, 128, 156, 191];
  const C_UPSTREAM = [11, 27, 39, 52, 68, 86, 99, 110, 124, 147];
  function boardC(st, i) {
    const s = 'MB-C-' + pad(i, 4);
    const failed = C_FAIL.includes(i), scrap = C_SCRAP.includes(i), up = C_UPSTREAM.includes(i);
    let status = 'Good', ft = 'Pass';
    if (failed) { ft = 'Fail → '; if (scrap) { status = 'Scrapped'; ft += 'scrapped'; } else if (i === 42 && st.C.rework.step < 6) { status = 'Held · rework'; ft += 'rework open'; } else { status = 'Good'; ft += 'retest pass'; } }
    const xray = i === 117 && !st.C.xray0117 ? 'Not run' : 'Pass';
    return { serial: s, i, panel: 'PNL-D-' + pad(Math.ceil(i / 5), 3), pos: ((i - 1) % 5) + 1, status, ft, failed, scrap, up, xray, spi: up ? 'Fail → rework' : 'Pass', stale: i >= 151 && i <= 160 };
  }
  function boardsC(st) { const a = []; for (let i = 1; i <= 200; i++) a.push(boardC(st, i)); return a; }
  function recon(st) {
    const b = boardsC(st);
    const good = b.filter(x => x.status === 'Good').length, held = b.filter(x => x.status.startsWith('Held')).length, scrap = b.filter(x => x.status === 'Scrapped').length;
    return { started: 200, good, held, rework: 0, scrap, wip: 0, sum: good + held + scrap };
  }
  function gatesC(st) {
    const c = st.C, r = recon(st), b4 = [];
    if (r.sum !== r.started) b4.push({ code: 'QTY-UNRECONCILED', msg: `Started ${r.started} ≠ accounted ${r.sum}`, owner: 'QA', screen: 'release' });
    if (!c.xray0117) b4.push({ code: 'REQUIRED-CHECK-MISSING', msg: 'MB-C-0117: required X-ray check not run (route skipped)', owner: 'Operator', action: 'Run X-ray on MB-C-0117', screen: 'prod' });
    if (r.held && st.config.mixedShipment === 'block') b4.push({ code: 'HELD-SERIAL', msg: `${r.held} held serial (MB-C-0042) in shipment scope; configuration blocks mixed shipments`, owner: 'QA', action: 'Close disposition, or configure exclusion', screen: 'prod' });
    return [G('G0', GN[0], []), G('G1', GN[1], []), G('G2', GN[2], [], false, 'FA approved 18 Sep · snapshot 7e21c0'), G('G3', GN[3], []), G('G4', GN[4], b4, !c.dispatch && !b4.length, c.dispatch ? '' : 'QA authorization pending')];
  }
  function spcPaste(st) {
    const r = rng(11); let base = []; for (let i = 0; i < 40; i++) base.push(gauss(r) * 2.4);
    const m0 = avg(base); base = base.map(v => +(v - m0 + 100).toFixed(1));
    const drift = [101.4, 101.1, 102.3, 102.8, 103.6, 104.5, 105.1, 105.9, 106.8, 107.9, 109.2, 110.6, 112.1, 113.8, 115.4, 116.3];
    const pts = base.concat(drift);
    const lim = st.config.limits.find(l => l.id === 'L-PASTE');
    return chartStats(pts, 40, lim.lsl, lim.usl, 'Paste volume · U7 pads (% of aperture)', '%', 'I-MR');
  }
  function spcPeak() {
    const r = rng(23); const pts = []; for (let i = 0; i < 36; i++) pts.push(+(243 + gauss(r) * 0.9).toFixed(1));
    return chartStats(pts, 30, 238, 248, 'Reflow measured peak · TC2 (°C)', '°C', 'I-MR');
  }
  function chartStats(pts, nb, lsl, usl, title, unit, type) {
    const base = pts.slice(0, nb), mean = avg(base);
    const mr = base.slice(1).map((v, i) => Math.abs(v - base[i])), mrbar = avg(mr), sigma = mrbar / 1.128;
    const ucl = mean + 3 * sigma, lcl = mean - 3 * sigma;
    const fired = [];
    for (let i = nb; i < pts.length; i++) {
      const x = pts[i];
      if (Math.abs(x - mean) > 3 * sigma) fired.push({ i, rule: 'R1', text: 'One point beyond 3σ' });
      if (i >= 7) { const w = pts.slice(i - 7, i + 1); if (w.every(v => v > mean) || w.every(v => v < mean)) fired.push({ i, rule: 'R2', text: 'Eight consecutive points on one side of centre' }); }
      if (i >= 5) { const w = pts.slice(i - 5, i + 1); let inc = true, dec = true; for (let k = 1; k < 6; k++) { if (!(w[k] > w[k - 1])) inc = false; if (!(w[k] < w[k - 1])) dec = false; } if (inc || dec) fired.push({ i, rule: 'R3', text: 'Six points monotonically ' + (inc ? 'increasing' : 'decreasing') }); }
    }
    const firstRule = {}; fired.forEach(f => { if (firstRule[f.rule] === undefined) firstRule[f.rule] = f.i; });
    const firstAlert = fired.length ? Math.min(...fired.map(f => f.i)) : null;
    const cross = pts.findIndex((v, i) => i >= nb && (v > usl || v < lsl));
    const stable = !fired.length;
    const cp = (usl - lsl) / (6 * sigma), cpk = Math.min(usl - mean, mean - lsl) / (3 * sigma);
    return { title, unit, type, pts, nb, mean, sigma, ucl, lcl, lsl, usl, fired, firstRule, firstAlert, cross: cross < 0 ? null : cross, stable, cp, cpk, n: nb };
  }
  function pChart() {
    const r = rng(5); const sub = []; let tot = 0, def = 0;
    for (let i = 0; i < 25; i++) { const n = 18 + Math.floor(r() * 8); const d = r() < 0.55 ? 0 : r() < 0.8 ? 1 : 2; sub.push({ n, d }); tot += n; def += d; }
    const pbar = def / tot;
    return { pbar, sub: sub.map(s => ({ n: s.n, d: s.d, p: s.d / s.n, ucl: pbar + 3 * Math.sqrt(pbar * (1 - pbar) / s.n), lcl: Math.max(0, pbar - 3 * Math.sqrt(pbar * (1 - pbar) / s.n)) })) };
  }
  function defectsC() {
    const rows = [];
    const add = (n, refdes, mode, confirmed, opts) => { for (let k = 0; k < n; k++) rows.push(Object.assign({ refdes, mode, confirmed, shift: ['A', 'B', 'C'][(rows.length * 7) % 3], paste: rows.length % 3 === 0 ? 'SP-2291' : 'SP-2290', program: rows.length % 4 === 0 ? 'AOI-MB-A v5.1' : 'AOI-MB-A v5', feeder: 'F' + (10 + (rows.length % 9)), reviewer: ['Ravi Menon', 'J. Bose'][rows.length % 2] }, opts || {})); };
    add(6, 'U7', 'Insufficient solder', true, { paste: 'SP-2291' }); add(1, 'U7', 'Bridge', true, { paste: 'SP-2291' });
    add(3, 'R44', 'Tombstone', true); add(3, 'C12', 'Offset', true); add(2, 'J1', 'Insufficient fill', true); add(2, 'Q2', 'Lifted lead', true);
    add(14, 'R12', 'False call · shadow', false); add(9, 'C33', 'False call · label', false); add(6, 'U7', 'False call · fillet', false); add(5, 'D4', 'False call · glare', false); add(7, 'Other', 'False call', false);
    return rows;
  }

  /* ---------- predictive ---------- */
  function predict(st, o) {
    const sp = spcPaste(st), last = sp.pts.length - 1;
    const useCase = o.useCase || 'risk';
    const base = { model: useCase === 'vuln' ? 'Rule set VULN-R1 (explainable indicator)' : useCase === 'rca' ? 'Draft assistant (synthetic)' : 'Logistic baseline v0.3-synthetic', status: 'Synthetic demo · not validated', asOf: o.asOf, horizon: useCase === 'drift' ? '30 min' : useCase === 'risk' ? 'Next board at pre-reflow' : 'None' };
    if (o.product === 'MB-9001') return Object.assign(base, { available: false, reason: 'Prediction unavailable: product MB-9001 is unseen in training data.' });
    if (o.leak && (useCase === 'risk' || useCase === 'drift')) return Object.assign(base, { available: false, reason: 'Refused: "Functional test result" exists only after the prediction timestamp. Downstream results and final dispositions are excluded from upstream models.' });
    if (o.asOf > last) return Object.assign(base, { available: false, reason: `Prediction unavailable: as-of point ${o.asOf + 1} is later than the latest received record (${last + 1}). Future data is refused.` });
    if (o.stale) return Object.assign(base, { available: false, reason: 'Prediction unavailable: SPI feed last record 47 min before as-of time exceeds the 15 min freshness limit.' });
    if (useCase === 'risk') {
      const w = sp.pts.slice(Math.max(0, o.asOf - 4), o.asOf + 1), z = (avg(w) - sp.mean) / sp.sigma;
      const slope = w.length > 1 ? (w[w.length - 1] - w[0]) / (w.length - 1) : 0;
      const pasteAge = 1.5 + Math.max(0, o.asOf - 40) * 0.18;
      const score = z * 0.9 + slope * 0.8 + (pasteAge > 3 ? 0.6 : 0);
      const band = score > 2.4 ? 'High' : score > 1.0 ? 'Elevated' : 'Low';
      return Object.assign(base, { available: true, band, score: +score.toFixed(2), missing: '0 of 6 features missing', contributors: [
        { f: 'Mean paste volume, last 5 panels', v: avg(w).toFixed(1) + ' %', w: +(z * 0.9).toFixed(2) },
        { f: 'Paste volume slope per panel', v: slope.toFixed(2) + ' %', w: +(slope * 0.8).toFixed(2) },
        { f: 'Paste exposure time', v: pasteAge.toFixed(1) + ' h', w: pasteAge > 3 ? 0.6 : 0 },
        { f: 'Stencil wipes since clean', v: String(4 + Math.max(0, o.asOf - 40)), w: 0.0 },
        { f: 'Setup / material context', v: 'SET-1102 · SP-2291', w: 0.0 }
      ], action: band === 'Low' ? 'No action' : band === 'Elevated' ? 'Targeted inspection of next 5 boards; engineer review of stencil and paste' : 'Engineer review now; inspect stencil, paste roll and print settings' });
    }
    if (useCase === 'drift') {
      const p = spcPeak(); const f = p.mean + 0.2;
      return Object.assign(base, { available: true, band: 'Low', forecast: `${f.toFixed(1)} °C ± 1.6 °C (80% interval) in 30 min; limit 248 °C`, contributors: [{ f: 'Peak TC2, last 6 runs', v: p.pts.slice(-6).map(x => x.toFixed(1)).join(', '), w: 0.1 }, { f: 'Conveyor speed', v: '82 cm/min · stable', w: 0 }, { f: 'Zone 7 setpoint', v: '255 °C · unchanged', w: 0 }], note: 'Profiler readings are periodic (each shift + changeover). That cadence may be insufficient for a 30-minute horizon; oven air temperature is a proxy, not a joint temperature.', action: 'No action; keep scheduled profiling' });
    }
    if (useCase === 'vuln') {
      const cov = coverage(st, 'A'); const items = [];
      cov.filter(f => !f.covered).forEach(f => items.push({ f: `${f.ctq} lacks validated coverage`, v: f.req.map(r => GATECOL[r] + ': ' + f.cells[r]).join(' · '), w: 3 }));
      if (st.A.impacts.some(i => i.status !== 'Closed')) items.push({ f: 'Changed program with open impact review', v: st.A.impacts.map(i => i.changed).join(', '), w: 2 });
      if (st.A.conflict.status !== 'resolved') items.push({ f: 'Unresolved evidence gap', v: 'EQ-031 orientation conflict', w: 2 });
      const pts = items.reduce((s, x) => s + x.w, 0);
      return Object.assign(base, { available: true, band: pts >= 5 ? 'High' : pts >= 2 ? 'Elevated' : 'Low', score: pts, contributors: items.length ? items : [{ f: 'No open vulnerability rules', v: 'All critical CTQs covered', w: 0 }], note: 'Rule-based indicator over WO-24817 configuration. This is not a defect probability.', action: pts ? 'Close coverage gaps before release' : 'No action' });
    }
    return Object.assign(base, { available: true, band: 'None', draft: [
      { k: 'Occurrence hypothesis', t: 'U3 placed rotated 180° because the centroid rotation (0°) was not mapped to the machine origin convention.', cite: 'PLC-MB-A r5; ASM-MB-A rev B sh. 1; NCR-U3-001 EVD-212' },
      { k: 'Escape hypothesis', t: 'AOI-MB-A v3 did not include a Pin 1 polarity feature; FT 1.0 does not exercise U3.', cite: 'EVD-221; EVD-224' },
      { k: 'Similar cases', t: 'NCR-C12-009 (polarity, AOI feature missing, 2025); NCR-U9-002 (rotation convention, other customer product).', cite: 'NCR index' },
      { k: 'Gaps', t: 'No tray orientation record; no FA photograph for the historical first article.', cite: 'EVD-219' }
    ], note: 'Draft pending QA review. AI cannot sign, close actions, waive a CTQ or certify a root cause.' });
  }

  /* ---------- F: import ---------- */
  const T = (d) => '2026-10-02T' + d + '+05:30';
  function rowsAOI() { const r = []; for (let k = 0; k < 12; k++) r.push({ line: k + 2, event_id: 'EVT-' + pad(40 + k, 4), source_system: 'AOI-L2', event_time: T('10:' + pad(10 + k, 2) + ':00'), product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'AOI-01', event_type: 'inspection', entity_type: 'board', board_serial: 'MB-F-' + pad(k + 1, 4), refdes: 'U3', ctq: 'CTQ-U3-ORI', run: 1, value: 'PIN1-NW', unit: 'label', result: 'Pass' }); return r; }
  function rowsSPI() {
    const r = []; for (let k = 0; k < 6; k++) r.push({ line: k + 2, event_id: 'EVT-' + pad(101 + k, 4), source_system: 'SPI-L2', event_time: T('09:' + pad(40 + k, 2) + ':00'), product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'SPI-01', event_type: 'measurement', entity_type: 'board', board_serial: 'MB-F-' + pad(k + 13, 4), refdes: 'U7', ctq: 'CTQ-PASTE-U7', run: 1, value: (98 + k * 0.7).toFixed(1), unit: '%', result: 'Pass' });
    r.push({ line: 8, event_id: 'EVT-0107', source_system: 'SPI-L2', event_time: T('09:46:00'), product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'SPI-01', event_type: 'measurement', entity_type: 'board', board_serial: '', refdes: 'U7', ctq: 'CTQ-PASTE-U7', run: 1, value: '101.2', unit: '%', result: 'Pass' });
    r.push({ line: 9, event_id: 'EVT-0108', source_system: 'SPI-L2', event_time: T('09:47:00'), product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'SPI-01', event_type: 'measurement', entity_type: 'board', board_serial: 'MB-F-0020', refdes: 'U7', ctq: 'CTQ-PASTE-U7', run: 1, value: '4.1', unit: 'mil', result: 'Pass' });
    r.push({ line: 10, event_id: 'EVT-0109', source_system: 'SPI-L2', event_time: T('09:48:00'), product_revision: 'MB-7420 rev Z', lot_id: 'LOT-F-01', station_id: 'SPI-01', event_type: 'measurement', entity_type: 'board', board_serial: 'MB-F-0021', refdes: 'U7', ctq: 'CTQ-PASTE-U7', run: 1, value: '99.0', unit: '%', result: 'Pass' });
    r.push({ line: 11, event_id: 'EVT-0110', source_system: 'SPI-L2', event_time: '2027-03-01T09:49:00+05:30', product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'SPI-01', event_type: 'measurement', entity_type: 'board', board_serial: 'MB-F-0022', refdes: 'U7', ctq: 'CTQ-PASTE-U7', run: 1, value: '100.4', unit: '%', result: 'Pass' });
    r.push({ line: 12, event_id: 'EVT-0045', source_system: 'AOI-L2', event_time: T('10:15:00'), product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'AOI-01', event_type: 'inspection', entity_type: 'board', board_serial: 'MB-F-0006', refdes: 'U3', ctq: 'CTQ-U3-ORI', run: 1, value: 'PIN1-SE', unit: 'label', result: 'Fail' });
    return r;
  }
  function rowsLate() {
    return [
      { line: 2, event_id: 'EVT-0201', source_system: 'FT-L2', event_time: '2026-10-01T14:02:00+05:30', product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'FT-02', event_type: 'test', entity_type: 'board', board_serial: 'MB-F-0088', refdes: 'U3', ctq: 'CTQ-FT', run: 1, value: 'FT-07 no response', unit: 'case', result: 'Fail', critical: true },
      { line: 3, event_id: 'EVT-0202', source_system: 'FT-L2', event_time: '2026-10-01T14:05:00+05:30', product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'FT-02', event_type: 'test', entity_type: 'board', board_serial: 'MB-F-0089', refdes: '', ctq: 'CTQ-FT', run: 1, value: '18/18', unit: 'case', result: 'Pass' },
      { line: 4, event_id: 'EVT-0203', source_system: 'FT-L2', event_time: '2026-10-01T14:09:00+05:30', product_revision: 'MB-7420 rev C', lot_id: 'LOT-F-01', station_id: 'FT-02', event_type: 'test', entity_type: 'board', board_serial: 'MB-F-0090', refdes: '', ctq: 'CTQ-FT', run: 1, value: '18/18', unit: 'case', result: 'Pass' }
    ];
  }
  const FILES = {
    aoi: { name: 'aoi_results_LOT-F-01.csv', source: 'AOI-L2', rows: rowsAOI, map: [['evt_id', 'event_id'], ['src', 'source_system'], ['ts', 'event_time'], ['product_rev', 'product_revision'], ['lot', 'lot_id'], ['machine', 'station_id'], ['serial', 'board_serial'], ['ref', 'refdes'], ['ctq_id', 'ctq'], ['run_no', 'run'], ['observed', 'value'], ['uom', 'unit'], ['judgement', 'result']] },
    spi: { name: 'spi_measurements_LOT-F-01.csv', source: 'SPI-L2', rows: rowsSPI, map: [['EventID', 'event_id'], ['System', 'source_system'], ['Timestamp', 'event_time'], ['Revision', 'product_revision'], ['Lot', 'lot_id'], ['Station', 'station_id'], ['BoardSN', 'board_serial'], ['Pad', 'refdes'], ['CTQ', 'ctq'], ['Attempt', 'run'], ['Volume', 'value'], ['Unit', 'unit'], ['Result', 'result']] },
    late: { name: 'ft_results_FT-02_2026-10-01.csv', source: 'FT-L2', rows: rowsLate, map: [['id', 'event_id'], ['sys', 'source_system'], ['time', 'event_time'], ['rev', 'product_revision'], ['lot', 'lot_id'], ['tester', 'station_id'], ['sn', 'board_serial'], ['case', 'value'], ['attempt', 'run'], ['status', 'result']] }
  };
  const UNITS = { 'CTQ-PASTE-U7': ['%'], 'CTQ-U3-ORI': ['label'], 'CTQ-FT': ['case'] };
  const REVS = ['MB-7420 rev C'];
  const rowKey = r => r.source_system + '|' + r.event_id;
  const rowSig = r => hash([r.board_serial, r.value, r.unit, r.result, r.event_time].join('|'));
  function classify(st, rows, ingest) {
    const f = st.F, out = [];
    const seen = {};
    rows.forEach(r => {
      let cls = 'new', reason = '';
      if (!r.board_serial && r.entity_type === 'board') { cls = 'quarantine'; reason = 'Missing key: board_serial is required for board-level events'; }
      else if (!REVS.includes(r.product_revision)) { cls = 'quarantine'; reason = `Unknown product revision "${r.product_revision}"`; }
      else if (UNITS[r.ctq] && !UNITS[r.ctq].includes(r.unit)) { cls = 'quarantine'; reason = `Invalid unit "${r.unit}" for ${r.ctq} (expected ${UNITS[r.ctq].join(', ')})`; }
      else if (new Date(r.event_time) > new Date(ingest) || new Date(r.event_time) < new Date('2020-01-01')) { cls = 'quarantine'; reason = `Impossible timestamp ${r.event_time} (after ingestion time)`; }
      else {
        const k = rowKey(r), prev = f.events[k] || seen[k];
        if (prev) { if (prev === rowSig(r)) { cls = 'duplicate'; reason = 'Identical to accepted event ' + r.event_id; } else { cls = 'conflict'; reason = `Conflicting duplicate of ${r.event_id} (${r.source_system}): values differ; requires review`; } }
        else { seen[k] = rowSig(r); if (r.critical && r.result === 'Fail') { cls = 'late-critical'; reason = 'Late critical failure: event time precedes shipment release'; } }
      }
      out.push({ row: r, cls, reason });
    });
    return out;
  }
  function importStats(st) {
    const f = st.F, accepted = Object.keys(f.events).length;
    return { valid: f.baseValid + accepted - f.late, accepted, expected: f.expected, late: f.late, invalid: f.quarantine.length, conflicts: f.review.length, imports: f.imports.length };
  }

  /* ---------- KPIs ---------- */
  function K(id, name, num, den, mult, unit, badge, o) {
    o = o || {}; const value = den ? num / den * mult : null;
    return Object.assign({ id, name, num, den, mult, unit, badge, value, display: value === null ? 'Not available' : (unit === 'PPM' ? Math.round(value).toLocaleString('en-US') : (Math.round(value * 10) / 10).toFixed(1)) + (unit === 'PPM' ? ' PPM' : unit === '%' ? '%' : ' ' + unit) }, o);
  }
  function Kraw(id, name, display, badge, o) { return Object.assign({ id, name, display, badge, value: null }, o || {}); }
  function kpis(st, sc) {
    sc = sc || st.scen; const L = [];
    if (sc === 'A') {
      const c = ctqs(st, 'A').filter(x => !x.na), cov = coverage(st, 'A').filter(f => true);
      L.push(K('K01', 'CTQ definition completeness', c.filter(x => x.complete).length, c.length, 100, '%', 'Manual verified data', { cohort: 'MB-7420 rev C', excl: 'CTQ-CLEAN (approved N/A)', screen: 'eng', target: 100 }));
      L.push(K('K02', 'Validated critical coverage', cov.filter(f => f.covered).length, cov.length, 100, '%', 'Manual verified data', { cohort: 'Critical failure modes, MB-7420 rev C', screen: 'eng', target: 100 }));
      const fa = st.A.fa, done = fa.approvedAt ? 1 : 0;
      L.push(K('K03', 'First-article first-pass approval', done && !fa.rerun ? 1 : 0, done, 100, '%', 'Synthetic demo', { cohort: 'WO-24817 first articles', screen: 'fa', note: fa.rerun ? `${fa.rerun} rerun(s) recorded` : '' }));
      const hrs = fa.approvedAt && fa.submittedAt ? (Date.parse(fa.approvedAt) - Date.parse(fa.submittedAt)) / 3600000 : null;
      L.push(hrs === null ? Kraw('K04', 'FA approval lead time (median)', fa.submittedAt ? 'Open · ' + ((Date.now() - Date.parse(fa.submittedAt)) / 3600000).toFixed(2) + ' h' : 'Not available', 'Synthetic demo', { screen: 'fa', note: 'Open age shown separately' }) : Kraw('K04', 'FA approval lead time (median)', hrs.toFixed(2) + ' h', 'Synthetic demo', { screen: 'fa', note: 'Demo session time' }));
      const s = st.A.setup; L.push(K('K07', 'Setup first-pass conformance', s.initial === 'pass' ? 1 : 0, s.initial ? 1 : 0, 100, '%', 'Manual verified data', { screen: 'fa', note: s.initial ? '' : 'No completed initial setup review' }));
      const cl = checklist(st, 'A').filter(x => x.result !== 'Not applicable');
      L.push(K('K15', 'Required FA check completion', cl.filter(x => x.result === 'Pass' || x.result === 'Fail').length, cl.length, 100, '%', 'Synthetic demo', { screen: 'fa' }));
    } else if (sc === 'B') {
      const all = queryB('x', 'SET-0918');
      L.push(K('K06', 'Genealogy completeness', 1176, 1200, 100, '%', 'Synthetic demo', { cohort: 'WO-23602 1,200 serials', note: '24 boards lack reel link', screen: 'trace' }));
      L.push(K('K10', 'Verified orientation defect PPM', 1, 0, 1e6, 'PPM', 'Missing', { note: 'No orientation-controlled placements were verified: denominator is zero', screen: 'trace' }));
      L.push(K('K15', 'Required AOI completion', 1198, 1200, 100, '%', 'Synthetic demo', { note: 'MB-A-1523, 1524 missing AOI records', screen: 'ncr' }));
      L.push(K('K24', 'Customer defect PPM', 1, all.shipped, 1e6, 'PPM', 'Manual verified data', { cohort: 'SHP-2201 + SHP-2202', note: 'Observation cutoff ' + fmtD(BASE_DATE) + '; 959 shipped boards unconfirmed (outstanding exposure)', screen: 'trace' }));
      const b = st.B; const mins = b.containedAt ? Math.round((Date.parse(b.containedAt) - Date.parse(b.detectedAt)) / 60000) : null;
      L.push(Kraw('K25', 'Containment lead time', mins === null ? 'Open · ' + Math.round((Date.now() - Date.parse(b.detectedAt)) / 60000) + ' min' : mins + ' min', 'Synthetic demo', { note: b.holdAt ? 'Initial hold ' + fmtT(b.holdAt) : 'No hold yet', screen: 'trace' }));
      L.push(K('K02', 'Critical coverage at time of build', 3, 6, 100, '%', 'Manual verified data', { note: 'Historical rev B configuration', screen: 'ncr' }));
    } else if (sc === 'C') {
      const r = recon(st), rec = 14 + (st.C.rework.step >= 6 ? 1 : 0);
      L.push(K('K08', 'SPI first-pass yield (board basis)', 190, 200, 100, '%', 'Direct machine data', { screen: 'spc' }));
      L.push(K('K09', 'Paste CTQ out-of-spec rate', 312, 9600, 100, '%', 'Direct machine data', { note: '0 missing measurements', screen: 'spc' }));
      L.push(K('K11', 'Qualified profile conformance', 11, 12, 100, '%', 'Manual verified data', { note: 'Periodic profiling only', screen: 'spc' }));
      L.push(K('K12', 'Telemetry excursion rate', 18, 960, 100, '%', 'Proxy', { note: 'Oven air temperature (proxy). Unmonitored 45 min', screen: 'spc' }));
      L.push(K('K13', 'AOI false-call fraction', 41, 58, 100, '%', 'Direct machine data', { note: '0 calls pending adjudication', screen: 'spc' }));
      L.push(Kraw('K14', 'Audited AOI miss fraction', 'Unknown', 'Missing', { note: 'No independent audit labels', screen: 'data' }));
      L.push(K('K16', 'Hidden-joint defect rate', 3, 51200, 100, '%', 'Direct machine data', { note: '100% inspected cohort', screen: 'spc' }));
      L.push(K('K17', 'Through-hole first-pass yield', 196, 200, 100, '%', 'Manual verified data', { screen: 'prod' }));
      L.push(K('K18', 'Finishing damage rate', 1, 200, 100, '%', 'Manual verified data', { screen: 'prod' }));
      L.push(Kraw('K19', 'Cleanliness compliance', 'Not applicable', 'Not applicable', { note: 'No-clean route R-MB-A v3', screen: 'data' }));
      L.push(K('K20', 'Functional first-pass yield', 180, 200, 100, '%', 'Direct machine data', { screen: 'prod', note: '20 original failures preserved' }));
      L.push(K('K21', 'Retest recovery', rec, rec + 5, 100, '%', 'Direct machine data', { screen: 'prod', note: (r.held ? r.held + ' unresolved failure (excluded until dispositioned)' : 'All failures dispositioned') }));
      L.push(K('K23', 'First-pass route yield', 170, 200, 100, '%', 'Synthetic demo', { screen: 'prod', note: '20 FT failures + 10 upstream rework, no overlap · 0 WIP' }));
      L.push(K('FY', 'Final test yield (separate)', r.good, 200, 100, '%', 'Synthetic demo', { screen: 'prod', note: 'Reported separately; FPY unchanged by rework' }));
    } else if (sc === 'D') {
      const cov = coverage(st, 'D');
      L.push(K('K02', 'Validated critical coverage', cov.filter(f => f.covered).length, cov.length, 100, '%', 'Manual verified data', { screen: 'eng', target: 100 }));
      const cl = checklist(st, 'D');
      L.push(K('K15', 'Required FA check completion', cl.filter(x => x.result === 'Pass' || x.result === 'Fail').length, cl.length, 100, '%', 'Manual verified data', { screen: 'fa' }));
      const ev = dossier(st, 'D'); L.push(K('K22', 'Release dossier completeness', ev.filter(e => e.ok).length, ev.length, 100, '%', 'Synthetic demo', { screen: 'release' }));
    } else if (sc === 'E') {
      const cap = st.E.capa, fails = st.E.lots.reduce((s, l) => s + l.fails, 0);
      L.push(K('K10', 'Verified orientation defect PPM', fails, 600, 1e6, 'PPM', 'Synthetic demo', { cohort: 'LOT-V-01…03, 600 verified U3 placements', screen: 'ncr' }));
      L.push(K('K15', 'Required U3 inspection completion', 600, 600, 100, '%', 'Synthetic demo', { screen: 'ncr' }));
      L.push(K('K26', 'CAPA effectiveness completion', cap.review && cap.review.pass ? 5 : 0, 5, 100, '%', 'Synthetic demo', { note: 'Pending actions remain in denominator', screen: 'ncr' }));
      L.push(K('K27', 'Recurrence rate', fails, 600, 100, '%', 'Synthetic demo', { cohort: 'Post-action window 21 Sep to 1 Oct', screen: 'ncr' }));
      L.push(K('K06', 'Genealogy completeness', 600, 600, 100, '%', 'Synthetic demo', { screen: 'trace' }));
    } else {
      const s = importStats(st);
      L.push(K('K28', 'Data readiness (valid, on time)', s.valid, s.expected, 100, '%', 'Synthetic demo', { note: `${s.late} late · ${s.invalid} invalid · ${s.conflicts} conflicts`, screen: 'data' }));
      L.push(Kraw('IMP', 'Accepted import events', String(s.accepted), 'Synthetic demo', { note: `${s.imports} import runs`, screen: 'data' }));
      L.push(K('K22', 'Release dossier completeness · SHP-3101', st.F.incidents.length ? 21 : 22, 22, 100, '%', 'Synthetic demo', { note: st.F.incidents.length ? 'Re-evaluated after late failure' : 'At release', screen: 'release' }));
    }
    return L;
  }
  function dossier(st, sc) {
    if (sc === 'D') {
      const d = st.D, cs = concessionStatus(st), cur = snap(st, 'D');
      return [
        { k: 'Approved BOM / placement package', ok: true, ev: 'BOM-MB-B A · PLC-MB-B r3' },
        { k: 'Functional test coverage', ok: !!d.ftResults || cs === 'Active', ev: d.ftResults ? 'TP-MB-B 1.0 results' : cs ? `${d.concession.id} · ${cs}` : 'Missing' },
        { k: 'First-article CTQ results current', ok: checklist(st, 'D').every(c => c.result === 'Pass' || c.concession), ev: 'FA-B-01' },
        { k: 'Engineering approval current', ok: !!(d.fa.approvals.eng && d.fa.approvals.eng.hash === cur), ev: d.fa.approvals.eng ? uname(d.fa.approvals.eng.by) : 'Missing' },
        { k: 'QA approval current', ok: !!(d.fa.approvals.qa && d.fa.approvals.qa.hash === cur), ev: d.fa.approvals.qa ? uname(d.fa.approvals.qa.by) : 'Missing' },
        { k: 'Customer B approval current', ok: !!(d.fa.approvals.cust && d.fa.approvals.cust.hash === cur), ev: d.fa.approvals.cust ? uname(d.fa.approvals.cust.by) : 'Missing' },
        { k: 'No active hold', ok: !d.holds.some(h => h.status === 'Active'), ev: '' }
      ];
    }
    if (sc === 'C') {
      const r = recon(st);
      return [
        { k: 'Quantity reconciled (started = good + held + rework + scrapped + WIP)', ok: r.sum === r.started, ev: `${r.started} = ${r.good} + ${r.held} + ${r.rework} + ${r.scrap} + ${r.wip}` },
        { k: 'Serial-level required tests complete', ok: st.C.xray0117, ev: st.C.xray0117 ? 'All required checks' : 'MB-C-0117 X-ray not run' },
        { k: 'Required dispositions closed', ok: r.held === 0 || st.config.mixedShipment === 'exclude', ev: r.held ? 'MB-C-0042 open · ' + (st.config.mixedShipment === 'exclude' ? 'excluded from shipment' : 'blocks shipment') : 'All closed' },
        { k: 'Approvals current (FA snapshot 7e21c0)', ok: true, ev: 'Anika Rao · Daniel Cho · Lena Ortiz' },
        { k: 'Concessions', ok: true, ev: 'None' },
        { k: 'Packaging / label verification', ok: true, ev: 'PKG-CHK-3001' },
        { k: 'QA release authorization', ok: !!st.C.dispatch, ev: st.C.dispatch ? uname(st.C.dispatch.by) : 'Pending' }
      ];
    }
    const g = gates(st, sc);
    return g.map(x => ({ k: x.id + ' ' + x.name, ok: x.status !== 'Blocked', ev: x.status }));
  }

  /* ---------- actions ---------- */
  function cur(st) { return st[st.scen]; }
  const ACT = {
    raiseQuery(st, u) { if (!can(u, 'query.raise')) return deny(u, 'raise engineering queries'); const a = st.A; if (a.conflict.status !== 'open') return E('Engineering query already raised'); a.conflict.status = 'query'; a.conflict.query = { id: 'EQ-031', by: u.id, at: iso(), owner: 'Anika Rao', due: addDays(st, 2) }; log(st, u, 'Engineering query raised', 'A', 'EQ-031 · CTQ-U3-ORI orientation conflict'); return ok('EQ-031 raised and assigned to Anika Rao'); },
    resolveConflict(st, u, o) {
      if (!can(u, 'conflict.resolve')) return deny(u, 'resolve engineering conflicts');
      const a = st.A; if (a.conflict.status === 'resolved') return E('Conflict already resolved');
      if (o.source === 'DOC-SILK') return E('Rejected: silkscreen or Gerber alone does not resolve an orientation conflict. Use the approved manufacturing package reconciled against the manufacturer package drawing.');
      if (o.source === 'DOC-ASM') return E('Rejected: the assembly drawing is one side of the conflict. Reconcile against the manufacturer package drawing.');
      if (!o.locator || o.locator.trim().length < 3) return E('Mark the source page or section (e.g. "PKG-U3 rev 3 §2 fig. 1").');
      const before = a.prog.placement.rev;
      a.conflict.status = 'resolved'; a.conflict.resolution = { source: 'PKG-U3 rev 3 + approved manufacturing package MP-MB-A C', locator: o.locator, by: u.id, at: iso(), mapping: 'Centroid 0° → machine 180°' };
      a.prog.placement = { id: 'PLC-MB-A', rev: 'r7', hash: '7e21c0' };
      log(st, u, 'Orientation conflict resolved', 'A', `CTQ-U3-ORI mapped from ${o.locator}; PLC-MB-A ${before} → r7`, false, 'PLC-MB-A ' + before, 'PLC-MB-A r7 · 7e21c0');
      return ok('Mapping recorded. PLC-MB-A revised to r7 with corrected rotation; reference image REF-U3-0007 approved.');
    },
    addAoiPin1(st, u) { if (!can(u, 'coverage.validate')) return deny(u, 'change inspection programs'); const a = st.A; if (a.cov.aoiPin1) return E('Pin 1 feature already in program'); a.cov.aoiPin1 = true; a.prog.aoi = { id: 'AOI-MB-A', rev: 'v5', hash: 'a61f08' }; log(st, u, 'AOI program revised', 'A', 'AOI-MB-A v4 → v5: U3 Pin 1 polarity feature added', false, 'v4 · 9c3f10', 'v5 · a61f08'); return ok('AOI-MB-A v5 created with U3 Pin 1 feature. Coverage is capable but not yet validated.'); },
    runChallenge(st, u) { if (!can(u, 'coverage.validate')) return deny(u, 'validate detection coverage'); const a = st.A; if (!a.cov.aoiPin1) return E('Add the Pin 1 feature before running the challenge set'); a.cov.challenge = { set: 'CH-U3-ORI-01', total: 12, detected: 12, conforming: 20, falseCalls: 0, by: u.id, at: iso() }; log(st, u, 'Detection challenge run', 'A', 'CH-U3-ORI-01: 12 / 12 orientation errors detected; 0 false calls on 20 conforming'); return ok('Challenge set passed: 12 / 12 orientation errors detected. AOI coverage validated.'); },
    setupCheck(st, u) { if (!(can(u, 'scan') || can(u, 'verify.setup'))) return deny(u, 'run setup checks'); const a = st.A; const g = gates(st, 'A'); if (g[0].blockers.length) return E('G0 Engineering readiness must pass before setup review'); const mism = (a.setup.slot14 === 'wrong' ? 1 : 0) + (a.setup.machineProg !== a.prog.placement.rev ? 1 : 0); if (!a.setup.initial) a.setup.initial = mism ? 'fail' : 'pass'; log(st, u, 'Setup comparison run', 'A', mism ? mism + ' critical mismatch(es); start blocked' : 'Expected and actual setup match'); return mism ? E(`Setup blocked: ${mism} critical mismatch(es). See G1.`) : ok('Setup matches. Independent verification required.'); },
    rescan(st, u) { if (!can(u, 'scan')) return deny(u, 'scan materials'); const a = st.A; if (a.setup.slot14 !== 'wrong') return E('Slot 14 already correct'); a.setup.slot14 = 'ok'; log(st, u, 'Reel rescanned', 'A', 'Slot 14: C-0402-100N reel R-0402-8812 scanned; matches BOM'); return ok('Slot 14 now matches BOM.'); },
    loadProgram(st, u) { if (!can(u, 'scan')) return deny(u, 'load machine programs'); const a = st.A; a.setup.machineProg = a.prog.placement.rev; a.setup.loadedBy = u.id; log(st, u, 'Program loaded', 'A', `PLC-MB-A ${a.prog.placement.rev} · ${a.prog.placement.hash} loaded on SMT-L2; checksum verified`); return ok(`PLC-MB-A ${a.prog.placement.rev} loaded; checksum ${a.prog.placement.hash} matches.`); },
    verifySetup(st, u) {
      if (!can(u, 'verify.setup')) return deny(u, 'record independent setup verification');
      const a = st.A; if (a.setup.slot14 === 'wrong' || a.setup.machineProg !== a.prog.placement.rev) return E('Cannot verify: critical setup mismatch open');
      if (a.setup.loadedBy === u.id) return E('Independent verifier required: you loaded the program');
      if (!a.setup.initial) a.setup.initial = 'pass';
      a.setup.verified = { by: u.id, at: iso(), prog: a.prog.placement.rev }; log(st, u, 'Setup independently verified', 'A', `SET-1102 · PLC-MB-A ${a.prog.placement.rev}; calibration current; ESD verified`); return ok('Setup verified. G1 passed.');
    },
    capture(st, u, o) {
      if (!can(u, 'capture')) return deny(u, 'capture first-article evidence');
      const sc = o.scen || st.scen, d = st[sc]; if (sc === 'A' && gates(st, 'A')[1].blockers.length) return E('G1 Setup readiness must pass before first-article build');
      d.fa.photo = { mode: o.mode || 'asPlaced', by: u.id, at: iso() };
      if (d.fa.results && !d.fa.submittedAt) d.fa.submittedAt = iso();
      log(st, u, 'FA image captured', sc, `${d.fa.serial} U3 ${o.mode === 'misoriented' ? 'observed PIN1-SE' : 'observed PIN1-NW'}`);
      if (o.mode === 'misoriented') {
        const id = 'NCR-A-' + (++st.seq); d.ncrs.push({ id, severity: 'Critical', ctq: 'CTQ-U3-ORI', at: iso(), text: 'U3 orientation fail at first article; expected PIN1-NW, observed PIN1-SE', status: 'Open', exposed: '1 unit (MB-A-FA01) since last verified conforming check' });
        d.holds.push({ id: 'H-' + st.seq, reason: 'CTQ-U3-ORI failed at first article (' + id + ')', scope: 'Order WO-24817 · FA serial MB-A-FA01', at: iso(), by: 'System reaction rule', status: 'Active' });
        log(st, null, 'Reaction rule fired', sc, `${id} critical NCR; release prevented; hold H-${st.seq}; independent inspection requested`);
        return E(`CTQ-U3-ORI failed. ${id} created; hold applied; 1 unit exposed. A good process score or low model risk cannot override this.`);
      }
      return ok('Actual image captured.');
    },
    importResults(st, u, o) { if (!(can(u, 'import.results') || can(u, 'import'))) return deny(u, 'import machine results'); const sc = o.scen || st.scen, d = st[sc]; if (sc === 'A' && gates(st, 'A')[1].blockers.length) return E('G1 Setup readiness must pass first'); d.fa.results = { at: iso(), by: u.id }; if (d.fa.photo && !d.fa.submittedAt) d.fa.submittedAt = iso(); log(st, u, 'Machine results imported', sc, 'AOI run 1, X-ray XR-0911, SPI, profile PR-311, FT run 1 linked to ' + d.fa.serial); return ok('AOI, X-ray, SPI, profile and test results linked to ' + d.fa.serial + '.'); },
    rerunFA(st, u, o) { if (!can(u, 'ctq.edit')) return deny(u, 'start a first-article rerun'); const sc = o.scen || st.scen, d = st[sc]; if (d.holds.some(h => h.status === 'Active')) return E('Resolve the active hold first (QA)'); d.fa.rerun++; d.fa.photo = null; d.fa.results = null; d.fa.submittedAt = null; Object.keys(d.fa.approvals).forEach(k => { if (d.fa.approvals[k]) d.fa.superseded.push(Object.assign({ kind: k, reason: 'FA rerun' }, d.fa.approvals[k])); d.fa.approvals[k] = null; }); log(st, u, 'First article rerun started', sc, 'Rerun #' + d.fa.rerun + '; previous evidence preserved'); return ok('First-article rerun started; original failure preserved.'); },
    sign(st, u, o) {
      const sc = o.scen || st.scen, k = o.kind, d = st[sc]; const perm = { eng: 'sign.eng', qa: 'sign.qa', cust: 'sign.cust' }[k];
      if (!can(u, perm)) return deny(u, `sign the ${APPR_LBL[k].toLowerCase()} approval`);
      if (k === 'cust' && u.customer !== d.order.customer) return E(`Customer approver ${u.name} may sign only assigned approvals for ${u.customer}.`, { code: 403 });
      const c = snap(st, sc), ap = d.fa.approvals;
      const other = k === 'eng' ? ap.qa : k === 'qa' ? ap.eng : null;
      if (other && other.by === u.id && other.hash === c) return E(`Independent approval required: ${u.name} already signed ${k === 'qa' ? 'engineering' : 'QA'} for this snapshot.`, { code: 409 });
      const bad = checklist(st, sc).filter(x => (x.result === 'Fail' || x.result === 'Unknown') && !x.concession);
      if (bad.length) return E(`Evidence incomplete: ${bad.map(x => x.id + ' ' + x.result).join(', ')}. Approval not recorded.`);
      if (sc === 'A' && gates(st, 'A')[1].blockers.length) return E('Setup readiness not passed');
      if (k === 'cust' && !(ap.eng && ap.qa && ap.eng.hash === c && ap.qa.hash === c)) return E('Customer approval requires current engineering and QA approvals first.');
      if (ap[k]) d.fa.superseded.push(Object.assign({ kind: k, reason: ap[k].hash !== c ? 'Stale after configuration change' : 'Re-signed' }, ap[k]));
      ap[k] = { by: u.id, at: iso(), hash: c };
      if (ap.eng && ap.qa && ap.cust && [ap.eng, ap.qa, ap.cust].every(x => x.hash === c)) d.fa.approvedAt = iso();
      log(st, u, APPR_LBL[k] + ' approval signed', sc, `${d.fa.serial} · snapshot ${c}`);
      return ok(`${APPR_LBL[k]} approval recorded against snapshot ${c}.`);
    },
    releaseBatch(st, u, o) {
      const sc = o.scen || st.scen, d = st[sc];
      if (!can(u, 'release')) return deny(u, 'authorize batch release');
      const g = gates(st, sc).slice(0, 3); const bl = [].concat(...g.map(x => x.blockers)).filter(b => b.code !== 'PRIOR-GATE');
      const act = d.holds.find(h => h.status === 'Active'); if (act) bl.unshift({ code: 'HOLD', msg: act.id + ' active: ' + act.reason, owner: 'QA', screen: 'release' });
      if (bl.length) { d.attempts.push({ at: iso(), by: u.id, blockers: bl.length }); log(st, u, 'Batch release rejected', sc, bl.map(b => (b.ctq ? b.ctq + ' ' : '') + b.code).join('; '), true); return E(`Release blocked: ${bl.length} blocker(s).`, { blockers: bl }); }
      d.order.released = true; d.releaseHistory.push({ at: iso(), by: u.id, snapshot: snap(st, sc), event: 'Released for batch' });
      log(st, u, 'Released for batch', sc, `${d.order.id} · snapshot ${snap(st, sc)}`); return ok(`${d.order.id} released for batch production.`);
    },
    startProduction(st, u, o) { const sc = o.scen || st.scen, d = st[sc]; if (!can(u, 'scan')) return deny(u, 'start production'); if (!d.order.released) return E('Order not released for batch'); const g = gates(st, sc)[3]; if (g.blockers.length) return E('G3 blocked: ' + g.blockers[0].msg); d.order.inProduction = true; log(st, u, 'Production started', sc, d.order.id); return ok('Production started. G3 continuation evaluated on every event.'); },
    changeProgram(st, u) {
      if (!can(u, 'program.change')) return deny(u, 'change placement programs');
      const a = st.A; if (a.conflict.status !== 'resolved') return E('Resolve CTQ-U3-ORI first');
      const from = a.prog.placement.rev, to = 'r' + (parseInt(from.slice(1), 10) + 1);
      a.prog.placement = { id: 'PLC-MB-A', rev: to, hash: hash('plc' + to + st.seq) };
      const id = 'IR-' + pad(++st.seq, 3);
      a.impacts.push({ id, changed: `PLC-MB-A ${from} → ${to}`, reason: 'ECO-118 feeder optimisation (simulated)', ctqs: ['CTQ-U3-ORI', 'CTQ-BOM-MPN'], exposed: a.order.inProduction ? 'Units built since release: 0' : 'No units built yet', at: iso(), by: u.id, status: 'Open' });
      let held = '';
      if (a.order.released || a.order.inProduction) { a.order.released = false; a.order.inProduction = false; a.holds.push({ id: 'H-' + st.seq, reason: `Impact review ${id}: PLC-MB-A ${from} → ${to}`, scope: 'Order WO-24817', at: iso(), by: 'System', status: 'Active' }); a.releaseHistory.push({ at: iso(), by: 'System', event: 'Release suspended by ' + id, snapshot: '' }); held = ' Release suspended; hold applied.'; }
      log(st, u, 'Placement program changed', 'A', `${from} → ${to}; impact review ${id} opened; approvals now stale`, false, from, to);
      return ok(`${id} opened. Approvals bound to the old snapshot are stale.${held}`);
    },
    completeImpact(st, u, o) { if (!can(u, 'impact.review')) return deny(u, 'complete impact reviews'); const a = st.A, ir = a.impacts.find(i => i.id === o.id); if (!ir || ir.status !== 'Open') return E('No open impact review'); ir.status = 'Reverification required'; a.fa.photo = null; a.fa.approvedAt = null; log(st, u, 'Impact review assessed', 'A', `${ir.id}: reverify ${ir.ctqs.join(', ')}; FA image must be recaptured; fresh approvals required`); return ok('Affected CTQs reset to Unknown pending reverification. Recapture FA evidence, repeat setup verification and re-approve.'); },
    releaseHold(st, u, o) {
      if (!can(u, 'hold.release')) return deny(u, 'release holds');
      const sc = o.scen || st.scen, d = st[sc], h = (d.holds || []).find(x => x.id === o.id); if (!h || h.status !== 'Active') return E('Hold not active');
      if (!o.reason) return E('A disposition reason is required');
      h.status = 'Resolved'; h.resolved = { by: u.id, at: iso(), reason: o.reason };
      if (sc === 'A') a_ir_close(d);
      log(st, u, 'Hold resolved', sc, `${h.id}: ${o.reason}. Record returns to review stage, not release.`); return ok(`${h.id} resolved. The order returns to review; release must be re-requested.`);
    },
    uploadTestPlan(st, u) { if (!can(u, 'testplan.upload')) return deny(u, 'upload test plans'); const d = st.D; if (d.testPlan) return E('Test plan already agreed'); d.testPlan = { id: 'TP-MB-B 1.0', at: iso(), by: u.id, evidence: 'Customer B email 05 Oct 2026 (attached EVD-B-12)' }; d.prog.test = { id: 'TP-MB-B', rev: '1.0', hash: 'c4e912' }; log(st, u, 'Test plan agreed', 'D', 'TP-MB-B 1.0 · 14 cases · customer agreement EVD-B-12', false, 'none', 'TP-MB-B 1.0'); return ok('TP-MB-B 1.0 recorded. Configuration changed: existing approvals are stale. Import FA test results next.'); },
    importFT(st, u) { if (!(can(u, 'import.results') || can(u, 'import'))) return deny(u, 'import test results'); const d = st.D; if (!d.testPlan) return E('No agreed test method: results cannot be accepted. A missing method is a coverage gap, not a pass.'); d.ftResults = { at: iso(), by: u.id }; log(st, u, 'FT results imported', 'D', 'MB-B-FA01 TP-MB-B 1.0 run 1: 14 / 14'); return ok('Functional results imported: 14 / 14 passed.'); },
    requestNA(st, u, o) { if (!can(u, 'ctq.edit')) return deny(u, 'request Not applicable'); const d = st.D; d.naAttempts.push({ at: iso(), by: u.id, reason: o.reason || '' }); log(st, u, 'Not applicable request rejected', 'D', 'CTQ-B-FT: route R-MB-B v2 includes functional test', true); return E('Rejected: Not applicable needs a route-based reason. Route R-MB-B v2 includes functional test, so CTQ-B-FT stays Unknown. Change the route (with QA approval) or route a concession.'); },
    requestConcession(st, u, o) {
      if (!can(u, 'concession.request')) return deny(u, 'request concessions'); const d = st.D; if (d.concession && concessionStatus(st) !== 'Expired') return E('A concession is already in progress');
      if (!o.controls || !o.qty || !o.days) return E('Scope, quantity, expiry and compensating controls are all required');
      d.concession = { id: 'CON-' + pad(++st.seq, 3), scope: o.scope || 'First article + batch WO-24831', qty: +o.qty, expiry: addDays(st, +o.days), controls: o.controls, approvals: { qa: null, cust: null }, by: u.id, at: iso(), nonWaivable: 'Hidden-joint X-ray, firmware verify' };
      log(st, u, 'Concession requested', 'D', `${d.concession.id}: CTQ-B-FT · qty ${o.qty} · expires ${fmtD(d.concession.expiry)}`); return ok(d.concession.id + ' requested. Needs QA and Customer B approval.');
    },
    approveConcession(st, u) { const d = st.D, c = d.concession; if (!c) return E('No concession'); if (can(u, 'concession.approve')) { if (c.by === u.id) return E('Requester cannot approve own concession'); c.approvals.qa = { by: u.id, at: iso() }; } else if (can(u, 'sign.cust')) { if (u.customer !== d.order.customer) return E('Only Customer B approvers can approve this concession', { code: 403 }); c.approvals.cust = { by: u.id, at: iso() }; } else return deny(u, 'approve concessions'); log(st, u, 'Concession approved', 'D', c.id); return ok(c.id + ' approval recorded. ' + (concessionStatus(st) === 'Active' ? 'Concession active; CTQ-B-FT remains Unknown.' : 'Awaiting the other approver.')); },
    advanceClock(st, u, o) { st.clock += o.days || 15; log(st, u, 'Simulated date advanced', st.scen, '+' + (o.days || 15) + ' days → ' + fmtD(demoDate(st))); return ok('Simulated date is now ' + fmtD(demoDate(st))); },
    resetClock(st, u) { st.clock = 0; log(st, u, 'Simulated date reset', st.scen, fmtD(demoDate(st))); return ok('Simulated date reset'); },
    // B
    queryB(st, u, o) { st.B.query = { type: o.type || 'auto', value: o.value }; const r = queryB(o.type, o.value); if (r.kind === 'serial') st.B.selSerial = r.serial.serial; log(st, u, 'Genealogy query', 'B', `${o.value} → ${r.kind === 'serial' ? 'serial' : (r.total || 0) + ' boards'}`); return { ok: true }; },
    manifestB(st, u) { const q = st.B.query; const r = queryB(q.type, q.value); if (!r.total) return E('Run an exposure query first'); st.B.manifest = { id: 'MAN-' + pad(++st.seq, 4), at: iso(), by: u.id, query: q.value, total: r.total, exact: r.exact.length, uncertain: r.uncertain.length, shipped: r.shipped, stock: r.stock, confirmed: r.confirmed }; log(st, u, 'Affected-unit manifest generated', 'B', `${st.B.manifest.id}: ${r.total} serials (${r.confirmed} confirmed, ${r.total - r.confirmed} potentially exposed)`); return ok(`${st.B.manifest.id} generated: ${r.total} serials.`); },
    holdB(st, u) { if (!can(u, 'hold')) return deny(u, 'apply holds'); const b = st.B; if (!b.manifest) return E('Generate the affected-unit manifest first'); if (b.holds.some(h => h.status === 'Active')) return E('Scoped hold already active'); b.holds.push({ id: 'H-B-' + pad(++st.seq, 3), reason: 'U3 orientation exposure · ' + b.manifest.id, scope: `${b.manifest.stock} serials in finished-goods stock (manifest ${b.manifest.id})`, at: iso(), by: u.id, status: 'Active', count: b.manifest.stock }); b.holdAt = iso(); b.recall = { shipped: b.manifest.shipped, status: 'Authorized recall / containment review requested', at: iso() }; b.containedAt = iso(); log(st, u, 'Scoped hold applied', 'B', `${b.manifest.stock} stock serials held; ${b.manifest.shipped} shipped serials flagged for recall review; unrelated units unchanged`); return ok(`${b.manifest.stock} stock serials held; ${b.manifest.shipped} shipped serials flagged for authorized recall review.`); },
    hypB(st, u, o) { const h = st.B.hyps.find(x => x.id === o.id); if (!h) return E('Unknown hypothesis'); if (o.status === 'validated' || o.status === 'rejected') { if (!can(u, 'hyp.validate')) return deny(u, 'validate or reject causal hypotheses (QA)'); } else if (!can(u, 'ncr.edit')) return deny(u, 'edit NCR'); const before = h.status; h.status = o.status; h.by = u.id; h.at = iso(); log(st, u, 'Hypothesis ' + o.status, 'B', h.id + ': ' + h.text, false, before, o.status); return ok(h.id + ' marked ' + o.status + '.'); },
    aiDraftB(st, u) { st.B.aiDraft = { at: iso(), by: 'RCA assistant (synthetic)', status: 'Draft pending QA review' }; log(st, null, 'AI correction-report draft generated', 'B', 'Draft pending QA review; cites EVD-212, 219, 221, 224, 230'); return ok('Draft generated and marked "Draft pending QA review".'); },
    aiSign(st, u) { log(st, null, 'AI attempted signature', st.scen, 'Rejected: AI cannot sign, close actions or certify root cause', true); return E('Rejected: AI cannot sign, approve, close actions or certify a root cause. A QA user must review.'); },
    // C
    ackAlert(st, u) { if (!can(u, 'pred.ack') && !can(u, 'spc.annotate')) return deny(u, 'acknowledge SPC alerts'); st.C.spc.ack = { by: u.id, at: iso() }; log(st, u, 'SPC alert acknowledged', 'C', 'Paste volume U7: rules R3/R2 fired; stencil and paste review assigned to Anika Rao'); return ok('Alert acknowledged and assigned.'); },
    annotate(st, u, o) { if (!can(u, 'spc.annotate')) return deny(u, 'annotate charts'); if (!o.text) return E('Annotation text required'); st.C.spc.annotations.push({ i: o.i, text: o.text, by: u.name }); log(st, u, 'Chart annotated', 'C', `Point ${o.i + 1}: ${o.text}`); return ok('Annotation added.'); },
    refreezeBaseline(st, u) { if (!can(u, 'baseline.freeze')) return deny(u, 'freeze SPC baselines'); log(st, u, 'Baseline recalculation refused', 'C', 'Limits are frozen; not recalculated after a defect', true); return E('Not allowed under rule set SPC-RULES v1.0: baselines are reviewed and frozen by the process engineer and are not recalculated automatically after a defect.'); },
    reworkStep(st, u) {
      const rw = st.C.rework, s = rw.step + 1; if (rw.step >= 6) return E('Rework loop complete');
      const need = [null, 'hold', 'rework.instruct', 'rework.exec', 'rework.exec', 'disposition'][rw.step];
      const what = ['', 'open NCR and hold', 'issue rework instructions', 'execute rework', 'perform repeat inspection and test', 'record independent disposition'][rw.step];
      if (!can(u, need)) return deny(u, what);
      if (rw.step === 5 && rw.steps[3].who === u.name) return E('Independent disposition required: technician cannot disposition own rework');
      rw.steps[rw.step] = Object.assign(rw.steps[rw.step], { who: u.name, at: iso(), note: rw.step === 4 ? 'AOI re-inspection pass; FT attempt 2: 18 / 18 (attempt 1 failure preserved)' : 'Accepted after rework; returned to good stock; first-pass failure retained' });
      rw.step = s; if (s === 6) log(st, u, 'Rework dispositioned', 'C', 'MB-C-0042 accepted; hold H-C-014 released; first-pass failure preserved'); else log(st, u, 'Rework step completed', 'C', 'MB-C-0042 · ' + rw.steps[s - 1].k);
      return ok(s === 6 ? 'MB-C-0042 dispositioned. K21 now 75.0%; FPY unchanged.' : rw.steps[s - 1].k + ' recorded.');
    },
    xray0117(st, u) { if (!can(u, 'check')) return deny(u, 'run inspections'); st.C.xray0117 = true; log(st, u, 'Required check completed', 'C', 'MB-C-0117 X-ray XR-1188: accepted'); return ok('MB-C-0117 X-ray recorded.'); },
    releaseDispatch(st, u) { if (!can(u, 'release')) return deny(u, 'authorize dispatch release'); const g = gates(st, 'C')[4]; const bl = g.blockers; if (bl.length) { st.C.attempts.push({ at: iso(), by: u.id }); log(st, u, 'Dispatch release rejected', 'C', bl.map(b => b.code).join('; '), true); return E(`Dispatch blocked: ${bl.length} blocker(s).`, { blockers: bl }); } const r = recon(st); st.C.dispatch = { id: 'SHP-3001', at: iso(), by: u.id, qty: r.good, excluded: r.held ? ['MB-C-0042'] : [] }; log(st, u, 'Released for dispatch', 'C', `SHP-3001 · ${r.good} boards${r.held ? ' · MB-C-0042 excluded (held)' : ''}`); return ok(`SHP-3001 released: ${r.good} boards${r.held ? '; held MB-C-0042 excluded' : ''}.`); },
    predAck(st, u, o) { if (!can(u, 'pred.ack')) return deny(u, 'acknowledge predictions'); st.C.pred.ack[o.key] = { by: u.id, at: iso(), action: o.action || 'Acknowledged' }; log(st, u, 'Prediction ' + (o.action || 'acknowledged'), 'C', o.key); return ok('Recorded. Prediction cannot change settings or waive CTQs.'); },
    // E
    agreeE(st, u) { if (!can(u, 'effect.review')) return deny(u, 'agree validation exposure (QA)'); st.E.capa.agreed = { by: u.id, at: iso() }; log(st, u, 'Validation exposure agreed', 'E', '600 independent observations; 90-day customer return window'); return ok('Validation exposure and observation period agreed.'); },
    recurrenceE(st, u, o) { const l = st.E.lots[2]; l.fails = o.on ? 1 : 0; st.E.capa.recurrence = !!o.on; log(st, u, o.on ? 'Recurrence simulated' : 'Recurrence removed', 'E', 'LOT-V-03 confirmed U3 orientation defects: ' + l.fails); return ok(o.on ? 'LOT-V-03 now has 1 confirmed U3 defect.' : 'Recurrence removed.'); },
    reviewE(st, u) {
      if (!can(u, 'effect.review')) return deny(u, 'record effectiveness reviews (QA)');
      const cap = st.E.capa; if (cap.actions.some(a => a.owner === u.id)) return E(`Independent review required: ${u.name} owns a corrective action on ${cap.id}.`);
      const crit = criteriaE(st), failed = crit.filter(c => !c.pass);
      cap.review = { by: u.id, at: iso(), pass: !failed.length, failed: failed.map(c => c.id) };
      if (failed.length) { cap.reopened = true; log(st, u, 'Effectiveness review failed', 'E', 'Criteria not met: ' + failed.map(c => c.id).join(', ') + '; CAPA reopened, horizontal assessment triggered'); return E(`Effectiveness not demonstrated (${failed.map(c => c.id).join(', ')}). CAPA reopened.`); }
      cap.reopened = false; log(st, u, 'Effectiveness review passed', 'E', 'All 7 predefined criteria met; residual risk recorded'); return ok('Effectiveness review passed. QA may now close the CAPA.');
    },
    closeE(st, u) { if (!can(u, 'capa.close')) return deny(u, 'close CAPA'); const cap = st.E.capa; if (!cap.review) { log(st, u, 'CAPA closure rejected', 'E', 'No effectiveness review', true); return E('Implementation alone cannot close a CAPA. Independent effectiveness review has not been recorded.'); } if (!cap.review.pass) { log(st, u, 'CAPA closure rejected', 'E', 'Effectiveness review failed', true); return E('Closure blocked: effectiveness review failed. CAPA remains open.'); } if (criteriaE(st).some(c => !c.pass)) return E('Closure blocked: criteria changed since review'); cap.closed = { by: u.id, at: iso() }; log(st, u, 'CAPA closed', 'E', cap.id); return ok(cap.id + ' closed.'); },
    // F
    previewF(st, u, o) { const f = FILES[o.file]; const rows = f.rows(); const c = classify(st, rows, iso()); st.F.preview = { file: o.file, at: iso(), counts: countCls(c) }; return { ok: true }; },
    commitF(st, u, o) {
      if (!can(u, 'import')) return deny(u, 'import files (Administrator)');
      const F = FILES[o.file], rows = F.rows(), now = iso(), c = classify(st, rows, now), f = st.F, cs = countCls(c);
      const checksum = 'sha256:' + hash(F.name + JSON.stringify(rows)) + hash(F.name);
      c.forEach(x => {
        if (x.cls === 'new' || x.cls === 'late-critical') f.events[rowKey(x.row)] = rowSig(x.row);
        if (x.cls === 'quarantine') f.quarantine.push({ file: F.name, line: x.row.line, event_id: x.row.event_id, reason: x.reason, at: now });
        if (x.cls === 'conflict') f.review.push({ file: F.name, line: x.row.line, event_id: x.row.event_id, reason: x.reason, at: now, status: 'Review' });
        if (x.cls === 'late-critical') {
          f.late++;
          const id = 'INC-F-' + pad(++st.seq, 3);
          f.incidents.push({ id, serial: x.row.board_serial, at: now, eventTime: x.row.event_time, text: `${x.row.board_serial} ${x.row.value} (${x.row.ctq}) recorded ${fmtT(x.row.event_time)}, ingested ${fmtT(now)}` });
          f.holds.push({ id: 'H-F-' + st.seq, reason: id + ': late critical failure', scope: x.row.board_serial + ' and LOT-F-01 boards tested on FT-02 after 14:00 on 1 Oct', at: now, by: 'System', status: 'Active' });
          f.shipment.exposure = { serial: x.row.board_serial, at: now, status: 'Dispatched exposure flagged for authorized recall / containment review' };
          f.shipment.history.push({ at: now, event: `Re-evaluated after late evidence (${id}); prior release record preserved`, by: 'System' });
          log(st, null, 'Late critical failure escalated', 'F', `${id}: hold applied; SHP-3101 dispatched exposure flagged`);
        }
      });
      f.imports.push({ id: 'IMP-' + pad(f.imports.length + 1, 3), file: F.name, at: now, by: u.id, checksum, counts: cs });
      f.preview = null;
      log(st, u, 'File imported', 'F', `${F.name}: ${cs.new} new, ${cs.duplicate} duplicate, ${cs.quarantine} quarantined, ${cs.conflict} conflict, ${cs['late-critical']} late critical`);
      return ok(`${F.name}: ${cs.new + cs['late-critical']} accepted, ${cs.duplicate} duplicates ignored, ${cs.quarantine} quarantined, ${cs.conflict} to review.`);
    },
    resolveConflictF(st, u, o) { if (!can(u, 'disposition')) return deny(u, 'resolve conflicting duplicates (QA)'); const r = st.F.review.find(x => x.event_id === o.id && x.status === 'Review'); if (!r) return E('Nothing to resolve'); r.status = 'Kept original · new value rejected'; r.by = u.id; log(st, u, 'Conflicting duplicate resolved', 'F', r.event_id + ': original kept'); return ok('Original event kept; conflicting value recorded as rejected.'); },
    // config
    setConfig(st, u, o) { if (!can(u, 'config')) return deny(u, 'change configuration (Administrator)'); const before = st.config[o.key]; st.config[o.key] = o.value; log(st, u, 'Configuration changed', st.scen, o.key, false, String(before), String(o.value)); return ok('Configuration updated.'); },
    proposeLimit(st, u, o) { if (!can(u, 'limits.propose')) return deny(u, 'propose limit changes'); const l = st.config.limits.find(x => x.id === o.id); if (!o.reason) return E('A reason is required to change a limit'); if (isNaN(+o.usl) || isNaN(+o.lsl) || +o.usl <= +o.lsl) return E('Invalid limits'); l.pending = { lsl: +o.lsl, usl: +o.usl, reason: o.reason, by: u.id, at: iso() }; log(st, u, 'Limit change proposed', st.scen, `${l.param}: ${l.lsl} to ${l.usl} → ${o.lsl} to ${o.usl} · ${o.reason}`); return ok('Proposed; QA approval required.'); },
    approveLimit(st, u, o) { if (!can(u, 'limits.approve')) return deny(u, 'approve limit changes (QA)'); const l = st.config.limits.find(x => x.id === o.id); if (!l.pending) return E('Nothing pending'); if (l.pending.by === u.id) return E('Proposer cannot approve own change'); const before = `${l.lsl} to ${l.usl}`; l.lsl = l.pending.lsl; l.usl = l.pending.usl; l.rev++; l.by = uname(l.pending.by); const reason = l.pending.reason; l.pending = null; log(st, u, 'Limit change approved', st.scen, `${l.param} rev ${l.rev}: ${reason}`, false, before, `${l.lsl} to ${l.usl}`); return ok('Limit revised; analytics recomputed.'); },
    editAudit(st, u) { log(st, u, 'Audit edit attempt rejected', st.scen, 'Audit trail is append-only', true); return E('Rejected: the audit trail is append-only through application APIs.', { code: 405 }); }
  };
  function a_ir_close(a) { a.impacts.forEach(i => { if (i.status === 'Reverification required') i.status = 'Closed'; }); }
  function countCls(c) { const o = { new: 0, duplicate: 0, quarantine: 0, conflict: 0, 'late-critical': 0, rows: c.length }; c.forEach(x => o[x.cls]++); return o; }
  function criteriaE(st) {
    const e = st.E, cap = e.capa, fails = e.lots.reduce((s, l) => s + l.fails, 0), checks = e.lots.reduce((s, l) => s + l.checks, 0), ev = e.lots.reduce((s, l) => s + l.evidence, 0);
    return [
      { id: 'EC1', text: 'Corrected orientation mapping validated; detection challenge cases detected', pass: true, ev: 'CH-U3-ORI-01 12 / 12' },
      { id: 'EC2', text: 'All required U3 placements inspected', pass: checks === 600, ev: checks + ' / 600' },
      { id: 'EC3', text: 'Three consecutive 200-board lots across relevant setups and shifts', pass: e.lots.length === 3, ev: 'SET-1102, SET-1107 · shifts A, B, C' },
      { id: 'EC4', text: 'Zero confirmed U3 orientation defects', pass: fails === 0, ev: fails + ' confirmed' },
      { id: 'EC5', text: '100% required evidence', pass: ev === checks, ev: ev + ' / ' + checks },
      { id: 'EC6', text: 'No unauthorized bypass', pass: e.lots.every(l => !l.bypass), ev: '0 bypasses' },
      { id: 'EC7', text: 'QA agreed validation exposure, independence assumptions and customer return observation period', pass: !!cap.agreed, ev: cap.agreed ? uname(cap.agreed.by) + ' · ' + fmtD(cap.agreed.at) : 'Pending' }
    ];
  }

  /* ---------- readiness ---------- */
  const READINESS = [
    { field: 'Actual U3 MPN, datasheet and package drawing', kpis: 'K01 · G0', owner: 'Customer engineering', method: 'Controlled document upload', freq: 'Once per revision', due: '16 Oct 2026', status: 'Missing' },
    { field: 'Independent AOI audit labels', kpis: 'K14', owner: 'QA', method: 'Blind audit set with confirmed labels', freq: 'Monthly', due: '31 Oct 2026', status: 'Missing' },
    { field: 'Placement telemetry (actual X / Y / rotation)', kpis: 'K10 · S06', owner: 'Process engineering', method: 'Machine export sample', freq: 'Per lot', due: '23 Oct 2026', status: 'Proxy' },
    { field: 'Continuous oven log', kpis: 'K12', owner: 'Process engineering', method: 'Oven CSV export', freq: 'Continuous', due: '23 Oct 2026', status: 'Proxy' },
    { field: 'SPI numeric export with pad IDs', kpis: 'K08 · K09 · SPC', owner: 'Process engineering', method: 'SPI CSV', freq: 'Per panel', due: '16 Oct 2026', status: 'Synthetic demo' },
    { field: 'Agreed functional test plan, MB-5110', kpis: 'K02 · K20 · G0 / G2', owner: 'Customer B', method: 'Agreed test plan + email', freq: 'Once', due: '12 Oct 2026', status: 'Missing' },
    { field: 'Cleanliness lab results', kpis: 'K19', owner: 'QA', method: 'External lab report', freq: 'Per lot', due: 'None', status: 'Not applicable' },
    { field: 'Customer returns with serials', kpis: 'K24', owner: 'Customer quality', method: 'Complaint form + serial scan', freq: 'Per event', due: '16 Oct 2026', status: 'Manual verified data' },
    { field: 'Time synchronisation source', kpis: 'All event joins', owner: 'Plant IT', method: 'NTP confirmation', freq: 'Once', due: '12 Oct 2026', status: 'Missing' },
    { field: 'Shipment manifest serial scan', kpis: 'K22 · G4', owner: 'Logistics', method: 'Scan at pack-out', freq: 'Per shipment', due: '16 Oct 2026', status: 'Manual verified data' }
  ];
  const CONNECTORS = [
    { name: 'AOI-L2', kind: 'CSV drop', last: '6 min ago', status: 'Live' }, { name: 'SPI-01', kind: 'CSV drop', last: '4 min ago', status: 'Live' },
    { name: 'Reflow profiler', kind: 'File upload', last: '5 h ago (periodic)', status: 'Periodic' }, { name: 'Oven telemetry', kind: 'None', last: 'None', status: 'Not connected' },
    { name: 'Tester FT-01', kind: 'CSV drop', last: '11 min ago', status: 'Live' }, { name: 'Tester FT-02', kind: 'CSV drop', last: '3 h 10 min ago', status: 'Stale' },
    { name: 'ERP / stores', kind: 'Manual CSV', last: 'Yesterday 18:20', status: 'Manual' }
  ];
  const GAPS = [
    { obs: 'First-article flow allows appearance and solder checks when no functional SOP exists', resp: 'Explicit test-coverage gap; agreed plan or controlled concession', where: 'Scenario D', status: 'Implemented' },
    { obs: 'Batch flow calls for 100% functional testing', resp: 'One revision-controlled test applicability matrix for FA and production', where: 'Engineering, Route configuration', status: 'Confirm with plant' },
    { obs: 'DIP Yes branch appears to bypass insertion; labels look reversed', resp: 'Proposed: Yes → insertion / wave; No → depanel / clean (configurable)', where: 'Route configuration', status: 'Confirm with plant' },
    { obs: 'AOI / X-ray location near placement and reflow is ambiguous', resp: 'Separate station positions; post-reflow solder inspection', where: 'Route configuration', status: 'Confirm with plant' },
    { obs: 'Placement program creation refers to Gerber files', resp: 'Approved manufacturing package and explicit orientation mapping', where: 'Scenario A', status: 'Implemented' },
    { obs: 'AOI checks listed do not include U3 Pin 1', resp: 'Coverage matrix by component, failure mode, method and program version', where: 'Engineering', status: 'Implemented' },
    { obs: 'Dual review and customer approval at first article', resp: 'Approvals bound to snapshot hashes; self-approval rejected', where: 'First article', status: 'Implemented' },
    { obs: 'Rework, holds, traceability and effectiveness checks not shown', resp: 'Genealogy, quarantine, repeat verification and CAPA follow-through', where: 'Production, Traceability, NCR', status: 'Implemented' }
  ];
  const PILOT_REQ = ['Approved BOM for one representative product', 'Exact U3 MPN / datasheet and package drawing', 'Assembly / placement files and rotation conventions', 'The actual 8D report', 'First-article report and approvals', 'One AOI, X-ray and test export with images', 'Qualified reflow profile', 'Serial / panel genealogy', 'Three representative lot histories incl. defects and rework', 'PFMEA and control plan', 'Dispatch and complaint links', 'Machine models and export capabilities'];
  const PILOT_CONFIRM = ['Functional test responsibility when no customer SOP exists', 'Applicable workmanship criteria, class and revision', 'X-ray extent', 'Authority for concessions and release', 'Retention and access rules', 'Time synchronisation source', 'Permitted process interlocks'];

  const GUIDE = [
    { scen: 'A', screen: 'command', persona: 'marta', title: 'Open the U3 risk', say: 'WO-24817: 1,200 boards of MB-7420 rev C. Release is blocked; CTQ coverage is below target.', do: 'Point at the release status and the K01 / K02 tiles.' },
    { scen: 'A', screen: 'release', persona: 'daniel', title: 'Attempt release', say: 'QA tries to release. The evaluator returns a structured blocker list with CTQ, owner and action.', do: 'Click "Request batch release".' },
    { scen: 'A', screen: 'eng', persona: 'anika', title: 'Resolve the orientation conflict', say: 'Silkscreen or Gerber alone is not accepted. The engineer reconciles against the package drawing and records the locator.', do: 'Try resolving with Silkscreen first, then with the package drawing.' },
    { scen: 'A', screen: 'eng', persona: 'anika', title: 'Validate AOI coverage', say: '100% inspection is not 100% detection. Add the Pin 1 feature, then prove it with a challenge set.', do: 'Add Pin 1 feature, then run the challenge set.' },
    { scen: 'A', screen: 'fa', persona: 'ravi', title: 'Setup and first-article evidence', say: 'Wrong reel and stale program are caught before the first article is built.', do: 'Run setup check, rescan slot 14, load program; switch to Daniel to verify. Capture image, import results.' },
    { scen: 'A', screen: 'fa', persona: 'kiran', title: 'Independent approvals', say: 'Kiran holds engineering and QA delegate roles. He cannot sign both.', do: 'Sign engineering as Kiran, then try QA as Kiran. Then sign QA as Daniel, customer as Lena.' },
    { scen: 'A', screen: 'release', persona: 'daniel', title: 'Release for batch', say: 'All gates pass with distinct, current approvals.', do: 'Request batch release.' },
    { scen: 'A', screen: 'eng', persona: 'anika', title: 'Revision change', say: 'A program change after sign-off makes approvals stale and suspends release.', do: 'Click "Simulate program change" and look at G3 on Release.' },
    { scen: 'B', screen: 'trace', persona: 'daniel', title: 'Expose the historical escape', say: 'Confirmed 1 versus potentially exposed 1,200. Incomplete genealogy broadens scope.', do: 'Query CMP-0017, then R-U3-5521. Generate manifest and apply scoped hold.' },
    { scen: 'B', screen: 'ncr', persona: 'daniel', title: 'Occurrence versus escape', say: 'Each gate is classified: not run, not capable, misconfigured, missed, overridden or unknown.', do: 'Walk the escape map; generate the AI draft and try to sign it.' },
    { scen: 'C', screen: 'spc', persona: 'anika', title: 'Drift before defect', say: 'Rule R3 fires several points before the specification crossing.', do: 'Point at the first alert marker and the USL crossing.' },
    { scen: 'C', screen: 'pred', persona: 'anika', title: 'Predictive explanation', say: 'Three different outputs: rule blockers, SPC warnings and a labelled synthetic model.', do: 'Move the as-of slider; toggle the leakage feature to see refusal.' },
    { scen: 'B', screen: 'release', persona: 'daniel', title: 'Correction report and manifest', say: 'Reports carry evidence links, scope, synthetic badges and as-of dates.', do: 'Open the 8D correction report; download the manifest CSV.' },
    { scen: 'E', screen: 'ncr', persona: 'daniel', title: 'Verify and close', say: '600 checks, zero failures; closure needs independent review against predefined criteria.', do: 'Try closing first. Agree exposure, review, then close. Optionally inject recurrence.' },
    { scen: 'F', screen: 'data', persona: 'sam', title: 'Data readiness and pilot boundary', say: 'Duplicates do not inflate counts; bad rows quarantine; late failures escalate.', do: 'Import AOI twice, then SPI, then the late FT file. End on the readiness checklist.' }
  ];

  /* ---------- acceptance tests ---------- */
  function runAT() {
    const R = [];
    const U = USERS;
    const t = (id, name, fn) => { try { const r = fn(); R.push({ id, name, pass: !!r.pass, detail: r.detail }); } catch (e) { R.push({ id, name, pass: false, detail: 'Exception: ' + e.message }); } };
    const A = (st, uid, n, o) => ACT[n](st, U[uid], Object.assign({ scen: st.scen }, o || {}));
    const toFA = st => { st.scen = 'A'; A(st, 'anika', 'resolveConflict', { source: 'DOC-PKG', locator: 'PKG-U3 rev 3 §2' }); A(st, 'anika', 'addAoiPin1'); A(st, 'anika', 'runChallenge'); A(st, 'ravi', 'setupCheck'); A(st, 'ravi', 'rescan'); A(st, 'ravi', 'loadProgram'); A(st, 'daniel', 'verifySetup'); A(st, 'ravi', 'capture', { mode: 'asPlaced' }); A(st, 'ravi', 'importResults'); };
    t('AT01', 'U3 ambiguity', () => { const st = seed(); const r = A(st, 'daniel', 'releaseBatch', { scen: 'A' }); const b = (r.blockers || []).find(x => x.code === 'ORI-CONFLICT'); const noAppr = Object.values(st.A.fa.approvals).every(x => !x); return { pass: !r.ok && b && b.ctq === 'CTQ-U3-ORI' && b.owner && noAppr, detail: r.ok ? 'Release succeeded unexpectedly' : `Rejected with ${r.blockers.length} blockers; ${b.ctq} · ${b.code} · owner ${b.owner}; no approvals fabricated` }; });
    t('AT02', 'Independent approval', () => { const st = seed(); toFA(st); const e = A(st, 'kiran', 'sign', { kind: 'eng' }); const q = A(st, 'kiran', 'sign', { kind: 'qa' }); const api = ACT.sign(st, U.kiran, { scen: 'A', kind: 'qa' }); return { pass: e.ok && !q.ok && !api.ok && !st.A.fa.approvals.qa, detail: `UI: ${q.error} · Direct API call: HTTP ${api.code} rejected` }; });
    t('AT03', 'Revision change', () => { const st = seed(); toFA(st); A(st, 'anika', 'sign', { kind: 'eng' }); A(st, 'daniel', 'sign', { kind: 'qa' }); A(st, 'lena', 'sign', { kind: 'cust' }); const r1 = A(st, 'daniel', 'releaseBatch'); A(st, 'anika', 'changeProgram'); const g3 = gates(st, 'A')[3]; const r2 = A(st, 'daniel', 'releaseBatch'); return { pass: r1.ok && g3.status === 'Blocked' && g3.blockers.some(b => b.code === 'REVISION-CHANGE') && !r2.ok, detail: `Released, then PLC-MB-A ${st.A.prog.placement.rev}: G3 ${g3.status} (${g3.blockers.length} blockers); re-release rejected` }; });
    t('AT04', 'Missing SOP and N/A', () => { const st = seed(); st.scen = 'D'; const ft0 = checklist(st, 'D').find(c => c.id === 'CTQ-B-FT').result; const na = A(st, 'anika', 'requestNA', { reason: 'no SOP' }); A(st, 'anika', 'requestConcession', { qty: 300, days: 14, controls: '100% boot + rails' }); A(st, 'daniel', 'approveConcession'); A(st, 'tom', 'approveConcession'); const c = checklist(st, 'D').find(x => x.id === 'CTQ-B-FT'); return { pass: ft0 === 'Unknown' && !na.ok && c.result === 'Unknown' && c.concession && concessionStatus(st) === 'Active', detail: `FT ${ft0}; N/A rejected; concession ${c.concession} ${concessionStatus(st)}; FT still ${c.result}` }; });
    t('AT05', 'Genealogy', () => { const a = queryB('', 'SET-0918'), b = queryB('', 'R-U3-5521'); return { pass: a.total === 1200 && a.uncertain.length === 0 && b.exact.length === 776 && b.uncertain.length === 24, detail: `Setup query: ${a.total} exact. Reel query: ${b.exact.length} linked + ${b.uncertain.length} uncertain = ${b.total}` }; });
    t('AT06', 'Import and retries', () => { const st = seed(); st.scen = 'F'; A(st, 'sam', 'commitF', { file: 'aoi' }); const n1 = importStats(st).accepted; A(st, 'sam', 'commitF', { file: 'aoi' }); const n2 = importStats(st).accepted; A(st, 'sam', 'commitF', { file: 'spi' }); const q = st.F.quarantine.length, cf = st.F.review.length; st.scen = 'C'; A(st, 'ravi', 'reworkStep'); A(st, 'daniel', 'reworkStep'); const k = kpis(st, 'C'); const g = id => k.find(x => x.id === id).value; return { pass: n1 === 12 && n2 === 12 && q === 4 && cf === 1 && g('K20') === 90 && g('K21') === 75 && g('FY') === 97.5 && g('K23') === 85, detail: `Accepted ${n1} → ${n2} after replay; ${q} quarantined, ${cf} conflict; K20 ${g('K20')}%, K21 ${g('K21')}%, final ${g('FY')}%, K23 ${g('K23')}%; 20 original failures preserved` }; });
    t('AT07', 'SPC and AI', () => { const st = seed(); const s = spcPaste(st); const fut = predict(st, { useCase: 'risk', asOf: 99 }); const leak = predict(st, { useCase: 'risk', asOf: 50, leak: true }); const okp = predict(st, { useCase: 'risk', asOf: 50 }); return { pass: s.firstAlert !== null && s.cross !== null && s.firstAlert < s.cross && !fut.available && !leak.available && /Synthetic/.test(okp.status), detail: `First alert at point ${s.firstAlert + 1}, USL crossing at ${s.cross + 1}; future and leakage refused; status "${okp.status}"` }; });
    t('AT08', 'Scoped holds', () => { const st = seed(); st.scen = 'C'; A(st, 'ravi', 'xray0117'); st.config.mixedShipment = 'block'; const r1 = A(st, 'daniel', 'releaseDispatch'); const good0 = recon(st).good; st.config.mixedShipment = 'exclude'; const r2 = A(st, 'daniel', 'releaseDispatch'); const good1 = recon(st).good; return { pass: !r1.ok && r2.ok && st.C.dispatch.excluded.includes('MB-C-0042') && good0 === good1, detail: `Block mode: rejected. Exclude mode: SHP-3001 ${st.C.dispatch.qty} boards, MB-C-0042 excluded; clean units unchanged (${good1})` }; });
    t('AT09', 'CAPA closure', () => { const st = seed(); st.scen = 'E'; const c1 = A(st, 'daniel', 'closeE'); A(st, 'daniel', 'agreeE'); A(st, 'anika', 'recurrenceE', { on: true }); const rv = A(st, 'daniel', 'reviewE'); const c2 = A(st, 'daniel', 'closeE'); return { pass: !c1.ok && !rv.ok && st.E.capa.reopened && !c2.ok, detail: `Close before review rejected; recurrence → review failed, CAPA reopened; closure blocked` }; });
    t('AT10', 'Export integrity', () => { const st = seed(); st.scen = 'C'; const k = csvText(st, 'kpis'); const kp = kpis(st, 'C'); const rows = k.split('\n').filter(l => /^K|^FY/.test(l)); st.scen = 'B'; st.B.query = { type: '', value: 'SET-0918' }; const m = csvText(st, 'manifest'); const mrows = m.split('\n').filter(l => /^MB-A-/.test(l)).length; return { pass: rows.length === kp.length && mrows === 1200 && /SYNTHETIC DEMO/.test(k) && /as-of/.test(m) && rows.every((r, i) => r.includes(kp[i].display)), detail: `KPI CSV ${rows.length} rows match screen; manifest ${mrows} rows = exposure 1,200; synthetic badge and as-of present` }; });
    t('AT11', 'Audit and roles', () => { const st = seed(); const n = st.audit.length; const r = A(st, 'sam', 'editAudit'); const lenaD = canView(st, 'command', U.lena, 'D'), tomA = canView(st, 'command', U.tom, 'A'), lenaData = canView(st, 'data', U.lena, 'A'); return { pass: !r.ok && st.audit.length === n + 1 && !lenaD && !tomA && !lenaData, detail: `Edit rejected (HTTP ${r.code}) and itself logged; Customer A blocked from Customer B records and vice versa; customer blocked from configuration` }; });
    t('AT12', 'Late evidence', () => { const st = seed(); st.scen = 'F'; const h0 = st.F.shipment.history.length; A(st, 'sam', 'commitF', { file: 'late' }); const s = st.F; return { pass: s.incidents.length === 1 && s.holds.some(h => h.status === 'Active') && s.shipment.exposure && s.shipment.history.length === h0 + 1 && s.shipment.history[0].event.startsWith('Released'), detail: `${s.incidents[0].id} created; hold active; SHP-3101 exposure flagged; original release record preserved (${h0} → ${s.shipment.history.length} history entries)` }; });
    return R;
  }

  /* ---------- CSV ---------- */
  function csvEsc(v) { v = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csvText(st, kind) {
    const sc = st.scen, d = st[sc], head = [`# ProcessGrit PCBA Quality Intelligence · SYNTHETIC DEMO · as-of ${iso()} · scenario ${sc} ${SCEN[sc].name} · order ${d.order.id} · ${d.order.product} rev ${d.order.rev}`];
    let rows = [];
    if (kind === 'kpis') { rows.push(['id', 'name', 'numerator', 'denominator', 'value', 'badge', 'cohort', 'exclusions', 'note']); kpis(st, sc).forEach(k => rows.push([k.id, k.name, k.num ?? '', k.den ?? '', k.display, k.badge, k.cohort || '', k.excl || '', k.note || ''])); }
    if (kind === 'manifest') { const q = st.B.query, r = queryB(q.type, q.value); head.push(`# Query: ${q.value} · ${r.basis}`); head.push(`# Confirmed defective: ${r.confirmed || 0} · Potentially exposed: ${(r.total || 0) - (r.confirmed || 0)}`); rows.push(['serial', 'panel', 'position', 'lot', 'reel', 'program', 'setup', 'shipment', 'status', 'scope']); r.exact.forEach(s => rows.push([s.serial, s.panel, s.pos, s.lot, s.reel || 'MISSING', s.program, s.setup, s.ship || 'FG stock', s.confirmed ? 'Confirmed defective' : 'Potentially exposed', 'Exact'])); r.uncertain.forEach(s => rows.push([s.serial, s.panel, s.pos, s.lot, 'MISSING', s.program, s.setup, s.ship || 'FG stock', 'Potentially exposed', 'Uncertain (incomplete genealogy)'])); }
    if (kind === 'quarantine') { rows.push(['file', 'line', 'event_id', 'reason', 'at']); st.F.quarantine.forEach(q => rows.push([q.file, q.line, q.event_id, q.reason, q.at])); st.F.review.forEach(q => rows.push([q.file, q.line, q.event_id, q.reason + ' [' + q.status + ']', q.at])); }
    if (kind === 'audit') { rows.push(['n', 'time', 'actor', 'role', 'action', 'scenario', 'detail', 'before', 'after', 'rejected']); st.audit.forEach(a => rows.push([a.n, a.t, a.actor, a.role, a.action, a.scen, a.detail, a.before, a.after, a.rejected ? 'yes' : ''])); }
    if (kind === 'blockers') { rows.push(['gate', 'status', 'code', 'ctq', 'message', 'owner', 'action']); gates(st, sc).forEach(g => { if (!g.blockers.length) rows.push([g.id, g.status, '', '', '', '', '']); g.blockers.forEach(b => rows.push([g.id, g.status, b.code, b.ctq || '', b.msg, b.owner || '', b.action || ''])); }); }
    if (kind === 'recon') { const b = boardsC(st); rows.push(['serial', 'panel', 'position', 'status', 'spi', 'xray', 'ft']); b.forEach(x => rows.push([x.serial, x.panel, x.pos, x.status, x.spi, x.xray, x.ft])); }
    return head.join('\n') + '\n' + rows.map(r => r.map(csvEsc).join(',')).join('\n');
  }
  function download(name, text) { const blob = new Blob([text], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  function canView(st, screen, u, sc) {
    sc = sc || st.scen; u = u || USERS[st.persona];
    if (u.roles.includes('customer')) { if (st[sc].order.customer !== u.customer) return false; return CUSTOMER_VIEW.includes(screen); }
    return true;
  }

  /* ---------- store ---------- */
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = seed();
  const subs = new Set();
  let toasts = [], ui = { dialog: null, loading: false, print: null, drawer: null };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function emit() { save(); subs.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  function toast(msg, kind) { const id = Math.random().toString(36).slice(2); toasts = toasts.concat([{ id, msg, kind: kind || 'ok' }]).slice(-2); setTimeout(() => { toasts = toasts.filter(t => t.id !== id); emit(); }, kind === 'err' ? 6000 : 3200); }


  const TONES = {
    crit: { bg: '#fef3f2', fg: '#b42318', bd: '#fecdca', dot: '#d92d20' },
    warn: { bg: '#fffaeb', fg: '#b54708', bd: '#fedf89', dot: '#f79009' },
    ok: { bg: '#ecfdf3', fg: '#067647', bd: '#abefc6', dot: '#12b76a' },
    info: { bg: '#eef0fc', fg: '#3640a8', bd: '#c7cdf5', dot: '#4f5bd5' },
    neutral: { bg: '#f2f4f7', fg: '#344054', bd: '#e4e7ec', dot: '#98a2b3' }
  };
  const TONE_WORDS = { crit: /^(blocked|fail|missing|stale|not met|rejected|expired|not capable|held|on hold|overridden|misconfigured|missed|out of spec|mismatch|high|conflict|quarantine|late critical|incomplete|no|open|active hold|reopened|refused)/i, warn: /^(unknown|pending|capable|proxy|elevated|not run|query|partial|periodic|manual|review|draft|uncertain|suspended|customer approval pending|first article pending|engineering review|ready for first article|final qa pending)/i, ok: /^(pass|met|current|validated|complete|resolved|released|yes|covered|closed|good|live|match|accepted|low|in control|stable|contained|verified|implemented|direct)/i };
  function toneOf(s) { s = String(s || ''); if (/complaint open|late evidence|effectiveness window|containment active/i.test(s)) return 'warn'; for (const k of ['crit', 'warn', 'ok']) if (TONE_WORDS[k].test(s)) return k; return 'neutral'; }
  function pill(label, tone) { const t = TONES[tone || toneOf(label)] || TONES.neutral; return { label, bg: t.bg, fg: t.fg, bd: t.bd, dot: t.dot }; }

  /* ---------- next action, drawers, KPI groups ---------- */
  function nextAction(st, sc) {
    sc = sc || st.scen; const d = st[sc];
    const mk = (title, detail, owner, screen, role) => ({ title, detail, owner, screen, role });
    if (sc === 'A' || sc === 'D') {
      const g = gates(st, sc);
      for (const x of g) if (x.blockers.length) { const b = x.blockers[0]; const role = /Operator/.test(b.owner) ? 'operator' : /QA/.test(b.owner) ? 'qa' : /Customer/.test(b.owner) ? 'customer' : 'eng'; return mk(b.action || 'Clear ' + b.code, b.msg, b.owner, b.screen || 'release', role); }
      if (!d.order.released) return mk('Request batch release', 'All evaluated gates pass with current, distinct approvals.', 'QA', 'release', 'qa');
      if (sc === 'A' && !d.order.inProduction) return mk('Start batch production', 'The order is released. G3 re-evaluates on every route event.', 'Operator', 'prod', 'operator');
      return mk('Monitor production continuation', 'G3 is clear. Any revision change suspends release automatically.', 'QA', 'prod', 'qa');
    }
    if (sc === 'B') {
      const b = st.B;
      if (!b.manifest) return mk('Generate the affected-unit manifest', 'Query the suspect setup, then generate the manifest of exposed serials.', 'QA', 'trace', 'qa');
      if (!b.holds.some(h => h.status === 'Active')) return mk('Apply a scoped hold', b.manifest.stock + ' finished-goods serials are exposed and not yet held.', 'QA', 'trace', 'qa');
      if (b.hyps.every(h => h.status === 'hypothesis')) return mk('Validate occurrence and escape hypotheses', 'All causal statements are still hypotheses.', 'QA', 'ncr', 'qa');
      return mk('Issue the 8D correction report', 'Containment is in place and hypotheses are reviewed.', 'QA', 'release', 'qa');
    }
    if (sc === 'C') {
      const c = st.C;
      if (!c.spc.ack) return mk('Acknowledge the paste-volume drift alert', 'Rules fired before the specification crossing on U7 pads.', 'Process engineer', 'spc', 'eng');
      if (c.rework.step < 6) return mk('Complete the MB-C-0042 rework loop', 'Next step: ' + c.rework.steps[c.rework.step].k.toLowerCase() + '.', c.rework.step === 5 ? 'QA' : 'Operator', 'prod', c.rework.step === 5 ? 'qa' : 'operator');
      if (!c.xray0117) return mk('Run the skipped X-ray on MB-C-0117', 'A required route check is missing and blocks dispatch.', 'Operator', 'prod', 'operator');
      if (!c.dispatch) return mk('Release LOT-D-01 for dispatch', 'Quantities reconcile and every required check is complete.', 'QA', 'release', 'qa');
      return mk('Lot dispatched', 'SHP-3001 released. Watch for late evidence.', 'QA', 'release', 'qa');
    }
    if (sc === 'E') {
      const cap = st.E.capa;
      if (cap.closed) return mk('CAPA closed', 'Monitor the customer return window.', 'QA', 'ncr', 'qa');
      if (!cap.agreed) return mk('Agree the validation exposure', 'QA must agree exposure, independence and the return observation period.', 'QA', 'ncr', 'qa');
      if (!cap.review || cap.reopened) return mk(cap.reopened ? 'Investigate the recurrence and review again' : 'Record the independent effectiveness review', 'The reviewer must be QA and must not own a corrective action.', 'QA', 'ncr', 'qa');
      return mk('Close CAPA-U3-001', 'Every predefined criterion passed in an independent review.', 'QA', 'ncr', 'qa');
    }
    const f = st.F, n = k => f.imports.filter(i => i.file === FILES[k].name).length;
    if (!n('aoi')) return mk('Import the AOI results file', 'Start the data integrity replay with twelve valid rows.', 'Administrator', 'data', 'admin');
    if (n('aoi') < 2) return mk('Replay the AOI file', 'Importing the same file again must not change any count.', 'Administrator', 'data', 'admin');
    if (!n('spi')) return mk('Import the SPI measurements', 'This file contains invalid and conflicting rows.', 'Administrator', 'data', 'admin');
    if (f.review.some(r => r.status === 'Review')) return mk('Resolve the conflicting duplicate', f.review.find(r => r.status === 'Review').reason, 'QA', 'data', 'qa');
    if (!n('late')) return mk('Import the late functional test results', 'Records from 1 Oct arrive after SHP-3101 was released.', 'Administrator', 'data', 'admin');
    return mk('Review the dispatched exposure', 'A late critical failure put MB-F-0088 on hold.', 'QA', 'release', 'qa');
  }
  const KGROUP = { K01: 'Engineering', K02: 'Engineering', K03: 'Engineering', K04: 'Engineering', K05: 'Material and setup', K06: 'Material and setup', K07: 'Material and setup', K08: 'Process', K09: 'Process', K10: 'Process', K11: 'Process', K12: 'Process', K13: 'Inspection', K14: 'Inspection', K15: 'Inspection', K16: 'Inspection', K17: 'Assembly and test', K18: 'Assembly and test', K19: 'Assembly and test', K20: 'Assembly and test', K21: 'Assembly and test', FY: 'Assembly and test', K22: 'Release', K23: 'Release', K24: 'Release', K25: 'Response', K26: 'Response', K27: 'Response', K28: 'Response', IMP: 'Response' };
  const KHIST = { C: { K08: [96.5, 97, 96, 95.5, 95.5, 95], K09: [1.9, 2.1, 2.4, 2.7, 3, 3.25], K11: [100, 100, 91.7, 100, 91.7, 91.7], K13: [74, 72.5, 73, 71, 70.5, 70.7], K20: [92, 91, 90.5, 91.5, 90, 90] }, E: { K27: [0, 0, 0] } };
  function kpiGroups(st, sc) {
    sc = sc || st.scen; const order = ['Engineering', 'Material and setup', 'Process', 'Inspection', 'Assembly and test', 'Release', 'Response'];
    const all = kpis(st, sc).map(k => { const h = (KHIST[sc] || {})[k.id]; let spark = ''; if (h && k.value !== null) { const s = h.slice(0, -1).concat([+k.value.toFixed(2)]); const lo = Math.min(...s), hi = Math.max(...s), r = hi - lo || 1; spark = s.map((v, i) => (i * 60 / (s.length - 1)).toFixed(1) + ',' + (18 - (v - lo) / r * 16).toFixed(1)).join(' '); } return Object.assign({}, k, { group: KGROUP[k.id] || 'Other', spark }); });
    return order.map(g => ({ group: g, items: all.filter(k => k.group === g) })).filter(g => g.items.length);
  }
  function drawerData(st, dr) {
    if (!dr) return null; const sc = st.scen, d = st[sc];
    const auditFor = key => st.audit.filter(a => (a.detail + ' ' + a.action).includes(key)).slice(-8).reverse().map(a => ({ t: fmtT(a.t), what: a.action + (a.detail ? ': ' + a.detail : ''), who: a.actor, bad: a.rejected }));
    if (dr.kind === 'ctq') {
      const prodSc = sc === 'D' ? 'D' : 'A', c = ctqs(st, prodSc).find(x => x.id === dr.id); if (!c) return null;
      const fm = coverage(st, prodSc).find(f => f.ctq === c.id), cl = (sc === 'A' || sc === 'D') ? checklist(st, sc).find(x => x.id === c.id) : null;
      const rows = [['Feature', c.feat], ['Failure mode', c.fm], ['Type', c.type], ['Limits', c.limits || 'Not set'], ['Method', c.method || 'Not set'], ['Frequency', c.freq || 'Not set'], ['Source locator', c.src], ['Critical', c.critical ? 'Yes' : 'No']];
      const secs = [{ h: 'Definition', rows: rows.map(r => ({ k: r[0], v: r[1] })) }];
      if (c.fields) secs.push({ h: 'Orientation record', rows: c.fields.map(f => ({ k: f[0], v: f[1] || 'Missing, blocks G0' })) });
      if (fm) secs.push({ h: 'Detection coverage', rows: Object.keys(GATECOL).map(k => ({ k: GATECOL[k] + (fm.req.includes(k) ? ' (required)' : ''), v: (fm.cells[k] || 'na').replace('na', 'N/A') + (fm.notes && fm.notes[k] ? '. ' + fm.notes[k] : '') })) });
      if (cl) secs.push({ h: 'First article result', rows: [{ k: 'Result', v: cl.result }, { k: 'Evidence', v: cl.why }] });
      return { kicker: 'CTQ', title: c.id, sub: c.feat, status: c.na ? 'Not applicable' : c.complete ? 'Complete' : 'Incomplete', sections: secs, timeline: auditFor(c.id), actions: [{ label: 'Open in Engineering', screen: 'eng' }] };
    }
    if (dr.kind === 'serial') {
      if (/^MB-A-/.test(dr.id)) { const s = serialB(parseInt(dr.id.slice(5), 10)); return { kicker: 'Board serial', title: s.serial, sub: 'WO-23602 · MB-7420 rev B', status: s.confirmed ? 'Confirmed defective' : 'Potentially exposed', sections: [{ h: 'Genealogy', rows: [['Lot', s.lot], ['Panel and position', s.panel + ', position ' + s.pos], ['U3 reel', s.reel || 'Missing link'], ['PCB lot', s.pcb], ['Paste lot', s.paste], ['Program', s.program], ['Setup', s.setup], ['Shipment', s.ship || 'Finished-goods stock']].map(r => ({ k: r[0], v: r[1] })) }, { h: 'Inspection history', rows: [['SPI-01', 'Pass, panel basis'], ['AOI-MB-A v3', s.aoi ? 'Pass, no U3 Pin 1 feature' : 'No record, released by override'], ['X-ray', 'U7 accepted, not a Pin 1 control'], ['Functional test 1.0', 'Pass, no U3 case']].map(r => ({ k: r[0], v: r[1] })) }], timeline: [{ t: fmtT(s.built), what: 'Built on SMT-L2', who: 'Line' }].concat(s.ship ? [{ t: s.ship === 'SHP-2201' ? '16 Aug, 08:00' : '22 Aug, 08:00', what: 'Dispatched in ' + s.ship, who: 'Logistics' }] : []).concat(s.confirmed ? [{ t: fmtT(st.B.complaint.received), what: 'Customer complaint CMP-0017 confirmed U3 rotated', who: 'Customer A', bad: true }] : []), actions: [{ label: 'Open genealogy search', screen: 'trace', query: s.serial }] }; }
      if (/^MB-C-/.test(dr.id)) { const b = boardC(st, parseInt(dr.id.slice(5), 10)); return { kicker: 'Board serial', title: b.serial, sub: 'WO-24790 · LOT-D-01', status: b.status, sections: [{ h: 'Route results', rows: [['Panel', b.panel + ', position ' + b.pos], ['SPI', b.spi], ['X-ray', b.xray], ['Functional test', b.ft], ['Tester feed', b.stale ? 'FT-02, stale' : 'FT-01, live']].map(r => ({ k: r[0], v: r[1] })) }], timeline: auditFor(b.serial), actions: [{ label: 'Open production board', screen: 'prod' }] }; }
      return null;
    }
    if (dr.kind === 'hold') {
      let h = null, hs = null; ['A', 'B', 'C', 'D', 'E', 'F'].forEach(k => { const x = (st[k].holds || []).find(y => y.id === dr.id); if (x) { h = x; hs = k; } });
      if (!h) return null;
      const tl = [{ t: fmtT(h.at), what: 'Hold applied: ' + h.reason, who: uname(h.by) }].concat(h.resolved ? [{ t: fmtT(h.resolved.at), what: 'Resolved: ' + h.resolved.reason, who: uname(h.resolved.by) }] : []);
      return { kicker: 'Hold', title: h.id, sub: st[hs].order.id, status: h.status, sections: [{ h: 'Scope', rows: [{ k: 'Reason', v: h.reason }, { k: 'Scope', v: h.scope }, { k: 'Applied by', v: uname(h.by) }, { k: 'Count', v: h.count ? String(h.count) : 'Not counted' }, { k: 'Resolution rule', v: 'Resolving returns the record to review, never directly to release' }] }], timeline: tl.concat(auditFor(h.id)), actions: [{ label: 'Open release', screen: 'release' }] };
    }
    if (dr.kind === 'kpi') {
      const k = kpis(st, sc).find(x => x.id === dr.id); if (!k) return null;
      return { kicker: 'Key performance indicator', title: k.name, sub: d.order.id, status: k.display, sections: [{ h: 'Calculation', rows: [['Value', k.display], ['Numerator', k.num !== undefined ? String(k.num) : 'Not applicable'], ['Denominator', k.den !== undefined ? String(k.den) : 'Not applicable'], ['Cohort', k.cohort || d.order.id], ['Exclusions', k.excl || 'None'], ['Target', k.target ? k.target + '%' : 'Requires baseline and plant agreement'], ['Data source', k.badge], ['Notes', k.note || 'None'], ['Reference', k.id]].map(r => ({ k: r[0], v: r[1] })) }], timeline: [], actions: [{ label: 'Open contributing records', screen: k.screen || 'command' }] };
    }
    return null;
  }
  window.PG = {
    T: TONES, toneOf, pill,
    USERS, ROLE_LBL, PERMS, SCREENS, SCEN, GATECOL, APPR_LBL, READINESS, CONNECTORS, GAPS, PILOT_REQ, PILOT_CONFIRM, GUIDE, FILES, CTQ_A,
    get st() { return S; }, get toasts() { return toasts; }, ui,
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    user() { return USERS[S.persona]; }, roleTxt, uname, fmtT, fmtD, demoDate: () => demoDate(S),
    can(p, u) { return can(u || USERS[S.persona], p); },
    canView(screen, u, sc) { return canView(S, screen, u, sc); },
    cur() { return S[S.scen]; },
    nav(screen) { ui.drawer = null; S.screen = screen; ui.loading = true; emit(); setTimeout(() => { ui.loading = false; emit(); }, 320); },
    setScen(sc) { S.scen = sc; emit(); },
    setPersona(p) { S.persona = p; emit(); },
    setGuide(on) { S.guide.on = on; emit(); },
    guideGo(i) { const g = GUIDE[i]; if (!g) return; S.guide.step = i; S.scen = g.scen; S.screen = g.screen; S.persona = g.persona; emit(); },
    act(name, args) { const u = USERS[S.persona]; const n0 = S.audit.length; let r; try { r = ACT[name](S, u, Object.assign({ scen: S.scen }, args || {})) || { ok: true }; } catch (e) { console.error(e); r = E('Error: ' + e.message); } if (r.ok === false) { if (S.audit.length === n0) log(S, u, name + ' rejected', S.scen, r.error, true); if (!r.blockers) toast(r.error, 'err'); if (r.blockers) ui.dialog = { title: 'Release blocked', blockers: r.blockers }; } else if (r.msg) toast(r.msg, 'ok'); emit(); return r; },
    closeDialog() { ui.dialog = null; emit(); },
    openDrawer(kind, id) { ui.drawer = { kind, id }; emit(); }, closeDrawer() { ui.drawer = null; emit(); }, drawerData() { return drawerData(S, ui.drawer); },
    nextAction: sc => nextAction(S, sc), kpiGroups: sc => kpiGroups(S, sc),
    openPrint(kind) { ui.print = kind; emit(); }, closePrint() { ui.print = null; emit(); },
    gates: sc => gates(S, sc), orderState: sc => orderState(S, sc), kpis: sc => kpis(S, sc), ctqs: sc => ctqs(S, sc || S.scen), coverage: sc => coverage(S, sc || S.scen), checklist: sc => checklist(S, sc || S.scen),
    u3Fields: () => u3Fields(S.A), snap: sc => snap(S, sc || S.scen), concessionStatus: () => concessionStatus(S), dossier: sc => dossier(S, sc || S.scen),
    serialB, queryB, boardsC: () => boardsC(S), recon: () => recon(S), spcPaste: () => spcPaste(S), spcPeak, pChart, defectsC, predict: o => predict(S, o),
    classify: rows => classify(S, rows, iso()), importStats: () => importStats(S), criteriaE: () => criteriaE(S),
    runAT, csvText: k => csvText(S, k), download(kind) { const t = csvText(S, kind); download(`processgrit_${S.scen}_${kind}_${iso().slice(0, 10)}.csv`, t); log(S, USERS[S.persona], 'CSV exported', S.scen, kind); toast('Downloaded ' + kind + ' CSV', 'ok'); emit(); },
    reset() { if (!can(USERS[S.persona], 'reset') && S.persona !== 'sam') { } S = seed(); ui.dialog = null; ui.print = null; toast('Scenarios reset to their seeded state', 'ok'); emit(); }
  };
})();
