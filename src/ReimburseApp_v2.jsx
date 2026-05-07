import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// ⚙️  KONFIGURASI SUPABASE
// ═══════════════════════════════════════════════════════════════
const LS_CONFIG = "reimburse_config_v4";
const _loadConfig = () => { try { return JSON.parse(localStorage.getItem(LS_CONFIG)||"{}"); } catch { return {}; } };
const _saveConfig = (obj) => { try { localStorage.setItem(LS_CONFIG, JSON.stringify(obj)); } catch {} };
const _cfg = _loadConfig();

const CONFIG = {
  SUPABASE_URL:  _cfg.SUPABASE_URL  || "",
  SUPABASE_KEY:  _cfg.SUPABASE_KEY  || "",
  PASS_FINANCE:  _cfg.PASS_FINANCE  || "finance123",
  PASS_ADMIN_LK: _cfg.PASS_ADMIN_LK || "adminlk123",
  PASS_ADMIN_JKT:_cfg.PASS_ADMIN_JKT|| "adminjkt123",
  PASS_GA:       _cfg.PASS_GA       || "ga123",
};
const isReady = () => CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY;

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DEPTS = ["Sales","Commercial","HRD","Marketing","GA","IT","Finance","Lainnya"];
const AREAS = ["Jakarta","Surabaya","Semarang","Medan","Yogyakarta","Denpasar","Bandung","Palembang"];
const CATS  = ["Perjalanan Dinas","Akomodasi / Hotel","Makan","Entertainment","Transportasi","Uang Saku","Komunikasi","Lain-lain"];
const STATUS = {
  pending:           { label:"Menunggu Approval",      color:"#92400e", bg:"#fffbeb", dot:"#f59e0b" },
  doc_received_lk:   { label:"Diterima Admin LK",      color:"#1e40af", bg:"#eff6ff", dot:"#3b82f6" },
  doc_sent_jkt:      { label:"Dikirim ke Jakarta",     color:"#5b21b6", bg:"#f5f3ff", dot:"#8b5cf6" },
  doc_received_jkt:  { label:"Diterima Admin Jakarta", color:"#0e7490", bg:"#ecfeff", dot:"#06b6d4" },
  doc_complete:      { label:"Dokumen Lengkap ✓",      color:"#065f46", bg:"#ecfdf5", dot:"#10b981" },
  approved:          { label:"Disetujui",               color:"#1e40af", bg:"#eff6ff", dot:"#3b82f6" },
  processing:        { label:"Diproses Finance",       color:"#5b21b6", bg:"#f5f3ff", dot:"#8b5cf6" },
  paid:              { label:"Lunas ✓",                  color:"#065f46", bg:"#ecfdf5", dot:"#10b981" },
  paid_queued:       { label:"Dalam Antrian Transfer 🏦",  color:"#0369a1", bg:"#e0f2fe", dot:"#0ea5e9" },
  awaiting_oer:      { label:"Menunggu OER",            color:"#854d0e", bg:"#fef9c3", dot:"#ca8a04" },
  oer_doc_pending:   { label:"OER — Menunggu Dok Admin", color:"#0e7490", bg:"#ecfeff", dot:"#06b6d4" },
  oer_doc_received:  { label:"OER — Diterima Admin JKT", color:"#065f46", bg:"#ecfdf5", dot:"#10b981" },
  oer_doc_complete:  { label:"OER — Dok Lengkap (GA)",   color:"#5b21b6", bg:"#f5f3ff", dot:"#8b5cf6" },
  kurang_bayar:      { label:"Kurang Bayar ↑",          color:"#1e3a5f", bg:"#dbeafe", dot:"#3b82f6" },
  lebih_bayar:       { label:"Lebih Bayar ↓",           color:"#4c1d95", bg:"#ede9fe", dot:"#8b5cf6" },
  awaiting_confirm:  { label:"Menunggu Konfirmasi",     color:"#92400e", bg:"#fff7ed", dot:"#f97316" },
  employee_confirmed:{ label:"Karyawan Setuju ✓",       color:"#065f46", bg:"#ecfdf5", dot:"#10b981" },
  disputed:          { label:"Keberatan",               color:"#991b1b", bg:"#fef2f2", dot:"#ef4444" },
  settled:           { label:"Lunas ✓",                 color:"#065f46", bg:"#ecfdf5", dot:"#10b981" },
  rejected:          { label:"Ditolak",                 color:"#991b1b", bg:"#fef2f2", dot:"#ef4444" },
};

const OER_CATS = [
  "Plane Fare","Akomodasi / Hotel","Car Rental / Bensin / Tol",
  "Taxi / Bus / Kereta","Telepon / Komunikasi","Makan (dengan tamu)",
  "Meal Allowance","Uang Saku","Airport Tax","Lain-lain"
];

const DEMO = [];
const ddiff = (a,b) => Math.round((new Date(b)-new Date(a))/864e5);

const gid = () => {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth()+1).padStart(2,"0");
  const dd  = String(now.getDate()).padStart(2,"0");
  const rnd = Math.random().toString(36).slice(2,5).toUpperCase();
  return `TRX-${yy}${mm}${dd}-${rnd}`;
};
const rp    = n  => "Rp " + new Intl.NumberFormat("id-ID").format(n||0);
const fd    = d  => d ? new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "–";
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().split("T")[0]; };

const recon = (trx) => {
  if (trx.type !== "cash_advance") return null;
  const ca  = trx.amount || 0;
  const oer = trx.oerAmount || 0;
  if (!oer) return null;
  const selisih = oer - ca; 
  return { ca, oer, selisih, isKurang: selisih > 0, isLebih: selisih < 0, isLunas: selisih === 0 };
};

const workdaysSinceEnd = (dateEnd) => {
  if (!dateEnd) return 0;
  const end = new Date(dateEnd); end.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  let days = 0, cur = new Date(end);
  cur.setDate(cur.getDate()+1);
  while (cur <= now) {
    const dow = cur.getDay();
    if (dow!==0 && dow!==6) days++;
    cur.setDate(cur.getDate()+1);
  }
  return days;
};

// Logika overdue yang sudah diperbaiki
const isOverdue = (d) => {
  if (!d.dateEnd) return false;
  if (d.type === "cash_advance") {
    // CA Telat = Karyawan belum submit OER setelah 5 hari trip selesai.
    const OER_SUBMITTED_STATUSES = ["oer_doc_pending","oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"];
    if (OER_SUBMITTED_STATUSES.includes(d.status) || d.oerDate) return false;
    const PRE_DISBURSE_STATUSES = ["pending","doc_received_lk","doc_sent_jkt","doc_received_jkt","doc_complete","approved","processing","rejected"];
    if (PRE_DISBURSE_STATUSES.includes(d.status)) return false;
    return workdaysSinceEnd(d.dateEnd) > 5;
  }
  if (d.type === "reimburse") {
    // Reimburse telat = Karyawan submit/mengajukan lebih dari 5 hari setelah trip selesai.
    if (!d.submitted) return false;
    let end = new Date(d.dateEnd); end.setHours(0,0,0,0);
    let sub = new Date(d.submitted); sub.setHours(0,0,0,0);
    let days = 0, cur = new Date(end);
    cur.setDate(cur.getDate()+1);
    while (cur <= sub) {
      const dow = cur.getDay();
      if (dow!==0 && dow!==6) days++;
      cur.setDate(cur.getDate()+1);
    }
    return days > 5;
  }
  return false;
};

const withLateFlagOnly = (d) => ({ ...d, isLate: isOverdue(d) });

// ── Supabase REST API ────────────────────────────────────────
const SB = {
  async req(method, path, body=null, params=null) {
    if (!isReady()) { console.warn("Supabase not configured"); return null; }
    try {
      let url = CONFIG.SUPABASE_URL + "/rest/v1/" + path;
      if (params) {
        const qs = Object.entries(params).map(([k,v])=>k+"="+encodeURIComponent(v)).join("&");
        url += "?" + qs;
      }
      const headers = {
        "apikey": CONFIG.SUPABASE_KEY,
        "Authorization": "Bearer " + CONFIG.SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      };
      const fetchOpts = { method, headers };
      if (body && method !== "GET") fetchOpts.body = JSON.stringify(body);
      const r = await fetch(url, fetchOpts);
      const txt = await r.text();
      if (r.status >= 200 && r.status < 300) return txt ? JSON.parse(txt) : { ok:true };
      console.error("Supabase error", r.status, path, txt);
      return null;
    } catch(e) { console.error("fetch error:", e); return null; }
  },

  async getAll() {
    const rows = await SB.req("GET","transactions",null,{select:"*",order:"submitted.desc"});
    if (!rows) return null;
    return rows.map(r=>({
      id:r.id, type:r.type, submitter:r.submitter, submitterUsername:r.submitter_username||"", dept:r.dept, transferDate:r.transfer_date||"",
      purpose:r.purpose, destination:r.destination, dateStart:r.date_start, dateEnd:r.date_end,
      amount:r.amount, status:r.status, submitted:r.submitted, categories:r.categories||[], notes:r.notes||"",
      settled:r.settled||false, settledDate:r.settled_date||null,
      approverName:r.approver_name||"", financeNote:r.finance_note||"",
      oerAmount:r.oer_amount||0, oerCategories:r.oer_categories||[], oerNote:r.oer_note||"", oerDate:r.oer_date||"",
      caRef:r.ca_ref||"",
      transferProof:r.transfer_proof||"", docRoute:r.doc_route||"admin_jkt",
      adminLkName:r.admin_lk_name||"", adminJktName:r.admin_jkt_name||"", gaNote:r.ga_note||"", gaOerNote:r.ga_oer_note||"", area:r.area||"Jakarta",
    }));
  },

  async create(d) {
    return SB.req("POST","transactions",{
      id:d.id, type:d.type, submitter:d.submitter, submitter_username:d.submitterUsername||"", dept:d.dept, area:d.area||"Jakarta",
      purpose:d.purpose, destination:d.destination, date_start:d.dateStart, date_end:d.dateEnd,
      amount:d.amount, status:d.status||"pending", submitted:d.submitted, categories:d.categories||[],
      notes:d.notes||"", settled:false, settled_date:null, approver_name:d.approverName||"", finance_note:"", transfer_date:d.transferDate||"",
      oer_amount:0, oer_categories:[], oer_note:"", oer_date:"", ca_ref:d.caRef||"", doc_route:d.docRoute||"admin_jkt",
    });
  },

  async update(id, patch) { return SB.req("PATCH","transactions",patch,{"id":"eq."+id}); },

  async submitOer(id, oerData, caAmount) {
    return SB.update(id, { oer_amount:oerData.oerAmount, oer_categories:oerData.oerCategories, oer_note:oerData.oerNote||"", oer_date:oerData.oerDate||today(), status:"oer_doc_pending", settled: false });
  },

  async updateOer(id, oerCategories, oerNote, caAmount) {
    const oerAmount = oerCategories.reduce((s,it)=>s+(it.amt||0),0);
    const selisih   = oerAmount - caAmount;
    const newStatus = selisih > 0 ? "kurang_bayar" : selisih < 0 ? "lebih_bayar" : "settled";
    return SB.update(id, { oer_amount: oerAmount, oer_categories: oerCategories, oer_note: oerNote||"", status: newStatus });
  },

  async oerDocComplete(id, gaNote, caAmount, oerAmount) {
    const selisih = (oerAmount||0) - caAmount;
    const finalStatus = selisih > 0 ? "kurang_bayar" : selisih < 0 ? "lebih_bayar" : "settled";
    return SB.update(id, { status: finalStatus, ga_oer_note: gaNote||"", settled: finalStatus==="settled" });
  },

  async editData(id, d) {
    const patch = {};
    if (d.purpose)     patch.purpose     = d.purpose;
    if (d.destination) patch.destination = d.destination;
    if (d.dateStart)   patch.date_start  = d.dateStart;
    if (d.dateEnd)     patch.date_end    = d.dateEnd;
    if (d.amount)      patch.amount      = d.amount;
    if (d.categories)  patch.categories  = d.categories;
    if (d.notes!==undefined) patch.notes = d.notes;
    if (d.approverName) patch.approver_name = d.approverName;
    return SB.update(id, patch);
  },

  async registerAcc(acc) {
    const existing = await SB.req("GET","accounts",null,{"username":"eq."+acc.username.toLowerCase(),"select":"username"});
    if (existing && existing.length>0) return { ok:false, error:"Username sudah dipakai" };
    const res = await SB.req("POST","accounts",{
      username:acc.username.toLowerCase(), password:acc.password, name:acc.name, dept:acc.dept, area:acc.area||"Jakarta",
      created_at:new Date().toISOString()
    });
    return res ? { ok:true } : { ok:false, error:"Gagal menyimpan akun" };
  },

  async loginAcc(username, password) {
    const rows = await SB.req("GET","accounts",null,{"username":"eq."+username.toLowerCase(),"password":"eq."+password,"select":"username,name,dept,area"});
    if (rows && rows.length>0) return { ok:true, ...rows[0] };
    return { ok:false, error:"Username atau password salah" };
  },

  async getAllAccounts() { return SB.req("GET","accounts",null,{"select":"username,name,dept,area"}); },
};

const API = {
  getAll:      ()       => SB.getAll(),
  create:      (data)   => SB.create(data),
  submitOer:   (id,d,ca)=> SB.submitOer(id,d,ca),
  registerAcc: (acc)    => SB.registerAcc(acc),
  loginAcc:    (u,p)    => SB.loginAcc(u,p),
  getAllAccounts:()      => SB.getAllAccounts(),
  editData:    (id,d)       => SB.editData(id,d),
  updateOer:   (id,cats,note,ca) => SB.updateOer(id,cats,note,ca),
  oerDocComplete: (id,note,ca,oer) => SB.oerDocComplete(id,note,ca,oer),
  
  // Status update helpers
  updateStatus: (id, patch) => SB.update(id, patch),
  docReceivedLK:  (id, n) => SB.update(id, { status: "doc_received_lk", admin_lk_name: n, doc_received_lk_at: new Date().toISOString() }),
  docSentJkt:     (id)    => SB.update(id, { status: "doc_sent_jkt", doc_sent_jkt_at: new Date().toISOString() }),
  docReceivedJkt: (id, n) => SB.update(id, { status: "doc_received_jkt", admin_jkt_name: n, doc_received_jkt_at: new Date().toISOString() }),
  oerDocReceived: (id, n) => SB.update(id, { status: "oer_doc_received", admin_jkt_name: n }),
  docComplete:    (id, amt, note) => {
    const patch = { status: "doc_complete", ga_note: note||"", doc_complete_at: new Date().toISOString() };
    if (amt) patch.oer_amount = amt;
    return SB.update(id, patch);
  }
};


// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#f0f2f5;--w:#fff;--ink:#0c1824;--i2:#334155;--i3:#64748b;--i4:#94a3b8;
  --ln:#e2e8f0;--ln2:#f1f5f9;
  --tl:#0d9488;--tl2:#14b8a6;--tlb:#f0fdfa;--tlbd:#99f6e4;
  --am:#d97706;--amb:#fffbeb;--ambd:#fde68a;
  --rd:#dc2626;--rdb:#fef2f2;--rdbd:#fca5a5;
  --bl:#2563eb;--blb:#eff6ff;--blbd:#93c5fd;
  --gn:#059669;--gnb:#ecfdf5;--gnbd:#6ee7b7;
  --pu:#7c3aed;--pub:#f5f3ff;
  --r:14px;--r2:10px;--r3:7px;
  --s1:0 1px 3px rgba(0,0,0,.06);--s2:0 4px 20px rgba(0,0,0,.08);--s3:0 24px 60px rgba(0,0,0,.15),0 8px 20px rgba(0,0,0,.08);
}
body{font-family:'Sora',sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;font-size:14px}

/* LOGIN */
.lw{min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#0c1824 0%,#0f2535 50%,#133040 100%);padding:20px;position:relative;overflow:hidden}
.lr1{position:absolute;width:500px;height:500px;border-radius:50%;border:1px solid rgba(13,148,136,.15);top:-100px;right:-100px;pointer-events:none}
.lr2{position:absolute;width:300px;height:300px;border-radius:50%;border:1px solid rgba(13,148,136,.1);bottom:-80px;left:-80px;pointer-events:none}
.lc{background:rgba(255,255,255,.97);border-radius:20px;box-shadow:var(--s3);width:100%;max-width:420px;padding:36px;position:relative;z-index:1;animation:su .3s}
@keyframes su{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.l-ico{width:58px;height:58px;background:linear-gradient(135deg,var(--tl),var(--tl2));border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:26px;box-shadow:0 8px 20px rgba(13,148,136,.35)}
.l-tabs{display:flex;background:var(--ln2);border-radius:var(--r2);padding:4px;margin-bottom:22px;gap:3px}
.l-tab{flex:1;padding:8px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;transition:.15s;background:transparent;color:var(--i3)}
.l-tab.on{background:var(--w);color:var(--ink);box-shadow:var(--s1)}
.l-fld{margin-bottom:13px}
.l-fld label{display:block;font-size:11.5px;font-weight:700;color:var(--i2);margin-bottom:4px}
.l-fld input,.l-fld select{width:100%;padding:10px 12px;border:1.5px solid var(--ln);border-radius:var(--r3);font-family:inherit;font-size:13.5px;color:var(--ink);outline:none;transition:.15s}
.l-fld input:focus,.l-fld select:focus{border-color:var(--tl);box-shadow:0 0 0 3px rgba(13,148,136,.1)}
.l-btn{width:100%;padding:12px;border-radius:var(--r2);border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;background:var(--tl);color:#fff;box-shadow:0 4px 12px rgba(13,148,136,.3);transition:.15s;margin-top:4px}
.l-btn:hover:not(:disabled){background:#0f766e}.l-btn:disabled{opacity:.6;cursor:not-allowed}
.l-err{background:var(--rdb);border:1px solid var(--rdbd);color:#991b1b;padding:9px 12px;border-radius:var(--r3);font-size:12.5px;margin-bottom:12px;display:flex;align-items:center;gap:7px}
.l-note{background:var(--tlb);border:1px solid var(--tlbd);color:#134e4a;padding:10px 12px;border-radius:var(--r3);font-size:12px;margin-top:12px;line-height:1.6}

/* LAYOUT */
.app{display:flex;min-height:100vh}
.sb{width:252px;background:var(--ink);display:flex;flex-direction:column;position:fixed;height:100vh;z-index:200;transition:.25s}
.main{flex:1;margin-left:252px;min-height:100vh;display:flex;flex-direction:column}
.bar{height:56px;background:var(--w);border-bottom:1px solid var(--ln);display:flex;align-items:center;padding:0 24px;gap:10px;position:sticky;top:0;z-index:100}
.page{padding:24px;flex:1}

/* SIDEBAR */
.sb-logo{padding:20px 18px 15px;border-bottom:1px solid rgba(255,255,255,.07)}
.sb-lh{font-family:'Playfair Display',serif;font-size:20px;color:#fff;font-style:italic}
.sb-ls{font-size:10px;font-weight:700;color:var(--tl2);letter-spacing:.12em;text-transform:uppercase;margin-top:1px}
.sb-u{padding:12px 14px;display:flex;align-items:center;gap:9px;border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer;transition:.15s}
.sb-u:hover{background:rgba(255,255,255,.05)}
.av{width:35px;height:35px;border-radius:50%;background:linear-gradient(135deg,var(--tl),var(--tl2));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0}
.sb-un{font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-ur{font-size:11px;color:var(--i4);margin-top:1px}
.sb-lo{font-size:10px;color:rgba(255,255,255,.2);margin-top:2px;display:flex;align-items:center;gap:3px}
.sb-nav{flex:1;padding:8px;overflow-y:auto}
.nv-s{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.18);padding:10px 10px 4px}
.nv{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;color:rgba(255,255,255,.45);font-size:13px;font-weight:500;margin-bottom:1px;transition:.12s;user-select:none}
.nv:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8)}
.nv.on{background:var(--tl);color:#fff;font-weight:600}
.nv .nb{margin-left:auto;background:var(--rd);color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:10px}

/* TOPBAR */
.bt{font-size:15px;font-weight:800;flex:1}
.br{display:flex;align-items:center;gap:8px}
.cs{display:flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700}
.cs-ok{background:var(--gnb);color:var(--gn);border:1px solid var(--gnbd)}
.cs-no{background:var(--amb);color:var(--am);border:1px solid var(--ambd)}

/* CARD */
.card{background:var(--w);border-radius:var(--r);border:1px solid var(--ln);box-shadow:var(--s1)}
.ch{padding:14px 20px;border-bottom:1px solid var(--ln);display:flex;align-items:center;justify-content:space-between;gap:12px}
.ch h3{font-size:14px;font-weight:800}
.cb{padding:18px 20px}

/* STATS */
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:11px;margin-bottom:20px}
.st{background:var(--w);border:1px solid var(--ln);border-radius:var(--r);padding:15px 17px;position:relative;box-shadow:var(--s1)}
.st::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%}
.st.tl::before{background:var(--tl)}.st.am::before{background:var(--am)}
.st.rd::before{background:var(--rd)}.st.bl::before{background:var(--bl)}
.st.gn::before{background:var(--gn)}.st.pu::before{background:var(--pu)}
.sl{font-size:10px;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}
.sv{font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1}
.sv.md{font-size:17px}.ss{font-size:11px;color:var(--i4);margin-top:4px}
.pb{height:4px;background:var(--ln);border-radius:2px;overflow:hidden;margin-top:6px}
.pbf{height:100%;border-radius:2px}

/* TABLE */
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{padding:8px 13px;text-align:left;font-size:10.5px;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;border-bottom:2px solid var(--ln);background:var(--ln2);white-space:nowrap}
td{padding:11px 13px;font-size:13px;color:var(--i2);border-bottom:1px solid var(--ln);vertical-align:middle}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#fafbfd;cursor:pointer}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r2);border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;transition:.12s;line-height:1;white-space:nowrap}
.btn:disabled{opacity:.4;cursor:not-allowed}
.bp{background:var(--tl);color:#fff;box-shadow:0 2px 6px rgba(13,148,136,.25)}.bp:hover:not(:disabled){background:#0f766e}
.bg{background:var(--gn);color:#fff}.bg:hover:not(:disabled){background:#047857}
.br2{background:var(--rd);color:#fff}.br2:hover:not(:disabled){background:#b91c1c}
.bo{background:transparent;color:var(--i2);border:1.5px solid var(--ln)}.bo:hover:not(:disabled){background:var(--ln2)}
.sm{padding:5px 11px;font-size:12px;border-radius:8px}.xs{padding:3px 9px;font-size:11.5px;border-radius:6px}

/* FORM */
.fg{display:grid;gap:12px}.fg2{grid-template-columns:1fr 1fr}.fg3{grid-template-columns:1fr 1fr 1fr}
label.fl{display:block;font-size:11.5px;font-weight:700;color:var(--i2);margin-bottom:4px}
input,select,textarea{width:100%;padding:8px 11px;border:1.5px solid var(--ln);border-radius:var(--r3);font-family:inherit;font-size:13px;color:var(--ink);background:var(--w);outline:none;transition:.12s}
input:focus,select:focus,textarea:focus{border-color:var(--tl);box-shadow:0 0 0 3px rgba(13,148,136,.1)}
textarea{resize:vertical;min-height:70px;line-height:1.5}
.fs{background:var(--ln2);border-radius:var(--r2);padding:13px;border:1px solid var(--ln)}
.fst{font-size:10.5px;font-weight:800;color:var(--tl);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}

/* BADGES */
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700}
.badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0}
.tag{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700}
.tca{background:#dbeafe;color:#1e40af}.tre{background:#f3e8ff;color:#6b21a8}

/* MODAL */
.ov{position:fixed;inset:0;background:rgba(12,24,36,.65);backdrop-filter:blur(6px);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;animation:fi .15s}
.mo{background:var(--w);border-radius:var(--r);box-shadow:var(--s3);width:100%;max-width:640px;max-height:90vh;overflow-y:auto;animation:su .18s}
.mh{padding:16px 20px;border-bottom:1px solid var(--ln);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:sticky;top:0;background:var(--w);z-index:1}
.mb2{padding:20px}

/* TIMELINE */
.tlr{display:flex;gap:10px;margin-bottom:12px}
.tldc{display:flex;flex-direction:column;align-items:center}
.tld{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tlln{width:2px;flex:1;margin-top:3px;background:var(--ln)}
.tlb{flex:1;padding-top:2px}
.tlt{font-size:12.5px;font-weight:700}
.tls{font-size:11px;color:var(--i3);margin-top:2px}

/* ALERTS */
.al{padding:10px 13px;border-radius:var(--r2);font-size:12.5px;display:flex;align-items:flex-start;gap:8px;line-height:1.5}
.aw{background:var(--amb);border:1px solid var(--ambd);color:#78350f}
.ae{background:var(--rdb);border:1px solid var(--rdbd);color:#7f1d1d}
.ag{background:var(--gnb);border:1px solid var(--gnbd);color:#064e3b}
.ab{background:var(--blb);border:1px solid var(--blbd);color:#1e3a8a}
.at{background:var(--tlb);border:1px solid var(--tlbd);color:#134e4a}

/* UTILS */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.mb3{margin-bottom:12px}.mb4{margin-bottom:16px}.mb5{margin-bottom:20px}
.mt3{margin-top:12px}.mt4{margin-top:16px}
.mu{color:var(--i3)}.bold{font-weight:700}.mono{font-family:ui-monospace,monospace;font-size:12px;font-weight:700;color:var(--tl)}
.trunc{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.empty{text-align:center;padding:44px 20px;color:var(--i4)}
.sp2{display:inline-block;width:14px;height:14px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle}
.toast{position:fixed;bottom:22px;right:22px;z-index:999;padding:11px 18px;border-radius:var(--r2);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;box-shadow:var(--s3);animation:su .2s}
.flt{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.flt input,.flt select{flex:1;min-width:130px;width:auto}
.hero{background:linear-gradient(130deg,#0c1824 0%,#133040 60%,#164050 100%);border-radius:16px;padding:24px 28px;color:#fff;position:relative;overflow:hidden;margin-bottom:20px}
.hr1{position:absolute;right:-30px;top:-30px;width:180px;height:180px;border-radius:50%;background:rgba(13,148,136,.12);pointer-events:none}
.hr2{position:absolute;right:70px;bottom:-50px;width:130px;height:130px;border-radius:50%;background:rgba(20,184,166,.08);pointer-events:none}

@media(max-width:800px){
  .sb{transform:translateX(-100%)}.sb.open{transform:none}
  .main{margin-left:0}.fg2,.fg3,.g2{grid-template-columns:1fr}
  .sg{grid-template-columns:1fr 1fr}.page{padding:14px}.bar{padding:0 14px}
}
@media(max-width:480px){.sg{grid-template-columns:1fr}}
`;

// ── Icons ────────────────────────────────────────────────────
const IP = {
  home:"M3 12L12 3l9 9M9 21V12h6v9M3 12v9h18v-9",
  plus:"M12 5v14M5 12h14",
  list:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  check:"M20 6 9 17 4 12",
  x:"M18 6 6 18M6 6l12 12",
  clock:"M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  alert:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  money:"M1 4h22v16H1zM1 10h22",
  user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8",
  chart:"M18 20V10M12 20V4M6 20v-6M2 20h20",
  send:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7",
  trash:"M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  bell:"M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  logout:"M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  search:"M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0",
  menu:"M3 12h18M3 6h18M3 18h18",
  refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  settings:"M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
};
const Ic = ({ n, s=16, c="currentColor" }) => (
  <svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={IP[n]||""}/></svg>
);
const SBadge = ({ s, trx, isOwner }) => {
  let displayStatus = s;
  if (isOwner && trx && (s==="paid"||s==="awaiting_oer") && trx.transferDate) {
    const todayD = new Date(); todayD.setHours(0,0,0,0);
    const estD   = new Date(trx.transferDate); estD.setHours(0,0,0,0);
    if (estD >= todayD) displayStatus = "paid_queued";
  }
  const c=STATUS[displayStatus]||{label:displayStatus,color:"#475569",bg:"#f1f5f9"};
  return <span className="badge" style={{color:c.color,background:c.bg}}>{c.label}</span>;
};
const LateBadge = ({ d }) => d.isLate ? <span className="badge" style={{color:"#9f1239",background:"#fff1f2",marginLeft:4}}>⚠ Terlambat</span> : null;
const TTag = ({ t }) => t==="cash_advance"?<span className="tag tca">Cash Advance</span>:<span className="tag tre">Reimburse</span>;

const LS_KEY2  = "reimburse_accounts_v3";
const lsGet2   = () => { try { return JSON.parse(localStorage.getItem(LS_KEY2)||"{}"); } catch { return {}; } };
const lsSave2  = (a) => { try { localStorage.setItem(LS_KEY2, JSON.stringify(a)); } catch {} };

const PwInput = ({ value, onChange, placeholder, showState, toggleShow, onEnter }) => (
  <div style={{position:"relative"}}>
    <input type={showState?"text":"password"} value={value}
      onChange={e=>onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={e=>e.key==="Enter"&&onEnter&&onEnter()}
      style={{paddingRight:42}}/>
    <button onClick={e=>{e.preventDefault();toggleShow();}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--i3)"}}>
      {showState?"🙈":"👁️"}
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [tab,setTab]     = useState("karyawan");
  const [mode,setMode]   = useState("login");
  const [err,setErr]     = useState("");
  const [show,setShow]   = useState(false);
  const [show2,setShow2] = useState(false);
  const [username,setUsername] = useState("");
  const [pass,setPass]         = useState("");
  const [regName,setRegName]   = useState("");
  const [regDept,setRegDept]   = useState("");
  const [regArea,setRegArea]   = useState("");
  const [regUser,setRegUser]   = useState("");
  const [regPass,setRegPass]   = useState("");
  const [regPass2,setRegPass2] = useState("");
  const [role,setRole]         = useState("admin_lk");
  const [staffPass,setStaffPass]=useState("");
  const clr = () => setErr("");
  const [busy2,setBusy2] = useState(false);

  const doRegister = async () => {
    if (!regName.trim())       return setErr("Nama tidak boleh kosong");
    if (!regDept)              return setErr("Pilih departemen dulu");
    if (!regArea)              return setErr("Pilih area/kota dulu");
    if (!regUser.trim())       return setErr("Username tidak boleh kosong");
    if (regUser.includes(" ")) return setErr("Username tidak boleh mengandung spasi");
    if (regPass.length < 4)    return setErr("Password minimal 4 karakter");
    if (regPass !== regPass2)  return setErr("Konfirmasi password tidak cocok");
    const ukey = regUser.toLowerCase().trim();
    const av   = regName.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    const newAcc = { username:ukey, name:regName.trim(), dept:regDept, area:regArea, avatar:av, password:regPass };
    setBusy2(true);
    if (isReady()) {
      const res = await API.registerAcc(newAcc);
      setBusy2(false);
      if (!res) return setErr("Tidak bisa terhubung ke server.");
      if (!res.ok) return setErr(res.error || "Username sudah dipakai, pilih yang lain");
    } else {
      const accounts = lsGet2();
      if (accounts[ukey]) { setBusy2(false); return setErr("Username sudah dipakai"); }
      accounts[ukey] = newAcc;
      lsSave2(accounts);
      setBusy2(false);
    }
    onLogin({ name:newAcc.name, dept:newAcc.dept, area:newAcc.area, role:"employee", avatar:av, username:ukey });
  };

  const doLogin = async () => {
    if (!username.trim()) return setErr("Masukkan username");
    if (!pass)            return setErr("Masukkan password");
    const ukey = username.toLowerCase().trim();
    setBusy2(true);
    if (isReady()) {
      const res = await API.loginAcc(ukey, pass);
      setBusy2(false);
      if (!res) return setErr("Tidak bisa terhubung ke server.");
      if (!res.ok) return setErr(res.error || "Username atau password salah");
      const name = res.name || res.acc?.name || ukey;
      const dept = res.dept || res.acc?.dept || "-";
      const area = res.area || res.acc?.area || "Jakarta";
      const av2  = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
      onLogin({ name, dept, area, role:"employee", avatar:av2, username:ukey });
    } else {
      const accounts = lsGet2();
      const acc = accounts[ukey];
      setBusy2(false);
      if (!acc)             return setErr("Username tidak ditemukan");
      if (acc.password !== pass) return setErr("Password salah!");
      onLogin({ name:acc.name, dept:acc.dept, role:"employee", avatar:acc.avatar, username:ukey });
    }
  };

  const doStaff = () => {
    const passMap = { finance: CONFIG.PASS_FINANCE, admin_lk: CONFIG.PASS_ADMIN_LK, admin_jkt:CONFIG.PASS_ADMIN_JKT, ga: CONFIG.PASS_GA };
    const correct = passMap[role];
    if (staffPass !== correct) return setErr("Password salah!");
    const infoMap = {
      finance:   { name:"Finance",     dept:"Finance",    avatar:"FN" },
      admin_lk:  { name:"Admin LK",    dept:"Admin",      avatar:"AL" },
      admin_jkt: { name:"Admin Jakarta",dept:"Admin",     avatar:"AJ" },
      ga:        { name:"GA",          dept:"GA",         avatar:"GA" },
    };
    onLogin({ ...infoMap[role], role });
  };

  return (
    <div className="lw">
      <div className="lr1"/><div className="lr2"/>
      <div className="lc">
        <div style={{textAlign:"center",marginBottom:24}}>
          <div className="l-ico">💼</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontStyle:"italic",color:"var(--ink)"}}>ReimburseApp</h1>
          <p style={{fontSize:12,color:"var(--i3)",marginTop:3}}>Sistem Reimburse & Cash Advance</p>
        </div>

        <div className="l-tabs">
          {[["karyawan","👤  Karyawan"],["staff","🔐  Admin / GA"]].map(([v,l])=>(
            <button key={v} className={`l-tab${tab===v?" on":""}`}
              onClick={()=>{setTab(v);setErr("");setMode("login");}}>
              {l}
            </button>
          ))}
        </div>

        {err && <div className="l-err"><Ic n="x" s={13} c="#dc2626"/>{err}</div>}

        {tab==="karyawan" && mode==="login" && (
          <>
            <div className="l-fld">
              <label>Username</label>
              <input value={username} onChange={e=>{setUsername(e.target.value);clr();}} placeholder="Username yang sudah didaftarkan" autoFocus onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </div>
            <div className="l-fld">
              <label>Password</label>
              <PwInput value={pass} onChange={v=>{setPass(v);clr();}} placeholder="Password kamu" showState={show} toggleShow={()=>setShow(s=>!s)} onEnter={doLogin}/>
            </div>
            <button className="l-btn" onClick={doLogin} disabled={busy2}>{busy2?<span className="sp2"/>:"Masuk →"}</button>
            <div style={{textAlign:"center",marginTop:14}}>
              <span style={{fontSize:12.5,color:"var(--i3)"}}>Belum punya akun? </span>
              <button onClick={()=>{setMode("register");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,color:"var(--tl)",fontFamily:"inherit"}}>Daftar sekarang</button>
            </div>
          </>
        )}

        {tab==="karyawan" && mode==="register" && (
          <>
            <div style={{background:"var(--tlb)",border:"1px solid var(--tlbd)",borderRadius:"var(--r3)",padding:"9px 12px",marginBottom:14,fontSize:12,color:"#134e4a"}}>✨ Daftar sekali, langsung bisa login kapan saja.</div>
            <div className="l-fld"><label>Nama Lengkap <span style={{color:"var(--rd)"}}>*</span></label><input value={regName} onChange={e=>{setRegName(e.target.value);clr();}} placeholder="Nama lengkap kamu" autoFocus/></div>
            <div className="l-fld">
              <label>Departemen <span style={{color:"var(--rd)"}}>*</span></label>
              <select value={regDept==="Lainnya"||DEPTS.slice(0,-1).includes(regDept)?regDept:regDept?"Lainnya":""} onChange={e=>{setRegDept(e.target.value);clr();}}>
                <option value="">-- Pilih Departemen --</option>
                {DEPTS.map(d=><option key={d}>{d}</option>)}
              </select>
              {regDept==="Lainnya" && <input value={regDept==="Lainnya"?"":regDept} onChange={e=>setRegDept(e.target.value||"Lainnya")} placeholder="Tulis nama departemen..." style={{marginTop:6}}/>}
            </div>
            <div className="l-fld">
              <label>Area / Kota <span style={{color:"var(--rd)"}}>*</span></label>
              <select value={regArea} onChange={e=>{setRegArea(e.target.value);clr();}}>
                <option value="">-- Pilih Area --</option>
                {AREAS.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="l-fld"><label>Username <span style={{color:"var(--rd)"}}>*</span></label><input value={regUser} onChange={e=>{setRegUser(e.target.value);clr();}} placeholder="Contoh: budi.santoso"/></div>
            <div className="l-fld"><label>Password <span style={{color:"var(--rd)"}}>*</span></label><PwInput value={regPass} onChange={v=>{setRegPass(v);clr();}} placeholder="Min. 4 karakter" showState={show} toggleShow={()=>setShow(s=>!s)}/></div>
            <div className="l-fld"><label>Konfirmasi Password <span style={{color:"var(--rd)"}}>*</span></label><PwInput value={regPass2} onChange={v=>{setRegPass2(v);clr();}} placeholder="Ulangi password" showState={show2} toggleShow={()=>setShow2(s=>!s)} onEnter={doRegister}/></div>
            <button className="l-btn" onClick={doRegister} disabled={busy2}>{busy2?<span className="sp2"/>:"Daftar & Masuk →"}</button>
            <div style={{textAlign:"center",marginTop:14}}>
              <span style={{fontSize:12.5,color:"var(--i3)"}}>Sudah punya akun? </span>
              <button onClick={()=>{setMode("login");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,color:"var(--tl)",fontFamily:"inherit"}}>Login di sini</button>
            </div>
          </>
        )}

        {tab==="staff" && (
          <>
            <div className="l-fld">
              <label>Login sebagai</label>
              <select value={role} onChange={e=>{setRole(e.target.value);clr();}}>
                <option value="admin_lk">📦  Admin Luar Kota</option>
                <option value="admin_jkt">🏢  Admin Jakarta</option>
                <option value="ga">🗂  GA</option>
                <option value="finance">💼  Finance</option>
              </select>
            </div>
            <div className="l-fld">
              <label>Password <span style={{color:"var(--rd)"}}>*</span></label>
              <PwInput value={staffPass} onChange={v=>{setStaffPass(v);clr();}} placeholder="Masukkan password" showState={show} toggleShow={()=>setShow(s=>!s)} onEnter={doStaff}/>
            </div>
            <button className="l-btn" onClick={doStaff}>Masuk →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ data, user, nav }) {
  const isMyTrx = (d) => d.submitter===user.name || (user.username && d.submitterUsername===user.username);
  const mine    = user.role==="employee" ? data.filter(isMyTrx) : data;
  const pending = data.filter(d=>d.status==="pending");
  const approved= data.filter(d=>["approved","doc_complete"].includes(d.status));
  const overdue = mine.filter(d=>d.isLate===true);
  const totalRp = mine.reduce((a,d)=>a+d.amount,0);
  const paidRp  = mine.filter(d=>d.status==="paid").reduce((a,d)=>a+d.amount,0);
  const active  = mine.filter(d=>["pending","approved","processing"].includes(d.status));
  const pct     = totalRp?Math.min(100,Math.round(paidRp/totalRp*100)):0;

  const kurangBayarNotif = user.role==="employee"
    ? mine.filter(d=>d.type==="cash_advance" && (d.status==="kurang_bayar"||d.status==="awaiting_confirm") && !d.settled)
    : [];

  const lebihBayarNotif = user.role==="employee"
    ? mine.filter(d=>d.type==="cash_advance" && d.status==="lebih_bayar" && !d.settled)
    : [];

  return (
    <div>
      <div className="hero">
        <div className="hr1"/><div className="hr2"/>
        <div style={{position:"relative"}}>
          <p style={{fontSize:10,fontWeight:800,letterSpacing:".12em",textTransform:"uppercase",color:"var(--tl2)",marginBottom:4}}>Selamat datang</p>
          <h2 style={{fontSize:20,fontWeight:800,letterSpacing:"-.01em",marginBottom:3}}>{user.name}</h2>
          <p style={{fontSize:12.5,color:"rgba(255,255,255,.5)"}}>
            {user.dept} {user.area ? `· ${user.area}` : ""} · {user.role==="finance"?"Finance":user.role==="admin_lk"?"Admin Luar Kota":user.role==="admin_jkt"?"Admin Jakarta":user.role==="ga"?"GA":"Karyawan"}
          </p>
        </div>
      </div>

      {overdue.length>0 && <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><span><strong>{overdue.length} CA Terlambat</strong> — melewati batas 5 hari kerja!</span></div>}

      {kurangBayarNotif.map(d=>(
        <div key={d.id} style={{marginBottom:12,padding:"14px 16px",background:"linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)",borderRadius:"var(--r2)",boxShadow:"0 4px 16px rgba(30,64,175,0.3)"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
            <div style={{fontSize:24,flexShrink:0}}>🏦</div>
            <div style={{flex:1}}>
              <p style={{fontSize:13,fontWeight:800,color:"white",marginBottom:4}}>Menunggu Transfer Finance — CA {d.id}</p>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.9)",marginBottom:8}}>
                Finance akan mentransfer <strong style={{color:"#fde68a"}}>{rp(Math.abs((d.oerAmount||0) - d.amount))}</strong> kepadamu. Tidak perlu aksi tambahan.
              </p>
            </div>
            <button className="btn sm" onClick={()=>nav&&nav("list")} style={{background:"white",color:"#1e40af",fontWeight:800,flexShrink:0,fontSize:12}}>Lihat →</button>
          </div>
        </div>
      ))}

      {lebihBayarNotif.map(d=>(
        <div key={d.id} style={{marginBottom:12,padding:"14px 16px",background:"linear-gradient(135deg,#7c3aed 0%,#8b5cf6 100%)",borderRadius:"var(--r2)",boxShadow:"0 4px 16px rgba(124,58,237,0.3)"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
            <div style={{fontSize:24,flexShrink:0}}>⚠️</div>
            <div style={{flex:1}}>
              <p style={{fontSize:13,fontWeight:800,color:"white",marginBottom:4}}>Pengembalian Sisa CA — {d.id}</p>
              <p style={{fontSize:12,color:"rgba(255,255,255,0.9)",marginBottom:8}}>
                Terdapat sisa dana CA (Lebih Bayar) sebesar <strong style={{color:"#fde68a"}}>{rp(Math.abs((d.amount||0) - (d.oerAmount||0)))}</strong>. Harap transfer ke perusahaan dan kirim bukti via WhatsApp.
              </p>
            </div>
            <button className="btn sm" onClick={()=>nav&&nav("list")} style={{background:"white",color:"#7c3aed",fontWeight:800,flexShrink:0,fontSize:12}}>Lihat →</button>
          </div>
        </div>
      ))}

      {user.role==="admin_lk" && data.filter(d=>d.status==="pending").length>0 && <div className="al aw mb4"><Ic n="clock" s={14} c="#d97706"/><span><strong>{data.filter(d=>d.status==="pending").length} pengajuan</strong> menunggu dokumen diterima.</span></div>}
      {user.role==="finance" && approved.length>0 && <div className="al ab mb4"><Ic n="money" s={14} c="#2563eb"/><span><strong>{approved.length} pengajuan</strong> sudah disetujui, siap diproses.</span></div>}

      <div className="sg">
        <div className="st tl"><div className="sl">Total Diajukan</div><div className="sv md">{rp(totalRp)}</div><div className="ss">{mine.length} pengajuan</div></div>
        <div className="st am"><div className="sl">Sedang Berjalan</div><div className="sv">{active.length}</div></div>
        <div className="st gn"><div className="sl">Sudah Dibayar</div><div className="sv md">{rp(paidRp)}</div><div className="pb"><div className="pbf" style={{width:`${pct}%`,background:"var(--gn)"}}/></div><div className="ss">{pct}%</div></div>
        {overdue.length>0 && <div className="st rd"><div className="sl">CA Terlambat</div><div className="sv">{overdue.length}</div></div>}
        {user.role==="finance" && <><div className="st bl"><div className="sl">Siap Diproses</div><div className="sv">{approved.length}</div></div><div className="st pu"><div className="sl">Antrian Approval</div><div className="sv">{pending.length}</div></div></>}
      </div>

      <div className="card">
        <div className="ch"><h3>Pengajuan Terbaru</h3><button className="btn bo sm" onClick={()=>nav("list")}><Ic n="list" s={12}/>Lihat Semua</button></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Jenis</th><th>Keperluan</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>{mine.slice(0,6).map(d=>(
            <tr key={d.id} onClick={()=>nav("detail",d.id)}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--i3)"}}>{d.dept}</div></td>
              <td><TTag t={d.type}/></td>
              <td><div className="trunc" style={{maxWidth:180}}>{d.purpose}</div></td>
              <td className="bold">{rp(d.amount)}</td>
              <td><SBadge s={d.status} trx={d} isOwner={user.role==="employee"}/><LateBadge d={d}/></td>
            </tr>
          ))}</tbody>
        </table>{mine.length===0&&<div className="empty"><p>Belum ada pengajuan</p></div>}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUBMIT FORM
// ═══════════════════════════════════════════════════════════════
function SubmitPage({ user, onSubmit, data }) {
  const [f,setF] = useState({type:"reimburse",purpose:"",destination:"Jakarta",dateStart:"",dateEnd:"",approverName:"",notes:"",caRef:"",docRoute:"admin_jkt",items:[{cat:"Perjalanan Dinas",amt:""}]});
  const [submitState,setSubmitState] = useState("idle");
  const [savedEntry,setSavedEntry]   = useState(null);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const si=(i,k,v)=>setF(p=>{const it=[...p.items];it[i]={...it[i],[k]:v};return{...p,items:it};});
  const total = f.items.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);
  const myCAs = (data||[]).filter(d=>d.type==="cash_advance"&&(d.submitter===user.name||(user.username&&d.submitterUsername===user.username))&&["paid","awaiting_oer","oer_doc_pending","oer_doc_received","oer_doc_complete"].includes(d.status)&&!d.oerAmount);

  const submit = async () => {
    if (!f.purpose||!f.dateStart||!f.dateEnd||!f.approverName||total===0) { alert("Harap lengkapi semua field wajib (*)"); return; }
    const entry = {
      id:gid(), type:f.type, submitter:user.name, submitterUsername:user.username||"", dept:user.dept,
      area:user.area||"Jakarta", purpose:f.purpose, destination:f.destination, dateStart:f.dateStart, dateEnd:f.dateEnd,
      amount:total, status:"pending", submitted:today(), categories:f.items.map(it=>({cat:it.cat,amt:parseFloat(it.amt)||0})),
      notes:f.notes, settled:false, settledDate:null, approverName:f.approverName, financeNote:"", caRef:f.caRef||"", oerAmount:0,
      docRoute:f.docRoute||"admin_jkt",
    };
    if (!isReady()) { onSubmit(entry); return; }
    setSubmitState("saving"); setSavedEntry(entry);
    const res = await API.create(entry);
    if (!res) { setSubmitState("error"); return; }
    setSubmitState("verifying");
    let verified = false;
    for (let attempt=0; attempt<4; attempt++) {
      await new Promise(r=>setTimeout(r,800));
      const rows = await API.getAll();
      if (rows && rows.find(d=>d.id===entry.id)) { verified=true; break; }
    }
    if (!verified) { setSubmitState("error"); return; }
    setSubmitState("done"); await new Promise(r=>setTimeout(r,1200));
    onSubmit(entry);
  };

  if (submitState==="error") return (
    <div className="card"><div className="cb" style={{textAlign:"center",padding:"32px 16px"}}>
      <div style={{fontSize:36,marginBottom:12}}>❌</div>
      <p style={{fontSize:15,fontWeight:800,color:"var(--rd)",marginBottom:8}}>Gagal menyimpan pengajuan</p>
      <div style={{display:"flex",gap:9,justifyContent:"center"}}><button className="btn bo" onClick={()=>setSubmitState("idle")}>← Kembali</button><button className="btn bp" onClick={()=>{ setSubmitState("saving"); submit(); }}>🔄 Coba Lagi</button></div>
    </div></div>
  );

  if (submitState==="saving"||submitState==="verifying"||submitState==="done") {
    const steps = [
      {key:"saving",    icon:"⏳", label:"Menyimpan ke database...",           done: submitState!=="saving"},
      {key:"verifying", icon:"🔍", label:"Memverifikasi data tersimpan...",     done: submitState==="done"},
      {key:"done",      icon:"✅", label:"Pengajuan berhasil dikirim ke Admin!", done: false},
    ];
    const curIdx = submitState==="saving"?0:submitState==="verifying"?1:2;
    return (
      <div className="card"><div className="cb" style={{padding:"40px 16px"}}>
        <div style={{maxWidth:380,margin:"0 auto"}}>
          <p style={{fontSize:14,fontWeight:800,color:"var(--ink)",marginBottom:24,textAlign:"center"}}>{submitState==="done"?"🎉 Pengajuan Terkirim!":"⏳ Memproses Pengajuan..."}</p>
          {steps.map((st,i)=>(
            <div key={st.key} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",marginBottom:8,borderRadius:"var(--r2)",border:"1px solid",borderColor: i<curIdx?"var(--gnbd)":i===curIdx?"var(--tlbd)":"var(--ln)",background: i<curIdx?"var(--gnb)":i===curIdx?"var(--tlb)":"var(--w)"}}>
              <span style={{fontSize:18}}>{i<curIdx?"✅":i===curIdx?st.icon:"⬜"}</span>
              <span style={{fontSize:13,fontWeight:i===curIdx?700:400,color:i<curIdx?"var(--gn)":i===curIdx?"var(--tl)":"var(--i4)"}}>{st.label}</span>
              {i===curIdx&&submitState!=="done"&&<span className="sp2" style={{marginLeft:"auto"}}/>}
            </div>
          ))}
          {submitState==="done"&&savedEntry&&(
            <div style={{marginTop:16,padding:"12px 14px",background:"var(--gnb)",borderRadius:"var(--r2)",border:"1px solid var(--gnbd)",textAlign:"center"}}><p style={{fontSize:12,color:"var(--gn)",fontWeight:700}}>ID: {savedEntry.id}</p></div>
          )}
        </div>
      </div></div>
    );
  }

  return (
    <div><div className="card">
      <div className="ch"><div><h3>Form Pengajuan</h3><p style={{fontSize:11,color:"var(--i3)",marginTop:3}}>Oleh: <strong>{user.name}</strong> · {user.dept}</p></div></div>
      <div className="cb">
        <div className="fs mb4" style={{border:"2px solid var(--tl)",background:"var(--tlb)"}}>
          <div className="fst" style={{color:"var(--tl)"}}>📬 Jalur Pengiriman Dokumen <span style={{color:"var(--rd)"}}>*</span></div>
          <div style={{display:"flex",gap:9,marginTop:4}}>
            {[
              ["admin_jkt","🏢 Langsung ke Admin Jakarta","Karyawan Jakarta atau titip langsung"],
              ["admin_lk","📦 Lewat Admin Luar Kota","Karyawan luar kota, dokumen dikirim dulu"]
            ].map(([v,l,s])=>(
              <label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:9,padding:"12px 14px",borderRadius:"var(--r2)",border:`2px solid ${f.docRoute===v?"var(--tl)":"var(--ln)"}`,background:f.docRoute===v?"white":"rgba(255,255,255,0.6)",cursor:"pointer",margin:0}}>
                <input type="radio" name="dr" checked={f.docRoute===v} onChange={()=>set("docRoute",v)} style={{width:"auto",accentColor:"var(--tl)",flexShrink:0}}/>
                <div><div style={{fontSize:13,fontWeight:700,color:f.docRoute===v?"var(--tl)":"var(--ink)"}}>{l}</div><div style={{fontSize:11,color:"var(--i3)"}}>{s}</div></div>
              </label>
            ))}
          </div>
        </div>
        <div className="fs mb4">
          <div className="fst">Jenis Pengajuan</div>
          <div style={{display:"flex",gap:9}}>
            {[["reimburse","💰 Reimburse","Klaim setelah trip"],["cash_advance","🏦 Cash Advance","Ambil dana sebelum trip"]].map(([v,l,s])=>(
              <label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:9,padding:"11px 13px",borderRadius:"var(--r2)",border:`2px solid ${f.type===v?"var(--tl)":"var(--ln)"}`,background:f.type===v?"var(--tlb)":"var(--w)",cursor:"pointer",margin:0}}>
                <input type="radio" name="tp" checked={f.type===v} onChange={()=>set("type",v)} style={{width:"auto",accentColor:"var(--tl)"}}/>
                <div><div style={{fontSize:13,fontWeight:700}}>{l}</div><div style={{fontSize:11,color:"var(--i3)"}}>{s}</div></div>
              </label>
            ))}
          </div>
          {f.type==="reimburse" && myCAs.length>0 && (
            <div style={{marginTop:10,padding:"11px 14px",background:"#eff6ff",borderRadius:"var(--r2)",border:"1px solid #93c5fd"}}>
              <p style={{fontSize:12,fontWeight:700,color:"#1e40af",marginBottom:7}}>🔗 Link ke CA (jika ini OER untuk CA sebelumnya)</p>
              <select value={f.caRef} onChange={e=>set("caRef",e.target.value)} style={{background:"white"}}>
                <option value="">— Tidak ada CA terkait —</option>
                {myCAs.map(ca=><option key={ca.id} value={ca.id}>{ca.id} · {ca.purpose} · {rp(ca.amount)}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="fs mb4">
          <div className="fst">Detail Perjalanan</div>
          <div className="fg mb3"><label className="fl">Keperluan <span style={{color:"var(--rd)"}}>*</span></label><textarea value={f.purpose} onChange={e=>set("purpose",e.target.value)} rows={2}/></div>
          <div className="fg fg3">
            <div><label className="fl">Kota Tujuan <span style={{color:"var(--rd)"}}>*</span></label><input value={f.destination} onChange={e=>set("destination",e.target.value)}/></div>
            <div><label className="fl">Tgl Mulai <span style={{color:"var(--rd)"}}>*</span></label><input type="date" value={f.dateStart} onChange={e=>set("dateStart",e.target.value)}/></div>
            <div><label className="fl">Tgl Selesai <span style={{color:"var(--rd)"}}>*</span></label><input type="date" value={f.dateEnd} onChange={e=>set("dateEnd",e.target.value)}/></div>
          </div>
        </div>
        <div className="fs mb4">
          <div className="fst">Rincian Biaya</div>
          {f.items.map((it,i)=>(
            <div key={i} style={{display:"flex",gap:9,alignItems:"flex-end",marginBottom:8}}>
              <div style={{flex:2}}>{i===0&&<label className="fl">Kategori *</label>}<select value={it.cat} onChange={e=>si(i,"cat",e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div style={{flex:1.5}}>{i===0&&<label className="fl">Nominal (Rp) *</label>}<input type="number" value={it.amt} onChange={e=>si(i,"amt",e.target.value)} placeholder="0" min="0"/></div>
              {f.items.length>1 && <button className="btn bo xs" onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{color:"var(--rd)",borderColor:"#fca5a5",flexShrink:0}}><Ic n="trash" s={12}/></button>}
            </div>
          ))}
          <button className="btn bo sm" onClick={()=>setF(p=>({...p,items:[...p.items,{cat:"Perjalanan Dinas",amt:""}]}))}><Ic n="plus" s={12}/>Tambah Item</button>
          {total>0 && <div style={{marginTop:11,padding:"10px 13px",background:"var(--tlb)",border:"1px solid var(--tlbd)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,color:"var(--tl)"}}>Total</span><span style={{fontWeight:800,fontSize:16,color:"var(--tl)"}}>{rp(total)}</span></div>}
        </div>
        <div className="fs mb4"><div className="fst">Nama Admin <span style={{color:"var(--rd)"}}>*</span></div><input value={f.approverName} onChange={e=>set("approverName",e.target.value)}/></div>
        <div className="fs mb4"><div className="fst">Catatan (Opsional)</div><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:9}}>
          <button className="btn bp" onClick={submit} disabled={submitState!=="idle"}><Ic n="send" s={13}/>Submit Pengajuan</button>
        </div>
      </div>
    </div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LIST PAGE
// ═══════════════════════════════════════════════════════════════
function ListPage({ data, user, onSel }) {
  const [q,setQ]=useState(""); const [st,setSt]=useState(""); const [tp,setTp]=useState("");
  const isMyTrx = (d) => d.submitter===user.name || (user.username && d.submitterUsername===user.username);
  const base = user.role==="employee" ? data.filter(isMyTrx) : data;
  const rows = base.filter(d=>(!st||d.status===st)&&(!tp||d.type===tp)&&(!q||(d.purpose+d.id+d.submitter+d.destination).toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <div className="card mb4" style={{padding:"11px 16px"}}>
        <div className="flt">
          <input placeholder="Cari ID, nama, keperluan..." value={q} onChange={e=>setQ(e.target.value)} style={{flex:2}}/>
          <select value={st} onChange={e=>setSt(e.target.value)}><option value="">Semua Status</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          <select value={tp} onChange={e=>setTp(e.target.value)}><option value="">Semua Jenis</option><option value="reimburse">Reimburse</option><option value="cash_advance">Cash Advance</option></select>
        </div>
      </div>
      <div className="card">
        <div className="ch"><h3>Daftar Pengajuan <span style={{fontSize:12,color:"var(--i4)",fontWeight:400}}>({rows.length})</span></h3></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Jenis</th><th>Keperluan</th><th>Kota</th><th>Periode</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>{rows.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--i3)"}}>{d.dept}</div></td>
              <td><TTag t={d.type}/></td>
              <td><div className="trunc" style={{maxWidth:155}}>{d.purpose}</div></td>
              <td style={{fontSize:12,color:"var(--i3)"}}>{d.destination}</td>
              <td style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)}<br/>{fd(d.dateEnd)}</td>
              <td className="bold">{rp(d.amount)}</td>
              <td><SBadge s={d.status} trx={d} isOwner={user.role==="employee"}/><LateBadge d={d}/></td>
            </tr>
          ))}</tbody>
        </table>{rows.length===0&&<div className="empty"><Ic n="list" s={36}/><p style={{marginTop:10}}>Tidak ada data</p></div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN LK QUEUE
// ═══════════════════════════════════════════════════════════════
function AdminLKQueue({ data, onAction, onSel }) {
  const [sel, setSel] = useState({});
  const [adminName, setAdminName] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const queue = data.filter(d => d.status === "pending" && d.docRoute === "admin_lk")
    .filter(d => !searchQ || d.submitter.toLowerCase().includes(searchQ.toLowerCase()) || d.id.toLowerCase().includes(searchQ.toLowerCase()));
  const selIds = Object.keys(sel).filter(k => sel[k]);

  const doReceive = (ids) => {
    if (!adminName.trim()) { alert("Isi nama Admin dulu"); return; }
    ids.forEach(id => {
      onAction(id, "doc_received_lk", adminName);
      if (isReady()) API.docReceivedLK(id, adminName).catch(()=>{});
    });
    setSel({});
  };

  const doSendJkt = (ids) => {
    ids.forEach(id => { onAction(id, "doc_sent_jkt", null); if (isReady()) API.docSentJkt(id).catch(()=>{}); });
    setSel({});
  };

  const received = data.filter(d => d.status === "doc_received_lk")
    .filter(d => !searchQ || d.submitter.toLowerCase().includes(searchQ.toLowerCase()) || d.id.toLowerCase().includes(searchQ.toLowerCase()));
  const selReceivedIds = Object.keys(sel).filter(k => sel[k] && received.find(d=>d.id===k));

  return (
    <div>
      <div className="al ab mb4"><Ic n="bell" s={14} c="#2563eb"/><span><strong>Admin Luar Kota</strong> — Terima dokumen fisik dari karyawan, lalu kirim ke Jakarta.</span></div>
      <div className="card" style={{marginBottom:12}}>
        <div style={{padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,fontWeight:700,display:"block",marginBottom:6}}>Cari Nama Pemohon</label><input value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{marginBottom:0}}/></div>
          <div><label style={{fontSize:12,fontWeight:700,display:"block",marginBottom:6}}>Nama Admin (dicatat di sistem) *</label><input value={adminName} onChange={e=>setAdminName(e.target.value)} style={{marginBottom:0}}/></div>
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="ch">
          <h3>Menunggu Dokumen Diterima</h3>
          {selIds.filter(k=>queue.find(d=>d.id===k)).length > 0 && (
            <button className="btn bg sm" onClick={()=>doReceive(selIds.filter(k=>queue.find(d=>d.id===k)))}>Terima {selIds.filter(k=>queue.find(d=>d.id===k)).length} Dipilih</button>
          )}
        </div>
        <div className="tw"><table>
          <thead><tr><th><input type="checkbox" style={{width:"auto"}} onChange={e=>{const s={};queue.forEach(d=>{s[d.id]=e.target.checked;});setSel(p=>({...p,...s}));}}/></th><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Aksi</th></tr></thead>
          <tbody>{queue.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
              <td onClick={e=>e.stopPropagation()}><input type="checkbox" style={{width:"auto"}} checked={!!sel[d.id]} onChange={e=>setSel(p=>({...p,[d.id]:e.target.checked}))}/></td>
              <td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td><td><div className="trunc" style={{maxWidth:140}}>{d.purpose}</div></td>
              <td onClick={e=>e.stopPropagation()}><button className="btn bg xs" onClick={()=>doReceive([d.id])}><Ic n="check" s={11}/>Terima</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      {received.length > 0 && (
        <div className="card">
          <div className="ch">
            <h3>Sudah Diterima — Kirim ke Jakarta</h3>
            {selReceivedIds.length > 0 && <button className="btn bp sm" onClick={()=>doSendJkt(selReceivedIds)}>✈️ Kirim {selReceivedIds.length} ke JKT</button>}
          </div>
          <div className="tw"><table>
            <thead><tr><th><input type="checkbox" style={{width:"auto"}} onChange={e=>{const s={};received.forEach(d=>{s[d.id]=e.target.checked;});setSel(p=>({...p,...s}));}}/></th><th>ID</th><th>Pemohon</th><th>Aksi</th></tr></thead>
            <tbody>{received.map(d=>(
              <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
                <td onClick={e=>e.stopPropagation()}><input type="checkbox" style={{width:"auto"}} checked={!!sel[d.id]} onChange={e=>setSel(p=>({...p,[d.id]:e.target.checked}))}/></td>
                <td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td>
                <td onClick={e=>e.stopPropagation()}><button className="btn bp xs" onClick={()=>doSendJkt([d.id])}>✈️ Kirim JKT</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      {/* OER dari karyawan luar kota */}
      {(() => {
        const oerLKQueue = data.filter(d => d.status === "oer_doc_pending" && d.area && d.area !== "Jakarta");
        if (oerLKQueue.length === 0) return null;
        return (
          <div className="card" style={{marginTop:12}}>
            <div className="ch"><h3 style={{color:"#0e7490"}}>OER Masuk — Karyawan Luar Kota</h3></div>
            <div className="tw"><table>
              <thead><tr><th>ID CA</th><th>Pemohon</th><th>Aksi</th></tr></thead>
              <tbody>{oerLKQueue.map(d=>(
                <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
                  <td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td>
                  <td onClick={e=>e.stopPropagation()}>
                    <button className="btn bp xs" onClick={()=>{ if (!adminName.trim()) { alert("Isi nama Admin"); return; } onAction(d.id, "oer_doc_received", adminName); if (isReady()) API.oerDocReceived(d.id, adminName).catch(()=>{}); }}>✈️ Kirim JKT</button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
function AdminJKTQueue({ data, onAction, onSel }) {
  const [sel, setSel] = useState({});
  const [adminName, setAdminName] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const queue = data.filter(d => d.status === "doc_sent_jkt").filter(d => !searchQ || d.submitter.toLowerCase().includes(searchQ.toLowerCase()));
  const jktPending = data.filter(d => d.status === "pending" && (d.docRoute==="admin_jkt" || (!d.docRoute && (d.area==="Jakarta"||!d.area)))).filter(d => !searchQ || d.submitter.toLowerCase().includes(searchQ.toLowerCase()));

  const selLKIds  = Object.keys(sel).filter(k => sel[k] && queue.find(d=>d.id===k));
  const selJKTIds = Object.keys(sel).filter(k => sel[k] && jktPending.find(d=>d.id===k));

  const doReceive = (ids) => {
    if (!adminName.trim()) { alert("Isi nama Admin dulu"); return; }
    ids.forEach(id => { onAction(id, "doc_received_jkt", adminName); if (isReady()) API.docReceivedJkt(id, adminName).catch(()=>{}); });
    setSel({});
  };

  return (
    <div>
      <div className="card" style={{marginBottom:12}}>
        <div style={{padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:12,fontWeight:700,display:"block",marginBottom:6}}>Cari Nama Pemohon</label><input value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{marginBottom:0}}/></div>
          <div><label style={{fontSize:12,fontWeight:700,display:"block",marginBottom:6}}>Nama Admin Jakarta *</label><input value={adminName} onChange={e=>setAdminName(e.target.value)} style={{marginBottom:0}}/></div>
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="ch"><h3>Dari Luar Kota</h3>{selLKIds.length > 0 && <button className="btn bg sm" onClick={()=>doReceive(selLKIds)}>Terima {selLKIds.length}</button>}</div>
        <div className="tw"><table>
          <thead><tr><th><input type="checkbox" style={{width:"auto"}} onChange={e=>{const s={};queue.forEach(d=>{s[d.id]=e.target.checked;});setSel(p=>({...p,...s}));}}/></th><th>ID</th><th>Pemohon</th><th>Aksi</th></tr></thead>
          <tbody>{queue.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
              <td onClick={e=>e.stopPropagation()}><input type="checkbox" style={{width:"auto"}} checked={!!sel[d.id]} onChange={e=>setSel(p=>({...p,[d.id]:e.target.checked}))}/></td>
              <td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td>
              <td onClick={e=>e.stopPropagation()}><button className="btn bg xs" onClick={()=>doReceive([d.id])}><Ic n="check" s={11}/>Terima</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      {(() => {
        const oerQueue = data.filter(d => d.status === "oer_doc_pending");
        if (oerQueue.length === 0) return null;
        return (
          <div className="card" style={{marginBottom:12}}>
            <div className="ch"><h3 style={{color:"#0e7490"}}>OER Masuk</h3></div>
            <div className="tw"><table>
              <thead><tr><th>ID CA</th><th>Pemohon</th><th>Aksi</th></tr></thead>
              <tbody>{oerQueue.map(d=>(
                <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
                  <td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td>
                  <td onClick={e=>e.stopPropagation()}><button className="btn bg xs" onClick={()=>{ if (!adminName.trim()) { alert("Isi nama Admin"); return; } onAction(d.id, "oer_doc_received", adminName); if (isReady()) API.oerDocReceived(d.id, adminName).catch(()=>{}); }}><Ic n="check" s={11}/>Terima OER</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        );
      })()}
      {jktPending.length > 0 && (
        <div className="card">
          <div className="ch"><h3>Karyawan Jakarta (Langsung)</h3>{selJKTIds.length > 0 && <button className="btn bg sm" onClick={()=>doReceive(selJKTIds)}>Terima {selJKTIds.length}</button>}</div>
          <div className="tw"><table>
            <thead><tr><th><input type="checkbox" style={{width:"auto"}} onChange={e=>{const s={};jktPending.forEach(d=>{s[d.id]=e.target.checked;});setSel(p=>({...p,...s}));}}/></th><th>ID</th><th>Pemohon</th><th>Aksi</th></tr></thead>
            <tbody>{jktPending.map(d=>(
              <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
                <td onClick={e=>e.stopPropagation()}><input type="checkbox" style={{width:"auto"}} checked={!!sel[d.id]} onChange={e=>setSel(p=>({...p,[d.id]:e.target.checked}))}/></td>
                <td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td>
                <td onClick={e=>e.stopPropagation()}><button className="btn bg xs" onClick={()=>doReceive([d.id])}><Ic n="check" s={11}/>Terima</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GA QUEUE
// ═══════════════════════════════════════════════════════════════
function GAQueue({ data, onAction, onSel }) {
  const [sel, setSel] = useState({});
  const [gaNote, setGaNote] = useState("");
  const [editOerId, setEditOerId] = useState(null);
  const [oerVals, setOerVals] = useState({});
  const setOerVal = (id, v) => setOerVals(p=>({...p,[id]:v}));
  const queue    = data.filter(d => d.status === "doc_received_jkt");
  const oerQueue = data.filter(d => d.status === "oer_doc_received");
  const selIds = Object.keys(sel).filter(k => sel[k] && queue.find(d=>d.id===k));

  const doComplete = (ids) => {
    ids.forEach(id => {
      const oerAmt = editOerId === id && oerVals[id] ? parseFloat(oerVals[id]) : null;
      onAction(id, "doc_complete", gaNote||"Dokumen lengkap");
      if (isReady()) API.docComplete(id, oerAmt, gaNote||"Dokumen lengkap").catch(()=>{});
    });
    setSel({}); setGaNote(""); setEditOerId(null); setOerVals({});
  };

  const doOerComplete = (id, d) => {
    const note = gaNote || "OER dokumen lengkap";
    onAction(id, "oer_doc_complete", note);
    if (isReady()) API.oerDocComplete(id, note, d.amount, d.oerAmount).catch(()=>{});
    setGaNote("");
  };

  return (
    <div>
      {selIds.length > 0 && (
        <div className="card" style={{marginBottom:12,padding:"12px 16px",background:"var(--tlb)",border:"1px solid var(--tlbd)"}}>
          <p style={{fontSize:13,fontWeight:700,marginBottom:8,color:"#134e4a"}}>{selIds.length} pengajuan dipilih</p>
          <textarea value={gaNote} onChange={e=>setGaNote(e.target.value)} placeholder="Catatan GA (opsional)..." rows={2} style={{marginBottom:8}}/>
          <button className="btn bg sm" onClick={()=>doComplete(selIds)}><Ic n="check" s={13}/>Dokumen Lengkap {selIds.length}x</button>
        </div>
      )}
      <div className="card">
        <div className="ch"><h3>Antrian GA</h3><span style={{fontSize:12,color:"var(--i3)",fontWeight:600}}>{queue.length} pengajuan</span></div>
        <div className="tw"><table>
          <thead><tr>
            <th><input type="checkbox" style={{width:"auto"}} onChange={e=>{const s={};queue.forEach(d=>{s[d.id]=e.target.checked;});setSel(p=>({...p,...s}));}}/></th>
            <th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Nominal OER</th><th>Aksi</th>
          </tr></thead>
          <tbody>{queue.map(d=>(
            <tr key={d.id}>
              <td onClick={e=>e.stopPropagation()}><input type="checkbox" style={{width:"auto"}} checked={!!sel[d.id]} onChange={e=>setSel(p=>({...p,[d.id]:e.target.checked}))}/></td>
              <td style={{cursor:"pointer"}} onClick={()=>onSel(d.id)}><span className="mono">{d.id}</span></td>
              <td style={{cursor:"pointer"}} onClick={()=>onSel(d.id)}><div className="bold">{d.submitter}</div></td>
              <td style={{cursor:"pointer"}} onClick={()=>onSel(d.id)}><div className="trunc" style={{maxWidth:130}}>{d.purpose}</div></td>
              <td onClick={e=>e.stopPropagation()}>
                {editOerId === d.id ? (
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <input type="number" value={oerVals[d.id]||""} onChange={e=>setOerVal(d.id,e.target.value)} placeholder="Nominal" style={{width:110,padding:"4px 7px",fontSize:12}}/>
                    <button className="btn bg xs" onClick={()=>setEditOerId(null)}>✓</button>
                  </div>
                ) : (
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:700}}>{oerVals[d.id] && editOerId!==d.id ? rp(parseFloat(oerVals[d.id])) : (d.oerAmount ? rp(d.oerAmount) : <span style={{color:"var(--i4)"}}>—</span>)}</span>
                    <button className="btn bo xs" onClick={()=>setEditOerId(d.id)} style={{fontSize:10}}>✏️</button>
                  </div>
                )}
              </td>
              <td onClick={e=>e.stopPropagation()}><button className="btn bg xs" onClick={()=>doComplete([d.id])}><Ic n="check" s={11}/>Lengkap</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      {oerQueue.length > 0 && (
        <div className="card" style={{marginTop:14}}>
          <div className="ch"><h3 style={{color:"#7c3aed"}}>OER Dokumen — Perlu Dikonfirmasi GA</h3></div>
          <div className="tw"><table>
            <thead><tr><th>ID CA</th><th>Pemohon</th><th>Nominal CA</th><th>Nominal OER</th><th>Selisih</th><th>Aksi</th></tr></thead>
            <tbody>{oerQueue.map(d=>{
              const oerSel = (d.oerAmount||0) - d.amount;
              const selLabel = oerSel > 0 ? `Kurang ${rp(oerSel)}` : oerSel < 0 ? `Lebih ${rp(Math.abs(oerSel))}` : "Pas";
              const selColor = oerSel > 0 ? "#059669" : oerSel < 0 ? "#7c3aed" : "var(--i2)";
              return (
                <tr key={d.id}>
                  <td style={{cursor:"pointer"}} onClick={()=>onSel(d.id)}><span className="mono">{d.id}</span></td>
                  <td><div className="bold">{d.submitter}</div></td>
                  <td style={{fontWeight:700}}>{rp(d.amount)}</td>
                  <td style={{fontWeight:700,color:"var(--tl)"}}>{d.oerAmount?rp(d.oerAmount):"—"}</td>
                  <td style={{fontWeight:800,color:selColor,fontSize:12}}>{selLabel}</td>
                  <td><button className="btn bg xs" style={{background:"#7c3aed"}} onClick={()=>doOerComplete(d.id,d)}><Ic n="check" s={11}/>Approve OER</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MONITOR PAGE
// ═══════════════════════════════════════════════════════════════
function MonitorPage({ data, onSel, onAction }) {
  const [sel, setSel]           = useState({});
  const [bulkNote, setBulkNote] = useState("");
  const totalRp = data.reduce((a,d)=>a+d.amount,0);
  const paidRp  = data.filter(d=>d.status==="paid").reduce((a,d)=>a+d.amount,0);
  const pct = totalRp?Math.round(paidRp/totalRp*100):0;
  const overdue = data.filter(d=>d.isLate===true);
  const caOut   = data.filter(d=>d.type==="cash_advance"&&!d.settled&&!["rejected","settled"].includes(d.status));
  const needSettle = data.filter(d=>d.type==="cash_advance"&&["kurang_bayar","lebih_bayar"].includes(d.status)&&!d.settled);

  // BUG FIX: Sekarang "kurang_bayar", "lebih_bayar", dan "employee_confirmed" dimasukkan ke tabel agar bisa diklik Finance
  const actionable = data.filter(d=>["doc_complete","approved","processing","kurang_bayar","lebih_bayar","employee_confirmed"].includes(d.status) && !d.settled);
  
  const selIds = Object.keys(sel).filter(k=>sel[k]);
  const selDocs = selIds.filter(k=>actionable.find(d=>d.id===k));
  const selProcessable = selDocs.filter(k=>["doc_complete","approved"].includes(actionable.find(d=>d.id===k)?.status));
  const selPayable = selDocs.filter(k=>actionable.find(d=>d.id===k)?.status==="processing");

  const doBulkProcess = () => {
    selProcessable.forEach(id => {
      const trx = data.find(d=>d.id===id);
      onAction(id, "process", bulkNote, trx?.type);
      if (isReady()) API.updateStatus(id, "processing", bulkNote).catch(()=>{});
    });
    setSel({});
  };

  const doBulkPay = () => {
    selPayable.forEach(id => {
      const trx = data.find(d=>d.id===id);
      const supaStatus = trx?.type==="cash_advance" ? "awaiting_oer" : "paid";
      onAction(id, "pay", bulkNote, trx?.type);
      if (isReady()) API.updateStatus(id, supaStatus, bulkNote).catch(()=>{});
    });
    setSel({});
  };

  return (
    <div>
      {overdue.length>0 && <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><div><strong>{overdue.length} CA Terlambat:</strong>{overdue.map(d=><div key={d.id} style={{marginTop:3,fontSize:11.5}}>• {d.id} – {d.submitter} ({d.dept})</div>)}</div></div>}
      {needSettle.length>0 && (
        <div className="al" style={{marginBottom:16,background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:"var(--r2)",padding:"11px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
          <Ic n="money" s={14} c="#1d4ed8"/>
          <div>
            <strong style={{color:"#1e3a8a"}}>{needSettle.length} CA perlu settlement:</strong>
            {needSettle.map(d=>{
              const rc=recon(d);
              return <div key={d.id} style={{marginTop:4,fontSize:11.5,color:"#1e40af"}}>
                • {d.id} – {d.submitter}: {rc?.isKurang?`Finance transfer ${rp(Math.abs(rc.selisih))} ke karyawan`:`Finance terima ${rp(Math.abs(rc?.selisih||0))} dari karyawan`}
              </div>;
            })}
          </div>
        </div>
      )}
      <div className="sg mb5">
        <div className="st tl"><div className="sl">Total Diajukan</div><div className="sv md">{rp(totalRp)}</div><div className="ss">{data.length} pengajuan</div></div>
        <div className="st gn"><div className="sl">Sudah Dibayar</div><div className="sv md">{rp(paidRp)}</div><div className="pb"><div className="pbf" style={{width:`${pct}%`,background:"var(--gn)"}}/></div><div className="ss">{pct}%</div></div>
        {Object.entries(STATUS).filter(([k])=>data.some(d=>d.status===k)).map(([k,v])=>(
          <div key={k} className="st" style={{borderLeft:`3px solid ${v.dot}`}}>
            <div className="sl">{v.label}</div><div className="sv">{data.filter(d=>d.status===k).length}</div>
          </div>
        ))}
      </div>

      {selDocs.length > 0 && (
        <div className="card" style={{marginBottom:12,padding:"12px 16px",background:"var(--tlb)",border:"1px solid var(--tlbd)"}}>
          <p style={{fontSize:13,fontWeight:700,color:"#134e4a",marginBottom:10}}>{selDocs.length} transaksi dipilih</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
            <div style={{flex:1,minWidth:200}}>
              <label style={{fontSize:11,fontWeight:700,color:"var(--i2)",display:"block",marginBottom:4}}>Catatan Bulk</label>
              <input value={bulkNote} onChange={e=>setBulkNote(e.target.value)} placeholder="Catatan opsional..." style={{marginBottom:0}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {selProcessable.length>0 && (
              <button className="btn bp sm" onClick={doBulkProcess}>
                <Ic n="money" s={12}/>Mulai Proses {selProcessable.length}x
              </button>
            )}
            {selPayable.length>0 && (
              <button className="btn bg sm" onClick={doBulkPay}>
                <Ic n="check" s={12}/>Tandai Dibayar {selPayable.length}x
              </button>
            )}
            <button className="btn bo sm" onClick={()=>setSel({})}><Ic n="x" s={11}/>Batal</button>
          </div>
        </div>
      )}

      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><h3>Perlu Ditindak</h3><span style={{fontSize:12,color:"var(--i3)",fontWeight:600}}>{actionable.length} transaksi</span></div>
        <div className="tw"><table>
          <thead><tr>
            <th><input type="checkbox" style={{width:"auto"}} onChange={e=>{const s={};actionable.forEach(d=>{s[d.id]=e.target.checked;});setSel(p=>({...p,...s}));}}/></th>
            <th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Jumlah</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody>{actionable.map(d=>(
            <tr key={d.id}>
              <td onClick={e=>e.stopPropagation()}><input type="checkbox" style={{width:"auto"}} checked={!!sel[d.id]} onChange={e=>setSel(p=>({...p,[d.id]:e.target.checked}))}/></td>
              <td style={{cursor:"pointer"}} onClick={()=>onSel(d.id)}><span className="mono">{d.id}</span></td>
              <td style={{cursor:"pointer"}} onClick={()=>onSel(d.id)}><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--i3)"}}>{d.dept}</div></td>
              <td style={{cursor:"pointer"}} onClick={()=>onSel(d.id)}><div className="trunc" style={{maxWidth:130}}>{d.purpose}</div></td>
              <td className="bold" style={{cursor:"pointer"}} onClick={()=>onSel(d.id)}>{rp(d.amount)}</td>
              <td><SBadge s={d.status}/><LateBadge d={d}/></td>
              <td onClick={e=>e.stopPropagation()}>
                {["doc_complete","approved"].includes(d.status) && (
                  <button className="btn bp xs" onClick={()=>{
                    onAction(d.id,"process","",d.type);
                    if(isReady()) API.updateStatus(d.id,"processing","").catch(()=>{});
                  }}><Ic n="money" s={11}/>Proses</button>
                )}
                {d.status==="processing" && (
                  <button className="btn bg xs" onClick={()=>{
                    const supaStatus = d.type==="cash_advance"?"awaiting_oer":"paid";
                    onAction(d.id,"pay","",d.type);
                    if(isReady()) API.updateStatus(d.id,supaStatus,"").catch(()=>{});
                  }}><Ic n="check" s={11}/>Dibayar</button>
                )}
                {["kurang_bayar","lebih_bayar","employee_confirmed"].includes(d.status) && (
                  <button className="btn bo xs" onClick={()=>onSel(d.id)}>Buka Settle</button>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>{actionable.length===0&&<div className="empty" style={{padding:"20px 0"}}><p>Tidak ada yang perlu ditindak 🎉</p></div>}</div>
      </div>

      <div className="g2">
        <div className="card">
          <div className="ch"><h3>CA Outstanding ({caOut.length})</h3></div>
          <div style={{maxHeight:340,overflowY:"auto"}}>
            {caOut.map(d=>(
              <div key={d.id} onClick={()=>onSel(d.id)} style={{padding:"11px 16px",borderBottom:"1px solid var(--ln)",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span className="mono">{d.id}</span>
                  <div className="bold" style={{fontSize:13}}>{d.submitter}</div>
                  <div style={{fontSize:11,color:"var(--i3)"}}>Selesai: {fd(d.dateEnd)}</div>
                  {workdaysSinceEnd(d.dateEnd)>0 && (
                    <div style={{fontSize:10,fontWeight:700,color:workdaysSinceEnd(d.dateEnd)>5?"var(--rd)":"var(--am)",marginTop:2}}>
                      {workdaysSinceEnd(d.dateEnd)>5
                        ? `⚠️ Terlambat ${workdaysSinceEnd(d.dateEnd)-5} hr kerja`
                        : `${5-workdaysSinceEnd(d.dateEnd)} hr kerja tersisa`}
                    </div>
                  )}
                </div>
                <div style={{textAlign:"right"}}><div className="bold">{rp(d.amount)}</div><SBadge s={d.status}/><LateBadge d={d}/></div>
              </div>
            ))}
            {caOut.length===0&&<div className="empty" style={{padding:"20px 0"}}><p>Semua CA sudah settle 🎉</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════
function SettingsPage({ onSave }) {
  const [sbUrl,setSbUrl] = useState(CONFIG.SUPABASE_URL);
  const [sbKey,setSbKey] = useState(CONFIG.SUPABASE_KEY);
  const [pf,setPf]       = useState(CONFIG.PASS_FINANCE);
  const [palk,setPalk]   = useState(CONFIG.PASS_ADMIN_LK);
  const [pajkt,setPajkt] = useState(CONFIG.PASS_ADMIN_JKT);
  const [pga,setPga]     = useState(CONFIG.PASS_GA);
  const [saved,setSaved] = useState(false);
  const [testing,setTesting]   = useState(false);
  const [testResult,setTestResult] = useState(null);

  const save = () => {
    CONFIG.SUPABASE_URL   = sbUrl.trim();
    CONFIG.SUPABASE_KEY   = sbKey.trim();
    CONFIG.PASS_FINANCE   = pf;
    CONFIG.PASS_ADMIN_LK  = palk;
    CONFIG.PASS_ADMIN_JKT = pajkt;
    CONFIG.PASS_GA        = pga;
    _saveConfig({ SUPABASE_URL:sbUrl.trim(), SUPABASE_KEY:sbKey.trim(), PASS_FINANCE:pf, PASS_ADMIN_LK:palk, PASS_ADMIN_JKT:pajkt, PASS_GA:pga });
    setSaved(true); setTimeout(()=>setSaved(false),2500);
    if (onSave) onSave();
  };

  const testConn = async () => {
    if (!sbUrl||!sbKey) { setTestResult("✗ Isi URL dan Key dulu"); return; }
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(sbUrl.trim()+"/rest/v1/transactions?select=id&limit=1",{
        headers:{"apikey":sbKey.trim(),"Authorization":"Bearer "+sbKey.trim()}
      });
      setTestResult(r.ok||r.status===406 ? "✓ Terhubung ke Supabase!" : "✗ Error "+r.status+" — cek URL dan Key");
    } catch(e) { setTestResult("✗ Gagal: "+e.message); }
    setTesting(false);
  };

  return (
    <div>
      <div className="card mb4">
        <div className="ch"><h3>Koneksi Supabase</h3></div>
        <div className="cb">
          <div className="al ab mb4"><Ic n="settings" s={14} c="#2563eb"/><span>Isi Project URL dan Anon Key dari Supabase agar data tersimpan ke database secara real-time.</span></div>
          <div className="fg mb3">
            <label className="fl">Supabase Project URL</label>
            <input value={sbUrl} onChange={e=>setSbUrl(e.target.value)} placeholder="https://xxxx.supabase.co"/>
          </div>
          <div className="fg mb3">
            <label className="fl">Supabase Anon Key</label>
            <input value={sbKey} onChange={e=>setSbKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."/>
          </div>
          <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:4}}>
            <button className="btn bo sm" onClick={testConn} disabled={testing}>
              {testing ? "Testing..." : "🔌 Test Koneksi"}
            </button>
            {testResult && <span style={{fontSize:12,fontWeight:700,color:testResult.startsWith("✓")?"var(--gn)":"var(--rd)"}}>{testResult}</span>}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="ch"><h3>Password Login</h3></div>
        <div className="cb">
          <div className="fg fg2 mb4">
            <div><label className="fl">Password Finance</label><input value={pf} onChange={e=>setPf(e.target.value)}/></div>
            <div><label className="fl">Password GA</label><input value={pga} onChange={e=>setPga(e.target.value)}/></div>
          </div>
          <div className="fg fg2 mb4">
            <div><label className="fl">Password Admin Luar Kota</label><input value={palk} onChange={e=>setPalk(e.target.value)}/></div>
            <div><label className="fl">Password Admin Jakarta</label><input value={pajkt} onChange={e=>setPajkt(e.target.value)}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:9,alignItems:"center"}}>
            {saved && <span style={{color:"var(--gn)",fontWeight:700,fontSize:13}}>✓ Disimpan!</span>}
            <button className="btn bp" onClick={save}><Ic n="check" s={13}/>Simpan Perubahan</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EDIT FORM
// ═══════════════════════════════════════════════════════════════
function EditForm({ trx, user, onSave, onCancel }) {
  const [f,setF] = useState({
    type:        trx.type, purpose: trx.purpose, destination: trx.destination,
    dateStart:   trx.dateStart, dateEnd: trx.dateEnd, approverName:trx.approverName,
    notes:       trx.notes||"", items: trx.categories.map(c=>({cat:c.cat, amt:String(c.amt)})),
  });
  const [busy,setBusy] = useState(false);
  const set  = (k,v) => setF(p=>({...p,[k]:v}));
  const si   = (i,k,v) => setF(p=>{const it=[...p.items];it[i]={...it[i],[k]:v};return{...p,items:it};});
  const total = f.items.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);

  const save = async () => {
    if (!f.purpose||!f.dateStart||!f.dateEnd||!f.approverName||total===0){alert("Harap lengkapi semua field wajib.");return;}
    setBusy(true);
    const updated = {
      ...trx, type: f.type, purpose: f.purpose, destination: f.destination, dateStart: f.dateStart, dateEnd: f.dateEnd,
      approverName:f.approverName, notes: f.notes, amount: total, categories: f.items.map(it=>({cat:it.cat, amt:parseFloat(it.amt)||0})),
    };
    if (isReady()) await API.editData(trx.id, updated);
    else await new Promise(r=>setTimeout(r,400));
    setBusy(false);
    onSave(updated);
  };

  return (
    <div style={{padding:"4px 0"}}>
      <div className="al aw mb4" style={{marginBottom:14}}><Ic n="alert" s={14} c="#d97706"/><span>Edit Pengajuan</span></div>
      <div className="fs mb3">
        <div className="fst">Jenis Pengajuan</div>
        <div style={{display:"flex",gap:9}}>
          {[["reimburse","💰 Reimburse"],["cash_advance","🏦 Cash Advance"]].map(([v,l])=>(
            <label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:"var(--r2)",border:`2px solid ${f.type===v?"var(--tl)":"var(--ln)"}`,background:f.type===v?"var(--tlb)":"var(--w)",cursor:"pointer",margin:0}}>
              <input type="radio" name="etp" checked={f.type===v} onChange={()=>set("type",v)} style={{width:"auto",accentColor:"var(--tl)"}}/>
              <span style={{fontSize:13,fontWeight:700}}>{l}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="fs mb3">
        <div className="fst">Detail Perjalanan</div>
        <div className="fg mb3"><label className="fl">Keperluan *</label><textarea value={f.purpose} onChange={e=>set("purpose",e.target.value)} rows={2}/></div>
        <div className="fg fg3">
          <div><label className="fl">Kota Tujuan</label><input value={f.destination} onChange={e=>set("destination",e.target.value)}/></div>
          <div><label className="fl">Tgl Mulai</label><input type="date" value={f.dateStart} onChange={e=>set("dateStart",e.target.value)}/></div>
          <div><label className="fl">Tgl Selesai</label><input type="date" value={f.dateEnd} onChange={e=>set("dateEnd",e.target.value)}/></div>
        </div>
      </div>
      <div className="fs mb3">
        <div className="fst">Rincian Biaya</div>
        {f.items.map((it,i)=>(
          <div key={i} style={{display:"flex",gap:9,alignItems:"flex-end",marginBottom:8}}>
            <div style={{flex:2}}>{i===0&&<label className="fl">Kategori</label>}<select value={it.cat} onChange={e=>si(i,"cat",e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div style={{flex:1.5}}>{i===0&&<label className="fl">Nominal (Rp)</label>}<input type="number" value={it.amt} onChange={e=>si(i,"amt",e.target.value)} placeholder="0" min="0"/></div>
            {f.items.length>1&&<button className="btn bo xs" onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{color:"var(--rd)",borderColor:"#fca5a5",flexShrink:0}}><Ic n="trash" s={12}/></button>}
          </div>
        ))}
        <button className="btn bo sm" onClick={()=>setF(p=>({...p,items:[...p.items,{cat:"Perjalanan Dinas",amt:""}]}))}><Ic n="plus" s={12}/>Tambah Item</button>
      </div>
      <div className="fg fg2 mb3">
        <div className="fs"><div className="fst">Nama Admin *</div><input value={f.approverName} onChange={e=>set("approverName",e.target.value)}/></div>
        <div className="fs"><div className="fst">Catatan</div><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:9}}>
        <button className="btn bo" onClick={onCancel} disabled={busy}>Batal</button>
        <button className="btn bp" onClick={save} disabled={busy}>{busy?<span className="sp2"/>:<Ic n="check" s={13}/>}{busy?"Menyimpan...":"Simpan Perubahan"}</button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// OER RECON BOX — Finance edit OER + Konfirmasi karyawan
// ═══════════════════════════════════════════════════════════════
function OerReconBox({ trx, rc, isFin, isOwner, onAction }) {
  const [editMode, setEditMode]   = useState(false);
  const [items, setItems]         = useState(OER_CATS.map(cat => ({ cat, amt: (trx.oerCategories||[]).find(x=>x.cat===cat) ? String((trx.oerCategories||[]).find(x=>x.cat===cat).amt) : "" })));
  const [oerNote, setOerNote]     = useState(trx.oerNote||"");

  const editTotal = items.reduce((s,it)=>s+(parseFloat(it.amt)||0),0);
  const setAmt = (i,v) => setItems(prev=>{const n=[...prev];n[i]={...n[i],amt:v};return n;});
  const editRc = editMode ? (() => { const selisih = editTotal - trx.amount; return { ca:trx.amount, oer:editTotal, selisih, isKurang:selisih>0, isLebih:selisih<0, isLunas:selisih===0 }; })() : rc;

  const saveEditedOer = () => {
    const cats = items.filter(it=>parseFloat(it.amt)>0).map(it=>({cat:it.cat,amt:parseFloat(it.amt)}));
    onAction(trx.id, "edit_oer", { oerCategories:cats, oerNote, caAmount:trx.amount });
    if (isReady()) API.updateOer(trx.id, cats, oerNote, trx.amount).catch(()=>{});
    setEditMode(false);
  };

  const sendForConfirmation = () => {
    onAction(trx.id, "send_confirm", {});
    if (isReady()) SB.update(trx.id, { status: "awaiting_confirm" }).catch(()=>{});
  };

  const [settleLBNote, setSettleLBNote] = useState("");
  const [settlingLB,   setSettlingLB]   = useState(false);

  const doSettleLebihBayar = async () => {
    setSettlingLB(true);
    try {
      onAction(trx.id, "settle_lebih_bayar", settleLBNote, trx.type);
      if (isReady()) await SB.update(trx.id, { status: "settled", settled: true, settled_date: today(), finance_note: settleLBNote }).catch(()=>{});
    } finally { setSettlingLB(false); }
  };

  const [uploading, setUploading] = useState(false);
  const confirmOer = async () => {
    setUploading(true);
    try { onAction(trx.id, "emp_confirm", {}); if (isReady()) SB.update(trx.id, { status: "employee_confirmed" }).catch(()=>{}); }
    finally { setUploading(false); }
  };

  const colH  = editRc.isKurang?"#1e3a8a":editRc.isLebih?"#4c1d95":"#065f46";
  const bgH   = editRc.isKurang?"#dbeafe":editRc.isLebih?"#ede9fe":"#ecfdf5";
  const bdH   = editRc.isKurang?"#93c5fd":editRc.isLebih?"#c4b5fd":"#6ee7b7";
  const colV  = editRc.isKurang?"#1e40af":editRc.isLebih?"#7c3aed":"#059669";

  return (
    <div style={{marginBottom:16,border:"2px solid",borderColor:bdH,borderRadius:"var(--r2)",overflow:"hidden"}}>
      <div style={{padding:"9px 14px",background:bgH,fontWeight:800,fontSize:12,color:colH,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>📊 Rekonsiliasi CA vs OER</span>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {editRc.isKurang&&<span style={{background:"#1e40af",color:"white",padding:"2px 10px",borderRadius:20,fontSize:11}}>KURANG BAYAR</span>}
          {editRc.isLebih&&<span style={{background:"#7c3aed",color:"white",padding:"2px 10px",borderRadius:20,fontSize:11}}>LEBIH BAYAR</span>}
          {editRc.isLunas&&<span style={{background:"#059669",color:"white",padding:"2px 10px",borderRadius:20,fontSize:11}}>LUNAS</span>}
          {isFin && !trx.settled && !["awaiting_confirm","employee_confirmed","settled"].includes(trx.status) && (
            <button className="btn bo sm" onClick={()=>setEditMode(v=>!v)} style={{fontSize:10,padding:"2px 8px"}}>{editMode ? "Batal" : "✏️ Edit OER"}</button>
          )}
        </div>
      </div>

      <div style={{padding:"12px 14px"}}>
        {editMode && isFin ? (
          <>
            <div style={{marginBottom:10,borderRadius:"var(--r3)",overflow:"hidden",border:"1px solid var(--ln)"}}>
              <div style={{padding:"6px 12px",background:"var(--ln2)",fontSize:10.5,fontWeight:800,color:"var(--i3)",textTransform:"uppercase"}}>Edit Rincian OER</div>
              {items.map((it,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",padding:"7px 12px",borderBottom:i<items.length-1?"1px solid var(--ln)":"none",gap:10}}>
                  <span style={{flex:2,fontSize:12,color:"var(--i2)"}}>{it.cat}</span>
                  <input type="number" value={it.amt} onChange={e=>setAmt(i,e.target.value)} placeholder="0" min="0" style={{flex:1,padding:"5px 8px",border:"1px solid var(--ln)",borderRadius:6,fontSize:12,textAlign:"right"}}/>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 12px",background:bgH,borderTop:"2px solid "+bdH}}>
                <span style={{fontWeight:800,color:colH}}>Total OER</span>
                <span style={{fontWeight:800,fontSize:15,color:colH}}>{rp(editTotal)}</span>
              </div>
            </div>
            <textarea value={oerNote} onChange={e=>setOerNote(e.target.value)} placeholder="Catatan koreksi OER..." rows={2} style={{marginBottom:9}}/>
            <div style={{display:"flex",gap:8}}>
              <button className="btn bg" onClick={saveEditedOer} disabled={editTotal===0}><Ic n="check" s={13}/>Simpan Koreksi</button>
              <button className="btn bo" onClick={()=>setEditMode(false)}>Batal</button>
            </div>
          </>
        ) : (
          <>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
              <span style={{color:"var(--i3)"}}>CA Dicairkan</span><span style={{fontWeight:700}}>{rp(rc.ca)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
              <span style={{color:"var(--i3)"}}>Total Biaya OER</span><span style={{fontWeight:700}}>{rp(rc.oer)}</span>
            </div>
            <div style={{height:1,background:"var(--ln)",margin:"8px 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}>
              <span style={{fontWeight:800,color:colV}}>{rc.isKurang?"Finance transfer ke karyawan":rc.isLebih?"Finance terima kembalian dari karyawan":"Selisih"}</span>
              <span style={{fontWeight:800,fontSize:16,color:colV}}>{rp(Math.abs(rc.selisih))}</span>
            </div>

            {/* Finance: SETTLEMENT LEBIH BAYAR */}
            {isFin && !trx.settled && rc && !rc.isLunas && ["lebih_bayar"].includes(trx.status) && (
              <div style={{marginTop:12,padding:"14px",background:"#f5f3ff",borderRadius:"var(--r2)",border:`2px solid #c4b5fd`}}>
                <p style={{fontSize:13,fontWeight:800,color:"#4c1d95",marginBottom:4}}>💜 Lebih Bayar — Terima Kembalian</p>
                <div style={{padding:"10px 12px",background:"#ede9fe",borderRadius:"var(--r3)",border:`1px solid #c4b5fd`,marginBottom:12}}>
                  <p style={{fontSize:12,fontWeight:700,color:"#4c1d95"}}>Terima pengembalian dana {rp(Math.abs(rc.selisih))} dari {trx.submitter}</p>
                  <p style={{fontSize:11,color:"#6d28d9",marginTop:3}}>Pastikan karyawan sudah mengirim bukti transfer via WhatsApp.</p>
                </div>
                <textarea value={settleLBNote} onChange={e=>setSettleLBNote(e.target.value)} placeholder="No. referensi transfer / catatan (opsional)..." rows={2} style={{marginBottom:9}}/>
                <button className="btn bg" onClick={doSettleLebihBayar} disabled={settlingLB} style={{background:"#7c3aed",width:"100%"}}>
                  {settlingLB?<span className="sp2"/>:<Ic n="check" s={13}/>}
                  Konfirmasi Dana Diterima — Selesaikan
                </button>
              </div>
            )}

            {/* Finance: KURANG BAYAR — kirim ke karyawan */}
            {isFin && !trx.settled && trx.status==="kurang_bayar" && (
              <button className="btn bp" onClick={sendForConfirmation} style={{marginTop:12,width:"100%"}}><Ic n="send" s={13}/>Kirim ke Karyawan untuk Konfirmasi</button>
            )}

            {/* Employee: LEBIH BAYAR — WA */}
            {isOwner && !trx.settled && rc && rc.isLebih && (
              <div style={{marginTop:12,padding:"12px 14px",background:"#fff7ed",borderRadius:"var(--r3)",border:"1px solid #fdba74"}}>
                <p style={{fontSize:12,fontWeight:800,color:"#c2410c",marginBottom:4}}>⚠️ Pengembalian Sisa Dana CA</p>
                <p style={{fontSize:12,color:"#9a3412"}}>Terdapat sisa dana (Lebih Bayar) sebesar <strong style={{color:"#c2410c"}}>{rp(Math.abs(rc.selisih))}</strong>.</p>
                <div style={{marginTop:8,padding:"8px 10px",background:"#ffedd5",borderRadius:"var(--r3)"}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#9a3412"}}>Instruksi:</p>
                  <ol style={{fontSize:11,color:"#9a3412",marginLeft:16,marginTop:4}}>
                    <li>Transfer sisa dana tersebut ke rekening perusahaan.</li>
                    <li>Kirimkan foto bukti transfer langsung ke <strong>WhatsApp Finance</strong>.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Employee: KURANG BAYAR — Konfirmasi */}
            {isOwner && trx.status==="awaiting_confirm" && rc.isKurang && (
              <div style={{marginTop:12}}>
                <div style={{padding:"12px 14px",background:"linear-gradient(135deg,#1e40af,#3b82f6)",borderRadius:"var(--r3)",marginBottom:10,color:"white"}}>
                  <p style={{fontSize:12,fontWeight:800,marginBottom:4}}>📩 Finance meminta konfirmasi nominal</p>
                  <p style={{fontSize:13,fontWeight:700}}>✅ Perusahaan akan transfer {rp(Math.abs(rc.selisih))} ke rekeningmu</p>
                  <p style={{fontSize:11,color:"rgba(255,255,255,0.8)",marginTop:4}}>Konfirmasi jika nominal di atas sudah sesuai.</p>
                </div>
                <button className="btn bg" onClick={confirmOer} disabled={uploading} style={{width:"100%",marginBottom:8}}>
                  {uploading ? <span className="sp2"/> : <Ic n="check" s={13}/>} {uploading ? "Menyimpan..." : "Saya Setuju & Konfirmasi Nominal"}
                </button>
              </div>
            )}

            {/* Employee: sudah konfirmasi */}
            {isOwner && trx.status==="employee_confirmed" && (
              <div style={{marginTop:10,borderRadius:"var(--r3)",overflow:"hidden",border:"1px solid #a7f3d0"}}>
                <div style={{padding:"10px 12px",background:"#f0fdf4"}}>
                  <p style={{fontSize:12,fontWeight:800,color:"#065f46"}}>✓ Kamu sudah mengkonfirmasi — menunggu Finance mentransfer</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function DetailModal({ trx, user, onClose, onAction, onEdit }) {
  const [note,setNote]           = useState("");
  const [busy, setBusy] = useState(false);
  const [editing,setEditing] = useState(false);
  const isFin = user.role==="finance";
  const isGA  = user.role==="ga";
  const isOwner = user.role==="employee" && (trx.submitter===user.name || (user.username && trx.submitterUsername===user.username));
  const LOCKED_STATUSES = ["paid","rejected","settled","awaiting_oer","oer_doc_pending","oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","disputed"];
  const canEdit = (isFin || isGA || (isOwner && !LOCKED_STATUSES.includes(trx.status)));

  const act = (action, n, tDate) => {
    setBusy(true);
    let supabaseStatus;
    if (action === "pay") {
      supabaseStatus = trx.type === "cash_advance" ? "awaiting_oer" : "paid";
    } else {
      const sm = {approve:"approved",reject:"rejected",process:"processing",doc_complete:"doc_complete"};
      supabaseStatus = sm[action] || action;
    }
    onAction(trx.id, action, n, trx.type, tDate||"");
    if (isReady()) {
      const p = {status:supabaseStatus, finance_note:n||""};
      if (action==="pay" && tDate) p.transfer_date = tDate;
      SB.update(trx.id, p).catch(e=>console.error("sync error:",e)).finally(()=>setBusy(false));
    } else setBusy(false);
  };

  const [transferDate, setTransferDate] = useState(trx.transferDate||"");

  const settle = () => {
    onAction(trx.id, "settle", note, trx.type);
    if (isReady()) SB.update(trx.id, { status:"settled", settled:true, settled_date:today(), finance_note:note||"" }).catch(()=>{});
  };

  const [oerItems, setOerItems] = useState(OER_CATS.map(cat=>({cat,amt:""})));
  const [oerNote, setOerNote]   = useState("");
  const [showOerForm, setShowOerForm] = useState(false);
  const oerTotal = oerItems.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);
  const setOi = (i,v) => setOerItems(prev=>{const n=[...prev];n[i]={...n[i],amt:v};return n;});

  const submitOer = () => {
    if (oerTotal===0) { alert("Isi minimal satu item biaya OER"); return; }
    const oerData = { oerAmount: oerTotal, oerCategories: oerItems.filter(it=>parseFloat(it.amt)>0).map(it=>({cat:it.cat,amt:parseFloat(it.amt)})), oerNote, oerDate: today() };
    onAction(trx.id, "oer_submitted", oerData);
    if (isReady()) API.submitOer(trx.id, oerData, trx.amount).catch(()=>{});
  };

  const rc = recon(trx);

  // LOGIKA TIMELINE BEBAS BUG
  const OER_STATUSES = ["awaiting_oer","oer_doc_pending","oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"];
  const isOERPhase = OER_STATUSES.includes(trx.status);
  const OER_SUBMITTED = ["oer_doc_pending","oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"].includes(trx.status);
  const docStatuses = ["doc_received_lk","doc_sent_jkt","doc_received_jkt","doc_complete","approved","processing","paid",...OER_STATUSES];
  
  const tlBase = [
    {ok:true, icon:"send", title:"Pengajuan Dikirim", sub:`${trx.submitter} · ${fd(trx.submitted)}`, col:"var(--tl)"},
    {ok:docStatuses.includes(trx.status), icon:"user", title:"Diterima Admin LK", sub:trx.adminLkName||(trx.status==="pending"?"Menunggu dokumen fisik…":"–"), col:"var(--tl)"},
    {ok:["doc_sent_jkt","doc_received_jkt","doc_complete","approved","processing","paid",...OER_STATUSES].includes(trx.status), icon:"send", title:"Dikirim ke Jakarta", sub:"", col:"var(--bl)"},
    {ok:["doc_received_jkt","doc_complete","approved","processing","paid",...OER_STATUSES].includes(trx.status), icon:"user", title:"Diterima Admin Jakarta", sub:trx.adminJktName||"–", col:"var(--tl)"},
    {ok:["doc_complete","approved","processing","paid",...OER_STATUSES].includes(trx.status), icon:"check", title:"Dokumen Lengkap (GA)", sub:trx.gaNote||"–", col:"var(--gn)"},
    {ok:["processing","paid",...OER_STATUSES].includes(trx.status), icon:"money", title:"Diproses Finance", sub:"", col:"var(--pu)"},
  ];

  const tl = trx.type === "cash_advance" ? [
    ...tlBase,
    {ok:isOERPhase, icon:"check", title:"Pembayaran CA Pertama", sub:isOERPhase?`Dibayar · ${fd(trx.settledDate)}`:"", col:"var(--gn)"},
    {ok:OER_SUBMITTED, icon:"send", title:"OER Disubmit Karyawan", sub:trx.oerDate?`${fd(trx.oerDate)} · ${rp(trx.oerAmount||0)}`:"", col:"#ca8a04"},
    {ok:["oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"].includes(trx.status), icon:"user", title:"OER Diterima Admin JKT", sub:"", col:"var(--tl)"},
    {ok:["oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"].includes(trx.status), icon:"check", title:"OER Disetujui GA", sub:trx.gaOerNote||"", col:"var(--gn)"},
    {ok:trx.settled || trx.status==="settled", icon:"check", title:"Rekonsiliasi Selesai", sub:(trx.settled || trx.status==="settled")?`Lunas ✓ · ${fd(trx.settledDate)}`:"Menunggu", col:(trx.settled || trx.status==="settled")?"var(--gn)":"var(--i4)"}
  ] : [
    ...tlBase,
    {ok:trx.status==="paid" || trx.settled, icon:"check", title:"Pembayaran Selesai", sub:(trx.status==="paid" || trx.settled)?`Lunas ✓ · ${fd(trx.settledDate)}`:"Menunggu", col:(trx.status==="paid" || trx.settled)?"var(--gn)":"var(--i4)"}
  ];

  return (
    <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mo">
        <div className="mh">
          <div style={{flex:1}}>
            <span className="mono">{trx.id}</span>
            <h2 style={{fontSize:15,fontWeight:800,marginTop:3}}>{trx.purpose}</h2>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {canEdit && !editing && <button className="btn bo sm" onClick={()=>setEditing(true)} style={{color:"var(--bl)",borderColor:"var(--blbd)"}}>✏️ Edit</button>}
            {editing && <span style={{fontSize:11,fontWeight:700,color:"var(--am)",background:"var(--amb)",padding:"3px 9px",borderRadius:20}}>Mode Edit</span>}
            <button className="btn bo sm" onClick={onClose}><Ic n="x" s={13}/></button>
          </div>
        </div>
        <div className="mb2">
          {editing ? (
            <EditForm trx={trx} user={user} onSave={(updated) => { setEditing(false); onEdit(updated); }} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,alignItems:"center",padding:"9px 13px",background:"var(--ln2)",borderRadius:"var(--r2)",marginBottom:16}}>
                <TTag t={trx.type}/><SBadge s={trx.status} trx={trx} isOwner={isOwner}/><LateBadge d={trx}/><span style={{marginLeft:"auto",fontSize:11,color:"var(--i3)"}}>Diajukan {fd(trx.submitted)}</span>
              </div>
              
              {/* Notifikasi transfer / antrian karyawan */}
              {isOwner && (trx.status==="paid"||trx.status==="awaiting_oer") && trx.transferDate && (()=>{
                const todayD = new Date(); todayD.setHours(0,0,0,0);
                const estD   = new Date(trx.transferDate); estD.setHours(0,0,0,0);
                const diffDays = Math.round((estD-todayD)/(1000*60*60*24));
                const isQueued = estD >= todayD;
                if (!isQueued) return null;
                return (
                  <div style={{marginBottom:12,padding:"12px 14px",background:"#e0f2fe",border:"1px solid #7dd3fc",borderRadius:"var(--r3)",display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:18,lineHeight:1}}>🏦</span>
                    <div>
                      <p style={{fontSize:13,fontWeight:800,color:"#0c4a6e",marginBottom:2}}>Dalam Antrian Transfer</p>
                      <p style={{fontSize:12,color:"#0369a1"}}>Estimasi masuk rekening: <strong>{new Date(trx.transferDate).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</strong>{diffDays===0?" (hari ini)":diffDays===1?` (besok)`:diffDays>0?` (${diffDays} hari lagi)`:""}</p>
                    </div>
                  </div>
                );
              })()}

              <div className="g2 mb4">
                <div>
                  <p style={{fontSize:10.5,fontWeight:800,color:"var(--i3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>Pemohon</p>
                  <p className="bold">{trx.submitter}</p><p style={{fontSize:12,color:"var(--i3)"}}>{trx.dept}</p>
                </div>
                <div>
                  <p style={{fontSize:10.5,fontWeight:800,color:"var(--i3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>Perjalanan</p>
                  <p className="bold">{trx.destination}</p><p style={{fontSize:12,color:"var(--i3)"}}>{fd(trx.dateStart)} – {fd(trx.dateEnd)}</p>
                </div>
              </div>

              <div style={{border:"1px solid var(--ln)",borderRadius:"var(--r2)",overflow:"hidden",marginBottom:16}}>
                <div style={{background:"var(--ln2)",padding:"8px 14px",fontSize:10.5,fontWeight:800,color:"var(--i3)",textTransform:"uppercase",letterSpacing:".06em"}}>Rincian Biaya</div>
                {trx.categories.map((c,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 14px",borderBottom:i<trx.categories.length-1?"1px solid var(--ln)":"none",fontSize:13}}>
                    <span>{c.cat}</span><span className="bold">{rp(c.amt)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",background:"var(--tlb)",borderTop:"2px solid var(--tl)"}}>
                  <span style={{fontWeight:800,color:"var(--tl)"}}>TOTAL</span><span style={{fontWeight:800,fontSize:16,color:"var(--tl)"}}>{rp(trx.amount)}</span>
                </div>
              </div>

              {/* ── REKONSILIASI CA vs OER ── */}
              {trx.type==="cash_advance" && rc && <OerReconBox trx={trx} rc={rc} isFin={isFin} isOwner={isOwner} onAction={onAction}/>}

              {/* TIMELINE */}
              <p style={{fontSize:10.5,fontWeight:800,color:"var(--i3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10,marginTop:20}}>Progress</p>
              <div>{tl.map((t,i)=>(
                <div key={i} className="tlr">
                  <div className="tldc"><div className="tld" style={{background:t.ok?t.col:"var(--ln)"}}><Ic n={t.icon} s={12} c={t.ok?"#fff":"var(--i4)"}/></div>{i<tl.length-1&&<div className="tlln"/>}</div>
                  <div className="tlb"><div className="tlt" style={{color:t.ok?"var(--ink)":"var(--i4)"}}>{t.title}</div><div className="tls">{t.sub}</div></div>
                </div>
              ))}</div>

              {/* ACTIONS FINANCE */}
              {isFin&&["approved","doc_complete"].includes(trx.status)&&(
                <div style={{marginTop:16,padding:14,background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
                  <p style={{fontSize:13,fontWeight:700,marginBottom:9}}>Mulai Proses</p>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan Finance (opsional)..." rows={2} style={{marginBottom:9}}/>
                  <button className="btn bp" onClick={()=>act("process",note,"")} disabled={busy}>{busy?<span className="sp2"/>:<Ic n="money" s={13}/>}Mulai Proses</button>
                </div>
              )}

              {/* KONFIRMASI PEMBAYARAN TANPA FORM SAP */}
              {isFin&&trx.status==="processing"&&(
                <div style={{marginTop:16,padding:14,background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
                  <p style={{fontSize:13,fontWeight:700,marginBottom:9}}>Konfirmasi Pembayaran</p>
                  <div style={{marginBottom:12,padding:"10px 12px",background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:"var(--r3)"}}>
                    <p style={{fontSize:11,fontWeight:700,color:"#1e3a8a",marginBottom:4}}>💳 Karyawan:</p>
                    <p style={{fontSize:13,fontWeight:700,color:"#1e40af"}}>{trx.submitter}</p>
                  </div>
                  <div className="fg mb3">
                    <label className="fl" style={{fontSize:12}}>Estimasi Tanggal Masuk Rekening <span style={{color:"var(--i3)",fontWeight:400}}>(opsional)</span></label>
                    <input type="date" value={transferDate} onChange={e=>setTransferDate(e.target.value)} style={{marginBottom:0}}/>
                  </div>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan (opsional)..." rows={2} style={{marginBottom:9}}/>
                  <button className="btn bg" onClick={()=>act("pay",note,transferDate)} disabled={busy}>{busy?<span className="sp2"/>:<Ic n="check" s={13}/>}Tandai Sudah Dibayar</button>
                </div>
              )}

              {/* Karyawan Submit OER */}
              {isOwner && trx.type==="cash_advance" && ["paid","awaiting_oer"].includes(trx.status) && !trx.oerAmount && !trx.oerDate && (
                <div style={{marginTop:16,padding:14,background:"#fef9c3",borderRadius:"var(--r2)",border:"2px solid #ca8a04"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <p style={{fontSize:13,fontWeight:800,color:"#78350f"}}>📋 Submit OER untuk CA ini</p>
                    <button className="btn bo sm" onClick={()=>setShowOerForm(v=>!v)} style={{fontSize:11}}>{showOerForm?"Sembunyikan":"Isi OER"}</button>
                  </div>
                  {showOerForm&&(
                    <div style={{marginTop:12}}>
                      <div style={{border:"1px solid #fde68a",borderRadius:"var(--r3)",overflow:"hidden",marginBottom:10}}>
                        <div style={{padding:"7px 12px",background:"#fffbeb",fontSize:10.5,fontWeight:800,color:"#92400e",textTransform:"uppercase",letterSpacing:".06em"}}>Rincian Pengeluaran</div>
                        {oerItems.map((it,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",padding:"7px 12px",borderBottom:i<oerItems.length-1?"1px solid #fef3c7":"none",gap:10}}>
                            <span style={{flex:2,fontSize:12,color:"var(--i2)"}}>{it.cat}</span>
                            <input type="number" value={it.amt} onChange={e=>setOi(i,e.target.value)} placeholder="0" min="0" style={{flex:1,padding:"5px 8px",border:"1px solid #fde68a",borderRadius:6,fontSize:12,textAlign:"right"}}/>
                          </div>
                        ))}
                        {oerTotal>0&&(
                          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 12px",background:"#fef3c7",borderTop:"2px solid #f59e0b"}}>
                            <span style={{fontWeight:800,color:"#78350f"}}>Total OER</span><span style={{fontWeight:800,fontSize:15,color:"#78350f"}}>{rp(oerTotal)}</span>
                          </div>
                        )}
                      </div>
                      <textarea value={oerNote} onChange={e=>setOerNote(e.target.value)} placeholder="Catatan OER (opsional)..." rows={2} style={{marginBottom:9}}/>
                      <button className="btn bp" onClick={submitOer} disabled={busy||oerTotal===0}>{busy?<span className="sp2"/>:<Ic n="send" s={13}/>}Submit OER</button>
                    </div>
                  )}
                </div>
              )}

              {/* Finance: Settle setelah Employee konfirmasi */}
              {isFin && trx.type==="cash_advance" && rc && !trx.settled && trx.status==="employee_confirmed" && (
                <div style={{marginTop:16,padding:14,borderRadius:"var(--r2)",border:"2px solid #93c5fd",background:"#eff6ff"}}>
                  <p style={{fontSize:13,fontWeight:800,marginBottom:4,color:"#1e3a8a"}}>💙 Kurang Bayar — Transfer ke Karyawan</p>
                  <div style={{padding:"10px 12px",background:"#f0fdf4",borderRadius:"var(--r3)",border:"1px solid #6ee7b7",marginBottom:10}}>
                    <p style={{fontSize:11,fontWeight:800,color:"#065f46"}}>✓ Karyawan sudah menyetujui nominal ini</p>
                    <p style={{fontSize:13,fontWeight:700,color:"#1e40af",marginTop:2}}>Transfer {rp(Math.abs(rc.selisih))} ke {trx.submitter}</p>
                  </div>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan / referensi transfer..." rows={2} style={{marginBottom:9}}/>
                  <button className="btn bg" onClick={settle} disabled={busy}><Ic n="check" s={13}/> Konfirmasi Sudah Transfer — Selesaikan</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]       = useState(null);
  const [page,setPage]       = useState("dashboard");
  const [data,setData]       = useState(DEMO.map(d=>withLateFlagOnly(d)));
  const [selId,setSelId]     = useState(null);
  const [toast,setToast]     = useState(null);
  const [sideOpen,setSideOpen]=useState(false);
  const [loading,setLoading] = useState(false);

  const handleLogin = async (u) => {
    setUser(u);
    if (isReady()) {
      setLoading(true);
      const res = await API.getAll();
      if (Array.isArray(res)) setData(res.map(d=>withLateFlagOnly(d)));
      setLoading(false);
    }
  };

  const handleLogout = () => { setUser(null); setPage("dashboard"); setData(DEMO); setSideOpen(false); };
  const handleUpdateUser = (patch) => { setUser(prev => ({...prev, ...patch})); };
  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const reloadData = async () => {
    if (!isReady()) return;
    const rows = await API.getAll();
    if (Array.isArray(rows)) setData(rows.map(d=>withLateFlagOnly(d)));
  };

  useEffect(() => {
    if (!isReady()) return;
    const onVisible = () => { if (document.visibilityState === "visible") reloadData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  useEffect(() => {
    if (!isReady() || !user) return;
    const timer = setInterval(() => reloadData(), 300000);
    return () => clearInterval(timer);
  }, [user]);

  const handleAction = (id, action, noteOrData, trxType, transferDate) => {
    setData(prev=>prev.map(d=>{
      if (d.id!==id) return d;
      if (action==="oer_submitted") {
        const oer = noteOrData;
        return {...d, oerAmount:oer.oerAmount, oerCategories:oer.oerCategories, oerNote:oer.oerNote, oerDate:oer.oerDate, status:"oer_doc_pending"};
      }
      if (action==="oer_doc_received") return {...d, status:"oer_doc_received", adminJktName:noteOrData||d.adminJktName};
      if (action==="oer_doc_complete") {
        const selisih = (d.oerAmount||0) - d.amount;
        const finalStatus = selisih > 0 ? "kurang_bayar" : selisih < 0 ? "lebih_bayar" : "settled";
        return {...d, status:finalStatus, gaOerNote:noteOrData||"", settled:finalStatus==="settled"};
      }
      if (action==="edit_oer") {
        const {oerCategories, oerNote, caAmount} = noteOrData;
        const oerAmount = oerCategories.reduce((s,it)=>s+(it.amt||0),0);
        const selisih   = oerAmount - caAmount;
        const newStatus = selisih > 0 ? "kurang_bayar" : selisih < 0 ? "lebih_bayar" : "settled";
        return {...d, oerAmount, oerCategories, oerNote, status:newStatus};
      }
      if (action==="settle_lebih_bayar" || action==="settle") return {...d, status:"settled", settled:true, settledDate:today(), financeNote:noteOrData||""};
      if (action==="doc_received_lk")  return {...d, status:"doc_received_lk", adminLkName:noteOrData};
      if (action==="doc_sent_jkt")     return {...d, status:"doc_sent_jkt"};
      if (action==="doc_received_jkt") return {...d, status:"doc_received_jkt", adminJktName:noteOrData};
      if (action==="doc_complete")     return {...d, status:"doc_complete", gaNote:typeof noteOrData==="string"?noteOrData:""};
      if (action==="emp_confirm")      return {...d, status:"employee_confirmed"};
      
      const m = {
        approve:  {status:"approved"},
        reject:   {status:"rejected",   financeNote:noteOrData},
        process:  {status:"processing", financeNote:noteOrData},
        pay:      {status: (trxType||d.type)==="cash_advance" ? "awaiting_oer" : "paid", settledDate:today(), financeNote:noteOrData, transferDate:transferDate||d.transferDate||""},
      };
      return {...d, ...m[action]};
    }));
    
    const msgs = {
      approve:"✓ Pengajuan disetujui", reject:"Pengajuan ditolak",
      process:"✓ Mulai diproses", pay:"✓ Pembayaran dikonfirmasi",
      settle:"✓ Settlement dikonfirmasi — CA lunas",
      settle_lebih_bayar:"✓ Lebih bayar diselesaikan — CA lunas",
      oer_submitted:"✓ OER berhasil disubmit", edit_oer:"✓ OER dikoreksi",
      doc_received_lk:"✓ Dokumen diterima Admin Luar Kota",
      doc_sent_jkt:"✓ Dokumen dikirim ke Jakarta",
      doc_received_jkt:"✓ Dokumen diterima Admin Jakarta",
      doc_complete:"✓ Dokumen lengkap — siap diproses Finance",
      oer_doc_received:"✓ Dokumen OER diterima Admin Jakarta",
      oer_doc_complete:"✓ OER disetujui — rekonsiliasi dimulai",
      emp_confirm:"✓ Menyetujui nominal pelunasan",
    };
    showToast(msgs[action]||"Berhasil");
    if (["reject","settle","settle_lebih_bayar","emp_confirm"].includes(action)) setSelId(null);
    if (isReady()) setTimeout(reloadData, 2000);
  };

  const handleEdit = (updated) => { setData(prev => prev.map(d => d.id===updated.id ? updated : d)); showToast("✓ Perubahan disimpan"); };

  const handleSubmit = async (entry) => {
    setData(p=>[entry,...p].map(d=>withLateFlagOnly(d)));
    showToast(`✓ ${entry.id} berhasil dikirim ke Admin`);
    setPage("list");
    if (isReady()) {
      await new Promise(r=>setTimeout(r,500));
      const rows = await API.getAll();
      if (Array.isArray(rows)) setData(rows.map(d=>withLateFlagOnly(d)));
    }
  };
  const nav = (p, id) => { if (id) setSelId(id); setPage(p); setSideOpen(false); };

  const aCt = data.filter(d=>["approved","doc_complete"].includes(d.status)).length;
  const oCt = data.filter(d=>d.isLate===true).length;
  const sel = data.find(d=>d.id===selId);

  const NAV = {
    employee: [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"submit",ic:"plus",lb:"Ajukan Baru"},{id:"list",ic:"list",lb:"Pengajuan Saya"}],
    admin_lk: [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"admin_lk_queue",ic:"check",lb:"Antrian Dokumen",bd:data.filter(d=>d.status==="pending").length||null},{id:"list",ic:"list",lb:"Semua Pengajuan"}],
    admin_jkt:[{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"admin_jkt_queue",ic:"check",lb:"Antrian Jakarta",bd:data.filter(d=>["doc_sent_jkt","oer_doc_pending"].includes(d.status)).length||null},{id:"list",ic:"list",lb:"Semua Pengajuan"}],
    ga:       [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"ga_queue",ic:"check",lb:"Antrian GA",bd:data.filter(d=>["doc_received_jkt","oer_doc_received"].includes(d.status)).length||null},{id:"list",ic:"list",lb:"Semua Pengajuan"}],
    finance:  [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"monitor",ic:"chart",lb:"Monitor Finance",bd:aCt||null},{id:"list",ic:"list",lb:"Semua Pengajuan"},{id:"overdue",ic:"alert",lb:"CA Outstanding",bd:oCt||null},{id:"settings",ic:"settings",lb:"Pengaturan"}],
  };
  const TITLES = {dashboard:"Dashboard",submit:"Form Pengajuan",list:"Daftar Pengajuan",approval:"Antrian Approval",admin_lk_queue:"Antrian Admin LK",admin_jkt_queue:"Antrian Admin Jakarta",ga_queue:"Antrian GA",monitor:"Monitor Finance",overdue:"CA Outstanding",settings:"Pengaturan"};

  if (!user) return (<><style>{CSS}</style><LoginScreen onLogin={handleLogin}/></>);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {sideOpen && <div style={{position:"fixed",inset:0,zIndex:199,background:"rgba(0,0,0,.4)"}} onClick={()=>setSideOpen(false)}/>}

        <div className={`sb${sideOpen?" open":""}`}>
          <div className="sb-logo"><div className="sb-lh">ReimburseApp</div><div className="sb-ls">Finance System 2026</div></div>
          <div className="sb-u" onClick={handleLogout} title="Klik untuk logout">
            <div className="av">{user.avatar}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="sb-un">{user.name}</div>
              <div className="sb-ur">{user.dept}</div>
              <div className="sb-lo"><Ic n="logout" s={10} c="rgba(255,255,255,.25)"/>Tap untuk logout</div>
            </div>
          </div>
          <nav className="sb-nav">
            <div className="nv-s">Menu</div>
            {(NAV[user.role]||[]).map(item=>(
              <div key={item.id} className={`nv${page===item.id?" on":""}`} onClick={()=>nav(item.id)}>
                <Ic n={item.ic} s={14}/><span style={{flex:1}}>{item.lb}</span>
                {item.bd>0 && <span className="nb">{item.bd}</span>}
              </div>
            ))}
          </nav>
        </div>

        <div className="main">
          <div className="bar">
            <button className="btn bo sm" onClick={()=>setSideOpen(o=>!o)}><Ic n="menu" s={15}/></button>
            <h1 className="bt">{TITLES[page]||"Dashboard"}</h1>
            <div className="br">
              <span className={`cs ${isReady()?"cs-ok":"cs-no"}`}><span style={{width:6,height:6,borderRadius:"50%",background:isReady()?"var(--gn)":"var(--am)",display:"inline-block"}}/>{isReady()?"Supabase ✓":"Tidak terhubung"}</span>
              {user.role==="employee"&&page!=="submit"&&<button className="btn bp sm" onClick={()=>nav("submit")}><Ic n="plus" s={13}/>Ajukan</button>}
              {isReady()&&<button className="btn bo sm" title="Refresh data" onClick={reloadData}><Ic n="refresh" s={13}/></button>}
            </div>
          </div>

          <div className="page">
            {loading ? (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:280,gap:12,color:"var(--i3)"}}><div style={{width:22,height:22,border:"3px solid var(--ln)",borderTopColor:"var(--tl)",borderRadius:"50%",animation:"spin .6s linear infinite"}}/><span>Memuat data...</span></div>
            ) : (
              <>
                {page==="dashboard" && <Dashboard data={data} user={user} nav={nav} onUpdateUser={handleUpdateUser}/>}
                {page==="submit"    && <SubmitPage user={user} onSubmit={handleSubmit} data={data}/>}
                {page==="list"      && <ListPage data={data} user={user} onSel={id=>setSelId(id)}/>}
                {page==="admin_lk_queue"  && <AdminLKQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
                {page==="admin_jkt_queue" && <AdminJKTQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
                {page==="ga_queue"        && <GAQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
                {page==="monitor"   && <MonitorPage data={data} onSel={id=>setSelId(id)} onAction={handleAction}/>}
                {page==="settings"  && <SettingsPage onSave={()=>showToast("✓ Pengaturan disimpan")}/>}
                {page==="overdue"   && (
                  <div>
                    <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><strong>CA Outstanding — SLA: maks 5 hari kerja setelah trip selesai.</strong></div>
                    <div className="card">
                      <div className="ch">
                        <h3>CA Belum Selesai</h3>
                        <button className="btn bo sm" onClick={()=>{
                          const rows = data.filter(d=>d.type==="cash_advance"&&!d.settled&&!["rejected"].includes(d.status));
                          if (!rows.length) { alert("Tidak ada data CA outstanding"); return; }
                          const headers = ["ID","Pemohon","Departemen","Keperluan","Trip Selesai","Keterlambatan (hr kerja)","Jumlah","Status"];
                          const csvRows = rows.map(d=>{
                            const late = Math.max(0, workdaysSinceEnd(d.dateEnd) - 5);
                            return [d.id, d.submitter, d.dept, d.purpose, d.dateEnd, late > 0 ? `+${late}` : "Dalam batas", d.amount, STATUS[d.status]?.label||d.status];
                          });
                          const csv = [headers,...csvRows].map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
                          const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a"); a.href=url; a.download=`ca_outstanding_${today()}.csv`; a.click();
                          URL.revokeObjectURL(url);
                        }}><Ic n="list" s={12}/>Export Excel</button>
                      </div>
                      <div className="tw"><table>
                        <thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Trip Selesai</th><th>Keterlambatan</th><th>Jumlah</th><th>Status</th></tr></thead>
                        <tbody>{data.filter(d=>d.type==="cash_advance"&&!d.settled&&!["rejected"].includes(d.status)).map(d=>{
                          const late=Math.max(0,ddiff(d.dateEnd,today())-5);
                          return (
                            <tr key={d.id} onClick={()=>setSelId(d.id)}>
                              <td><span className="mono">{d.id}</span></td>
                              <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--i3)"}}>{d.dept}</div></td>
                              <td><div className="trunc" style={{maxWidth:140}}>{d.purpose}</div></td>
                              <td style={{fontSize:12}}>{fd(d.dateEnd)}</td>
                              <td>{late>0?<span style={{fontWeight:800,color:"var(--rd)",fontSize:12}}>+{late} hari</span>:<span style={{color:"var(--am)",fontWeight:700,fontSize:12}}>Dalam batas</span>}</td>
                              <td className="bold">{rp(d.amount)}</td>
                              <td><SBadge s={d.status}/><LateBadge d={d}/></td>
                            </tr>
                          );
                        })}</tbody>
                      </table>{!data.some(d=>d.type==="cash_advance"&&!d.settled&&!["rejected"].includes(d.status))&&<div className="empty"><Ic n="check" s={36}/><p style={{marginTop:10}}>Semua CA sudah settlement 🎉</p></div>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {sel && <DetailModal trx={sel} user={user} onClose={()=>setSelId(null)} onAction={handleAction} onEdit={handleEdit}/>}
      {toast && <div className="toast" style={{background:toast.type==="err"?"var(--rd)":"var(--ink)"}}><Ic n={toast.type==="err"?"x":"check"} s={13}/>{toast.msg}</div>}
    </>
  );
}
