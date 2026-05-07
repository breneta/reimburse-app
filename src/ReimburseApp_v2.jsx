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
// CONSTANTS & UTILS
// ═══════════════════════════════════════════════════════════════
const DEPTS = ["Sales","Commercial","HRD","Marketing","GA","IT","Finance","Lainnya"];
const AREAS = ["Jakarta","Surabaya","Semarang","Medan","Yogyakarta","Denpasar","Bandung","Palembang"];
const CATS  = ["Perjalanan Dinas","Akomodasi / Hotel","Makan","Entertainment","Transportasi","Uang Saku","Komunikasi","Lain-lain"];
const OER_CATS = ["Plane Fare","Akomodasi / Hotel","Car Rental / Bensin / Tol","Taxi / Bus / Kereta","Telepon / Komunikasi","Makan (dengan tamu)","Meal Allowance","Uang Saku","Airport Tax","Lain-lain"];

const DEMO = [];

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

const gid = () => {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth()+1).padStart(2,"0");
  const dd  = String(now.getDate()).padStart(2,"0");
  const rnd = Math.random().toString(36).slice(2,5).toUpperCase();
  return `TRX-${yy}${mm}${dd}-${rnd}`;
};

const rp = n => "Rp " + new Intl.NumberFormat("id-ID").format(n||0);
const fd = d => d ? new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "–";
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
  let days = 0, cur = new Date(end); cur.setDate(cur.getDate()+1);
  while (cur <= now) { 
    if (cur.getDay()!==0 && cur.getDay()!==6) days++; 
    cur.setDate(cur.getDate()+1); 
  }
  return days;
};

const isOverdue = (d) => {
  if (!d.dateEnd) return false;
  // Terlambat = status masih "pending" lebih dari 5 hari kerja sejak trip selesai
  // (artinya karyawan belum menyerahkan dokumen ke Admin LK/JKT)
  // Kalau sudah doc_received_* ke atas → dokumen sudah diserahkan, tidak terlambat
  if (d.status !== "pending") return false;
  if (d.settled || d.status === "rejected") return false;
  return workdaysSinceEnd(d.dateEnd) > 5;
};

const withLateFlagOnly = (d) => ({ ...d, isLate: isOverdue(d) });

// Nomor WhatsApp Finance — ganti sesuai nomor aktif (format internasional tanpa +)
const FINANCE_WA = "6281234567890";
const FINANCE_WA_NAME = "Finance PT. Roman Ceramics";

// ── API ──────────────────────────────────────────────────────
const SB = {
  async req(method, path, body=null, params=null) {
    if (!isReady()) return null;
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
        "Prefer": "return=representation" 
      };
      const f = { method, headers }; 
      if (body && method !== "GET") f.body = JSON.stringify(body);
      const r = await fetch(url, f); 
      const txt = await r.text();
      return (r.status >= 200 && r.status < 300) ? (txt ? JSON.parse(txt) : {ok:true}) : null;
    } catch(e) { return null; }
  },
  async getAll() {
    const rows = await SB.req("GET","transactions",null,{select:"*",order:"submitted.desc"});
    return rows ? rows.map(r=>({
      id:r.id, type:r.type, submitter:r.submitter, submitterUsername:r.submitter_username||"", dept:r.dept, transferDate:r.transfer_date||"",
      purpose:r.purpose, destination:r.destination, dateStart:r.date_start, dateEnd:r.date_end, amount:r.amount, status:r.status, submitted:r.submitted, categories:r.categories||[], notes:r.notes||"",
      settled:r.settled||false, settledDate:r.settled_date||null, approverName:r.approver_name||"", financeNote:r.finance_note||"", oerAmount:r.oer_amount||0, oerCategories:r.oer_categories||[], oerNote:r.oer_note||"", oerDate:r.oer_date||"",
      caRef:r.ca_ref||"", docRoute:r.doc_route||"admin_jkt", adminLkName:r.admin_lk_name||"", adminJktName:r.admin_jkt_name||"", gaNote:r.ga_note||"", gaOerNote:r.ga_oer_note||"", area:r.area||"Jakarta",
    })) : null;
  },
  async create(d) {
    return SB.req("POST","transactions",{
      id:d.id, type:d.type, submitter:d.submitter, submitter_username:d.submitterUsername||"", dept:d.dept, area:d.area||"Jakarta", purpose:d.purpose, destination:d.destination, date_start:d.dateStart, date_end:d.dateEnd,
      amount:d.amount, status:"pending", submitted:d.submitted, categories:d.categories||[], notes:d.notes||"", approver_name:d.approverName||"", doc_route:d.docRoute||"admin_jkt"
    });
  },
  async update(id, patch) { return SB.req("PATCH","transactions",patch,{"id":"eq."+id}); },
  async loginAcc(u, p) {
    const rows = await SB.req("GET","accounts",null,{"username":"eq."+u.toLowerCase(),"password":"eq."+p,"select":"username,name,dept,area"});
    return (rows && rows.length>0) ? { ok:true, ...rows[0] } : { ok:false };
  }
};

const API = {
  getAll: () => SB.getAll(),
  create: (d) => SB.create(d),
  updateStatus: (id, patch) => SB.update(id, patch),
  loginAcc: (u,p) => SB.loginAcc(u,p),
  registerAcc: async (acc) => {
    const ex = await SB.req("GET","accounts",null,{"username":"eq."+acc.username.toLowerCase(),"select":"username"});
    if (ex && ex.length>0) return { ok:false, error:"Username sudah dipakai" };
    const res = await SB.req("POST","accounts",{ username:acc.username.toLowerCase(), password:acc.password, name:acc.name, dept:acc.dept, area:acc.area||"Jakarta", created_at:new Date().toISOString() });
    return res ? { ok:true } : { ok:false };
  },
  docReceivedLK:  (id, n) => SB.update(id, { status: "doc_received_lk", admin_lk_name: n }),
  docSentJkt:     (id)    => SB.update(id, { status: "doc_sent_jkt" }),
  docReceivedJkt: (id, n) => SB.update(id, { status: "doc_received_jkt", admin_jkt_name: n }),
  oerDocReceived: (id, n) => SB.update(id, { status: "oer_doc_received", admin_jkt_name: n }),
  docComplete: (id, amt, note) => {
    const p = { status: "doc_complete", ga_note: note||"" }; 
    if (amt) p.oer_amount = amt; 
    return SB.update(id, p);
  },
  oerDocComplete: (id, note, ca, oer) => {
    const sel = (oer||0) - ca; 
    const s = sel > 0 ? "kurang_bayar" : sel < 0 ? "lebih_bayar" : "settled";
    return SB.update(id, { status: s, ga_oer_note: note||"", settled: s==="settled" });
  },
  submitOer: (id, d) => SB.update(id, { oer_amount:d.oerAmount, oer_categories:d.oerCategories, oer_note:d.oerNote||"", oer_date:d.oerDate||today(), status:"oer_doc_pending" }),
  updateOer: (id, cats, note, ca) => {
    const amt = cats.reduce((s,it)=>s+(it.amt||0),0); 
    const sel = amt - ca; 
    const s = sel > 0 ? "kurang_bayar" : sel < 0 ? "lebih_bayar" : "settled";
    return SB.update(id, { oer_amount: amt, oer_categories: cats, oer_note: note||"", status: s });
  },
  editData: (id, updated) => SB.update(id, {
    type: updated.type, purpose: updated.purpose, destination: updated.destination,
    date_start: updated.dateStart, date_end: updated.dateEnd,
    approver_name: updated.approverName, notes: updated.notes||"",
    amount: updated.amount, categories: updated.categories,
  }),
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
.lw{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0c1824 0%,#0f2535 50%,#133040 100%);padding:20px;position:relative;overflow:hidden}
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
.app{display:flex;min-height:100vh}
.sb{width:252px;background:var(--ink);display:flex;flex-direction:column;position:fixed;height:100vh;z-index:200;transition:.25s}
.main{flex:1;margin-left:252px;min-height:100vh;display:flex;flex-direction:column}
.bar{height:56px;background:var(--w);border-bottom:1px solid var(--ln);display:flex;align-items:center;padding:0 24px;gap:10px;position:sticky;top:0;z-index:100}
.page{padding:24px;flex:1}
.sb-logo{padding:20px 18px 15px;border-bottom:1px solid rgba(255,255,255,.07)}
.sb-lh{font-family:'Playfair Display',serif;font-size:20px;color:#fff;font-style:italic}
.sb-u{padding:12px 14px;display:flex;align-items:center;gap:9px;border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer;transition:.15s}
.sb-u:hover{background:rgba(255,255,255,.05)}
.av{width:35px;height:35px;border-radius:50%;background:linear-gradient(135deg,var(--tl),var(--tl2));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0}
.sb-un{font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-ur{font-size:11px;color:var(--i4);margin-top:1px;text-transform:capitalize;}
.sb-nav{flex:1;padding:8px;overflow-y:auto}
.nv{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;color:rgba(255,255,255,.45);font-size:13px;font-weight:500;margin-bottom:1px;transition:.12s;user-select:none}
.nv:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8)}
.nv.on{background:var(--tl);color:#fff;font-weight:600}
.nv .nb{margin-left:auto;background:var(--rd);color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:10px}
.bt{font-size:15px;font-weight:800;flex:1}
.br{display:flex;align-items:center;gap:8px}
.cs{display:flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700}
.cs-ok{background:var(--gnb);color:var(--gn);border:1px solid var(--gnbd)}
.cs-no{background:var(--amb);color:var(--am);border:1px solid var(--ambd)}
.card{background:var(--w);border-radius:var(--r);border:1px solid var(--ln);box-shadow:var(--s1)}
.ch{padding:14px 20px;border-bottom:1px solid var(--ln);display:flex;align-items:center;justify-content:space-between;gap:12px}
.ch h3{font-size:14px;font-weight:800}
.cb{padding:18px 20px}
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:11px;margin-bottom:20px}
.st{background:var(--w);border:1px solid var(--ln);border-radius:var(--r);padding:15px 17px;position:relative;box-shadow:var(--s1)}
.st::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%}
.st.tl::before{background:var(--tl)}.st.am::before{background:var(--am)}.st.rd::before{background:var(--rd)}.st.gn::before{background:var(--gn)}
.sl{font-size:10px;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}
.sv{font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1}
.sv.md{font-size:17px}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{padding:8px 13px;text-align:left;font-size:10.5px;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;border-bottom:2px solid var(--ln);background:var(--ln2);white-space:nowrap}
td{padding:11px 13px;font-size:13px;color:var(--i2);border-bottom:1px solid var(--ln);vertical-align:middle}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#fafbfd;}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r2);border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;transition:.12s;line-height:1;white-space:nowrap}
.btn:disabled{opacity:.4;cursor:not-allowed}
.bp{background:var(--tl);color:#fff;box-shadow:0 2px 6px rgba(13,148,136,.25)}.bp:hover:not(:disabled){background:#0f766e}
.bg{background:var(--gn);color:#fff}.bg:hover:not(:disabled){background:#047857}
.bo{background:transparent;color:var(--i2);border:1.5px solid var(--ln)}.bo:hover:not(:disabled){background:var(--ln2)}
.sm{padding:5px 11px;font-size:12px;border-radius:8px}.xs{padding:3px 9px;font-size:11.5px;border-radius:6px}
.fg{display:grid;gap:12px}.fg2{grid-template-columns:1fr 1fr}.fg3{grid-template-columns:1fr 1fr 1fr}
label.fl{display:block;font-size:11.5px;font-weight:700;color:var(--i2);margin-bottom:4px}
input,select,textarea{width:100%;padding:8px 11px;border:1.5px solid var(--ln);border-radius:var(--r3);font-family:inherit;font-size:13px;color:var(--ink);background:var(--w);outline:none;transition:.12s}
input:focus,select:focus,textarea:focus{border-color:var(--tl);box-shadow:0 0 0 3px rgba(13,148,136,.1)}
textarea{resize:vertical;min-height:70px;line-height:1.5}
.fs{background:var(--ln2);border-radius:var(--r2);padding:13px;border:1px solid var(--ln)}
.fst{font-size:10.5px;font-weight:800;color:var(--tl);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700}
.badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0}
.tag{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700}
.tca{background:#dbeafe;color:#1e40af}.tre{background:#f3e8ff;color:#6b21a8}
.ov{position:fixed;inset:0;background:rgba(12,24,36,.65);backdrop-filter:blur(6px);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;animation:fi .15s}
.mo{background:var(--w);border-radius:var(--r);box-shadow:var(--s3);width:100%;max-width:640px;max-height:90vh;overflow-y:auto;animation:su .18s}
.mh{padding:16px 20px;border-bottom:1px solid var(--ln);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:sticky;top:0;background:var(--w);z-index:1}
.mb2{padding:20px}
.tlr{display:flex;gap:10px;margin-bottom:12px}
.tldc{display:flex;flex-direction:column;align-items:center}
.tld{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tlln{width:2px;flex:1;margin-top:3px;background:var(--ln)}
.tlb{flex:1;padding-top:2px}
.tlt{font-size:12.5px;font-weight:700}
.tls{font-size:11px;color:var(--i3);margin-top:2px}
.al{padding:10px 13px;border-radius:var(--r2);font-size:12.5px;display:flex;align-items:flex-start;gap:8px;line-height:1.5}
.aw{background:var(--amb);border:1px solid var(--ambd);color:#78350f}
.ae{background:var(--rdb);border:1px solid var(--rdbd);color:#7f1d1d}
.ag{background:var(--gnb);border:1px solid var(--gnbd);color:#064e3b}
.ab{background:var(--blb);border:1px solid var(--blbd);color:#1e3a8a}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.mb3{margin-bottom:12px}.mb4{margin-bottom:16px}.mb5{margin-bottom:20px}
.mt2{margin-top:8px}.mt3{margin-top:12px}.mt4{margin-top:16px}
.bold{font-weight:700}.mono{font-family:ui-monospace,monospace;font-size:12px;font-weight:700;color:var(--tl)}
.trunc{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.empty{text-align:center;padding:44px 20px;color:var(--i4)}
.sp2{display:inline-block;width:14px;height:14px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle}
.toast{position:fixed;bottom:22px;right:22px;z-index:999;padding:11px 18px;border-radius:var(--r2);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;box-shadow:var(--s3);animation:su .2s}
.flt{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.flt input,.flt select{flex:1;min-width:130px;width:auto}
.hero{background:linear-gradient(130deg,#0c1824 0%,#133040 60%,#164050 100%);border-radius:16px;padding:24px 28px;color:#fff;position:relative;overflow:hidden;margin-bottom:20px}
.hr1{position:absolute;right:-30px;top:-30px;width:180px;height:180px;border-radius:50%;background:rgba(13,148,136,.12);pointer-events:none}
.hr2{position:absolute;right:70px;bottom:-50px;width:130px;height:130px;border-radius:50%;background:rgba(20,184,166,.08);pointer-events:none}
@media(max-width:800px){.sb{transform:translateX(-100%)}.sb.open{transform:none}.main{margin-left:0}.fg2,.fg3,.g2{grid-template-columns:1fr}.sg{grid-template-columns:1fr 1fr}.page{padding:14px}.bar{padding:0 14px}}
@media(max-width:480px){.sg{grid-template-columns:1fr}}
`;

// ── Icons & Shared UI ────────────────────────────────────────
const IP = {
  home:"M3 12L12 3l9 9M9 21V12h6v9M3 12v9h18v-9", plus:"M12 5v14M5 12h14", list:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  check:"M20 6 9 17 4 12", x:"M18 6 6 18M6 6l12 12", clock:"M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  alert:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  money:"M1 4h22v16H1zM1 10h22", user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8",
  chart:"M18 20V10M12 20V4M6 20v-6M2 20h20", send:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7", trash:"M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  logout:"M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9", menu:"M3 12h18M3 6h18M3 18h18", refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  settings:"M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
};
const Ic = ({ n, s=16, c="currentColor" }) => (<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={IP[n]||""}/></svg>);

const SBadge = ({ s, trx, isOwner }) => {
  let ds = s;
  if (trx && trx.transferDate && (s==="paid"||s==="awaiting_oer")) {
    // Bandingkan tanggal saja (string YYYY-MM-DD) agar bebas timezone
    const todayStr = today();
    if (trx.transferDate >= todayStr) ds = "paid_queued";
  }
  const c=STATUS[ds]||{label:ds,color:"#475569",bg:"#f1f5f9"}; 
  return <span className="badge" style={{color:c.color,background:c.bg}}>{c.label}</span>;
};

const LateBadge = ({ d }) => d.isLate ? <span className="badge" style={{color:"#9f1239",background:"#fff1f2",marginLeft:4}}>⚠ Terlambat</span> : null;
const TTag = ({ t }) => <span className={`tag ${t==="cash_advance"?"tca":"tre"}`}>{t==="cash_advance"?"CA":"Reimburse"}</span>;

const PwInput = ({ value, onChange, placeholder, showState, toggleShow, onEnter }) => (
  <div style={{position:"relative"}}>
    <input type={showState?"text":"password"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} onKeyDown={e=>e.key==="Enter"&&onEnter&&onEnter()} style={{paddingRight:42}}/>
    <button onClick={e=>{e.preventDefault();toggleShow();}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--i3)"}}>{showState?"🙈":"👁️"}</button>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [tab,setTab] = useState("karyawan"); 
  const [mode,setMode] = useState("login");
  const [err,setErr] = useState(""); 
  const [show,setShow] = useState(false); 
  const [show2,setShow2] = useState(false);
  const [username,setUsername] = useState(""); 
  const [pass,setPass] = useState("");
  const [regName,setRegName] = useState(""); 
  const [regDept,setRegDept] = useState(""); 
  const [regArea,setRegArea] = useState(""); 
  const [regUser,setRegUser] = useState(""); 
  const [regPass,setRegPass] = useState(""); 
  const [regPass2,setRegPass2] = useState("");
  const [role,setRole] = useState("admin_lk"); 
  const [staffPass,setStaffPass]=useState("");
  
  const clr = () => setErr(""); 
  const [busy2,setBusy2] = useState(false);

  const doRegister = async () => {
    if (!regName.trim()||!regDept||!regArea||!regUser.trim()||regPass.length<4||regPass!==regPass2) return setErr("Lengkapi data dengan benar");
    const ukey = regUser.toLowerCase().trim(); 
    const av = regName.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    setBusy2(true); 
    const res = isReady() ? await API.registerAcc({username:ukey, name:regName.trim(), dept:regDept, area:regArea, password:regPass}) : {ok:true};
    setBusy2(false); 
    if (res && res.ok) onLogin({ name:regName.trim(), dept:regDept, area:regArea, role:"employee", avatar:av, username:ukey }); 
    else setErr(res?.error||"Gagal daftar");
  };

  const doLogin = async () => {
    if (!username.trim()||!pass) return setErr("Isi username & password");
    setBusy2(true); 
    const res = isReady() ? await API.loginAcc(username.trim(), pass) : {ok:false};
    setBusy2(false); 
    if (res && res.ok) onLogin({ ...res, role:"employee", avatar:res.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) }); 
    else setErr("Gagal login");
  };

  const doStaff = () => {
    const pm = { finance: CONFIG.PASS_FINANCE, admin_lk: CONFIG.PASS_ADMIN_LK, admin_jkt:CONFIG.PASS_ADMIN_JKT, ga: CONFIG.PASS_GA };
    if (staffPass !== pm[role]) return setErr("Password salah!");
    const im = { finance:{name:"Finance",dept:"Finance",avatar:"FN"}, admin_lk:{name:"Admin LK",dept:"Admin",avatar:"AL"}, admin_jkt:{name:"Admin Jakarta",dept:"Admin",avatar:"AJ"}, ga:{name:"GA",dept:"GA",avatar:"GA"}};
    onLogin({ ...im[role], role });
  };

  return (
    <div className="lw">
      <div className="lr1"/><div className="lr2"/>
      <div className="lc">
        <div style={{textAlign:"center",marginBottom:24}}>
          <div className="l-ico">💼</div><h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontStyle:"italic"}}>ReimburseApp</h1>
          <p style={{fontSize:12,color:"var(--i3)",marginTop:3}}>Sistem Reimburse & Cash Advance</p>
        </div>
        <div className="l-tabs">
          {[["karyawan","👤 Karyawan"],["staff","🔐 Admin / GA"]].map(([v,l])=>(
            <button key={v} className={`l-tab${tab===v?" on":""}`} onClick={()=>{setTab(v);setErr("");setMode("login");}}>{l}</button>
          ))}
        </div>
        {err && <div className="l-err"><Ic n="x" s={13} c="#dc2626"/>{err}</div>}
        {tab==="karyawan" && mode==="login" && (
          <>
            <div className="l-fld"><label>Username</label><input value={username} onChange={e=>{setUsername(e.target.value);clr();}} placeholder="Username" autoFocus/></div>
            <div className="l-fld"><label>Password</label><PwInput value={pass} onChange={v=>{setPass(v);clr();}} placeholder="Password" showState={show} toggleShow={()=>setShow(s=>!s)} onEnter={doLogin}/></div>
            <button className="l-btn" onClick={doLogin} disabled={busy2}>{busy2?<span className="sp2"/>:"Masuk →"}</button>
            <div style={{textAlign:"center",marginTop:14}}>
              <span style={{fontSize:12.5,color:"var(--i3)"}}>Belum punya akun? </span>
              <button onClick={()=>{setMode("register");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,color:"var(--tl)"}}>Daftar</button>
            </div>
          </>
        )}
        {tab==="karyawan" && mode==="register" && (
          <>
            <div style={{background:"var(--tlb)",border:"1px solid var(--tlbd)",borderRadius:"var(--r3)",padding:"9px 12px",marginBottom:14,fontSize:12,color:"#134e4a"}}>✨ Daftar sekali, langsung bisa login kapan saja.</div>
            <div className="l-fld"><label>Nama Lengkap *</label><input value={regName} onChange={e=>{setRegName(e.target.value);clr();}} placeholder="Nama lengkap"/></div>
            <div className="l-fld"><label>Departemen *</label><select value={regDept} onChange={e=>setRegDept(e.target.value)}><option value="">-- Pilih --</option>{DEPTS.map(d=><option key={d}>{d}</option>)}</select></div>
            <div className="l-fld"><label>Area *</label><select value={regArea} onChange={e=>setRegArea(e.target.value)}><option value="">-- Pilih --</option>{AREAS.map(a=><option key={a}>{a}</option>)}</select></div>
            <div className="l-fld"><label>Username *</label><input value={regUser} onChange={e=>{setRegUser(e.target.value);clr();}} placeholder="Username"/></div>
            <div className="l-fld"><label>Password *</label><PwInput value={regPass} onChange={v=>{setRegPass(v);clr();}} placeholder="Min. 4 karakter" showState={show} toggleShow={()=>setShow(s=>!s)}/></div>
            <div className="l-fld"><label>Konfirmasi Password *</label><PwInput value={regPass2} onChange={v=>{setRegPass2(v);clr();}} placeholder="Ulangi" showState={show2} toggleShow={()=>setShow2(s=>!s)} onEnter={doRegister}/></div>
            <button className="l-btn" onClick={doRegister} disabled={busy2}>{busy2?<span className="sp2"/>:"Daftar →"}</button>
            <div style={{textAlign:"center",marginTop:14}}>
              <span style={{fontSize:12.5,color:"var(--i3)"}}>Punya akun? </span>
              <button onClick={()=>{setMode("login");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,color:"var(--tl)"}}>Login</button>
            </div>
          </>
        )}
        {tab==="staff" && (
          <>
            <div className="l-fld"><label>Login sebagai</label><select value={role} onChange={e=>setRole(e.target.value)}><option value="admin_lk">📦 Admin LK</option><option value="admin_jkt">🏢 Admin JKT</option><option value="ga">🗂 GA</option><option value="finance">💼 Finance</option></select></div>
            <div className="l-fld"><label>Password *</label><PwInput value={staffPass} onChange={v=>{setStaffPass(v);clr();}} placeholder="Password" showState={show} toggleShow={()=>setShow(s=>!s)} onEnter={doStaff}/></div>
            <button className="l-btn" onClick={doStaff}>Masuk →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Dashboard({ data, user, nav }) {
  const isMyTrx = (d) => d.submitterUsername===user.username || d.submitter===user.name;
  const mine = user.role==="employee" ? data.filter(isMyTrx) : data;
  const overdue = mine.filter(d=>d.isLate===true);
  const kurangBayar = user.role==="employee" ? mine.filter(d=>d.type==="cash_advance" && d.status==="awaiting_confirm") : [];
  const lebihBayar = user.role==="employee" ? mine.filter(d=>d.type==="cash_advance" && d.status==="lebih_bayar" && !d.settled) : [];

  return (
    <div>
      <div className="hero">
        <div className="hr1"/><div className="hr2"/>
        <div style={{position:"relative"}}>
          <p style={{fontSize:10,fontWeight:800,textTransform:"uppercase",color:"var(--tl2)"}}>Selamat datang</p>
          <h2 style={{fontSize:20,fontWeight:800}}>{user.name}</h2>
          <p style={{fontSize:12.5,color:"rgba(255,255,255,.5)"}}>{user.dept} · {user.area} · {user.role}</p>
        </div>
      </div>
      {overdue.length>0 && <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><span><strong>{overdue.length} Pengajuan Terlambat</strong> — lewati batas 5 hari kerja!</span></div>}
      
      {kurangBayar.map(d=>(
        <div key={d.id} className="al ab mb3" style={{background:"linear-gradient(135deg,#1e40af,#3b82f6)",color:"white"}}>
          <div style={{flex:1}}>
            <p style={{fontWeight:800}}>Konfirmasi Nominal — {d.id}</p>
            <p style={{fontSize:12}}>Finance akan transfer <strong style={{color:"#fde68a"}}>{rp(Math.abs((d.oerAmount||0)-d.amount))}</strong> kepadamu.</p>
          </div>
          <button className="btn sm" onClick={()=>nav("list")} style={{background:"white",color:"#1e40af"}}>Lihat →</button>
        </div>
      ))}

      {lebihBayar.map(d=>(
        <div key={d.id} className="al aw mb3" style={{background:"linear-gradient(135deg,#7c3aed,#8b5cf6)",color:"white"}}>
          <div style={{flex:1}}>
            <p style={{fontWeight:800}}>Pengembalian Sisa — {d.id}</p>
            <p style={{fontSize:12}}>Kamu harus transfer sisa <strong style={{color:"#fde68a"}}>{rp(Math.abs((d.oerAmount||0)-d.amount))}</strong> ke perusahaan dan kirim bukti via WA.</p>
          </div>
          <button className="btn sm" onClick={()=>nav("list")} style={{background:"white",color:"#7c3aed"}}>Lihat →</button>
        </div>
      ))}

      <div className="sg">
        <div className="st tl">
          <div className="sl">Total Diajukan</div>
          <div className="sv md">{rp(mine.reduce((a,d)=>a+d.amount,0))}</div>
        </div>
        <div className="st gn">
          <div className="sl">Sudah Lunas</div>
          <div className="sv md">{rp(mine.filter(d=>d.status==="paid"||d.status==="settled").reduce((a,d)=>a+d.amount,0))}</div>
        </div>
      </div>

      <div className="card mt4">
        <div className="ch"><h3>Pengajuan Terbaru</h3><button className="btn bo sm" onClick={()=>nav("list")}>Lihat Semua</button></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Jenis</th><th>Keperluan</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>{mine.slice(0,5).map(d=>(
            <tr key={d.id} onClick={()=>nav("detail",d.id)}>
              <td><span className="mono">{d.id}</span></td>
              <td><TTag t={d.type}/></td>
              <td><div className="trunc" style={{maxWidth:180}}>{d.purpose}</div></td>
              <td className="bold">{rp(d.amount)}</td>
              <td><SBadge s={d.status} trx={d} isOwner={user.role==="employee"}/><LateBadge d={d}/></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}

function SubmitPage({ user, onSubmit, data }) {
  const [f,setF] = useState({type:"reimburse",purpose:"",destination:"Jakarta",dateStart:"",dateEnd:"",approverName:"",notes:"",caRef:"",docRoute:"admin_jkt",items:[{cat:"Perjalanan Dinas",amt:""}]});
  const [busy,setBusy] = useState(false); 
  const set=(k,v)=>setF(p=>({...p,[k]:v})); 
  const si=(i,k,v)=>setF(p=>{const n=[...p.items];n[i]={...n[i],[k]:v};return{...p,items:n};});
  const total = f.items.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);
  const myCAs = data.filter(d=>d.type==="cash_advance" && (d.submitterUsername===user.username||d.submitter===user.name) && ["paid","awaiting_oer"].includes(d.status) && !d.oerAmount);

  const submit = async () => {
    if (!f.purpose||!f.dateStart||!f.dateEnd||!f.approverName||total===0) return alert("Lengkapi data wajib (*)");
    const entry = { id:gid(), ...f, submitter:user.name, submitterUsername:user.username||"", dept:user.dept, area:user.area||"Jakarta", amount:total, submitted:today(), categories:f.items.map(it=>({cat:it.cat,amt:parseFloat(it.amt)||0})) };
    setBusy(true); 
    if (isReady()) await API.create(entry); 
    setBusy(false); 
    onSubmit(entry);
  };

  return (
    <div className="card">
      <div className="ch"><h3>Form Pengajuan</h3></div>
      <div className="cb">
        <div className="fs mb4" style={{border:"2px solid var(--tl)",background:"var(--tlb)"}}>
          <div className="fst">📬 Jalur Dokumen *</div>
          <div style={{display:"flex",gap:9}}>
            {[["admin_jkt","🏢 Jakarta (Langsung)"],["admin_lk","📦 Luar Kota (Kirim)"]].map(([v,l])=>(
              <label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:12,border:`2px solid ${f.docRoute===v?"var(--tl)":"var(--ln)"}`,borderRadius:10,background:"white",cursor:"pointer"}}>
                <input type="radio" checked={f.docRoute===v} onChange={()=>set("docRoute",v)} style={{width:"auto"}}/>
                <div className="bold">{l}</div>
              </label>
            ))}
          </div>
        </div>
        <div className="fs mb4">
          <div className="fst">Jenis *</div>
          <div style={{display:"flex",gap:9}}>
            {[["reimburse","💰 Reimburse"],["cash_advance","🏦 Cash Advance"]].map(([v,l])=>(
              <label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:12,border:`2px solid ${f.type===v?"var(--tl)":"var(--ln)"}`,borderRadius:10,background:"white",cursor:"pointer"}}>
                <input type="radio" checked={f.type===v} onChange={()=>set("type",v)} style={{width:"auto"}}/>
                <div className="bold">{l}</div>
              </label>
            ))}
          </div>
          {f.type==="reimburse" && myCAs.length>0 && (
            <div className="mt3"><label className="fl">🔗 Link ke CA</label>
              <select value={f.caRef} onChange={e=>set("caRef",e.target.value)}>
                <option value="">-- Pilih --</option>
                {myCAs.map(ca=><option key={ca.id} value={ca.id}>{ca.id} · {ca.purpose}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="fs mb4">
          <div className="fst">Detail Perjalanan</div>
          <div className="fg mb3"><label className="fl">Keperluan *</label><textarea value={f.purpose} onChange={e=>set("purpose",e.target.value)} rows={2}/></div>
          <div className="fg fg3">
            <div><label className="fl">Kota Tujuan *</label><input value={f.destination} onChange={e=>set("destination",e.target.value)}/></div>
            <div><label className="fl">Tgl Mulai *</label><input type="date" value={f.dateStart} onChange={e=>set("dateStart",e.target.value)}/></div>
            <div><label className="fl">Tgl Selesai *</label><input type="date" value={f.dateEnd} onChange={e=>set("dateEnd",e.target.value)}/></div>
          </div>
        </div>
        <div className="fs mb4">
          <div className="fst">Biaya</div>
          {f.items.map((it,i)=>(
            <div key={i} style={{display:"flex",gap:9,marginBottom:8}}>
              <select value={it.cat} onChange={e=>si(i,"cat",e.target.value)} style={{flex:2}}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
              <input type="number" value={it.amt} onChange={e=>si(i,"amt",e.target.value)} placeholder="0" style={{flex:1.5}}/>
              {f.items.length>1 && <button className="btn bo xs" onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))}>✕</button>}
            </div>
          ))}
          <button className="btn bo sm" onClick={()=>setF(p=>({...p,items:[...p.items,{cat:"Perjalanan Dinas",amt:""}]}))}>+ Item</button>
          <div className="mt3 bold" style={{fontSize:16,textAlign:"right"}}>{rp(total)}</div>
        </div>
        <div className="fs mb4">
          <div className="fst">Nama Admin Penerima *</div>
          <input value={f.approverName} onChange={e=>set("approverName",e.target.value)} placeholder="Admin Jakarta / LK"/>
        </div>
        <div style={{textAlign:"right"}}><button className="btn bp" onClick={submit} disabled={busy}>{busy?"Memproses...":"Kirim Pengajuan"}</button></div>
      </div>
    </div>
  );
}

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
          {(q||st||tp)&&<button className="btn bo sm" onClick={()=>{setQ("");setSt("");setTp("");}}><Ic n="x" s={12}/>Reset</button>}
        </div>
      </div>
      <div className="card">
        <div className="ch"><h3>Daftar Pengajuan <span style={{fontSize:12,color:"var(--i4)",fontWeight:400}}>({rows.length})</span></h3></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Jenis</th><th>Keperluan</th><th>Kota</th><th>Periode</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>{rows.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
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

function AdminLKQueue({ data, onAction, onSel }) {
  const [adminName, setAdminName] = useState(""); const [q, setQ] = useState("");
  const queue = data.filter(d => d.status === "pending" && d.docRoute === "admin_lk").filter(d => !q || d.submitter.toLowerCase().includes(q.toLowerCase()));
  const received = data.filter(d => d.status === "doc_received_lk").filter(d => !q || d.submitter.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="card mb3"><div className="cb fg fg2"><div><label className="fl">Cari Pemohon</label><input value={q} onChange={e=>setQ(e.target.value)}/></div><div><label className="fl">Admin LK Bertugas *</label><input value={adminName} onChange={e=>setAdminName(e.target.value)} placeholder="Nama Anda"/></div></div></div>
      
      <div className="card mb3">
        <div className="ch"><h3>Menunggu Dokumen</h3></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Nominal</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead>
          <tbody>{queue.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold">{d.submitter}</div></td>
              <td><span className="bold">{rp(d.amount)}</span></td>
              <td><div className="bold" style={{fontSize:12}}>{d.destination}</div><div style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td>
              <td><button className="btn bg xs" onClick={e=>{e.stopPropagation(); if(!adminName)return alert("Isi nama admin"); onAction(d.id,"doc_received_lk",adminName); API.docReceivedLK(d.id,adminName);}}>Terima</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      {received.length>0 && (
        <div className="card">
          <div className="ch"><h3>Siap Kirim ke Jakarta</h3></div>
          <div className="tw"><table>
            <thead><tr><th>ID</th><th>Pemohon</th><th>Nominal</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead>
            <tbody>{received.map(d=>(
              <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
                <td><span className="mono">{d.id}</span></td>
                <td>{d.submitter}</td>
                <td><span className="bold">{rp(d.amount)}</span></td>
                <td><div className="bold" style={{fontSize:12}}>{d.destination}</div><div style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td>
                <td><button className="btn bp xs" onClick={e=>{e.stopPropagation(); onAction(d.id,"doc_sent_jkt"); API.docSentJkt(d.id);}}>✈️ Kirim JKT</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function AdminJKTQueue({ data, onAction, onSel }) {
  const [adminName, setAdminName] = useState(""); const [q, setQ] = useState("");
  const queue = data.filter(d => d.status === "doc_sent_jkt").filter(d => !q || d.submitter.toLowerCase().includes(q.toLowerCase()));
  const oerQueue = data.filter(d => d.status === "oer_doc_pending");
  const direct = data.filter(d => d.status === "pending" && (d.docRoute==="admin_jkt"||!d.docRoute)).filter(d => !q || d.submitter.toLowerCase().includes(q.toLowerCase()));
  
  const doRec = (id) => { if(!adminName) return alert("Isi nama admin"); onAction(id,"doc_received_jkt",adminName); API.docReceivedJkt(id,adminName); };
  
  return (
    <div>
      <div className="card mb3"><div className="cb fg fg2"><div><label className="fl">Cari</label><input value={q} onChange={e=>setQ(e.target.value)}/></div><div><label className="fl">Admin JKT Bertugas *</label><input value={adminName} onChange={e=>setAdminName(e.target.value)}/></div></div></div>
      
      <div className="card mb3">
        <div className="ch"><h3>Dari Luar Kota / Langsung</h3></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Nominal</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead>
          <tbody>{[...queue,...direct].map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold">{d.submitter}</div></td>
              <td><span className="bold">{rp(d.amount)}</span></td>
              <td><div className="bold" style={{fontSize:12}}>{d.destination}</div><div style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td>
              <td><button className="btn bg xs" onClick={e=>{e.stopPropagation(); doRec(d.id);}}>Terima</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      {oerQueue.length>0 && (
        <div className="card">
          <div className="ch"><h3>OER Masuk</h3></div>
          <div className="tw"><table>
            <thead><tr><th>ID</th><th>Pemohon</th><th>Nominal CA</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead>
            <tbody>{oerQueue.map(d=>(
              <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
                <td><span className="mono">{d.id}</span></td>
                <td>{d.submitter}</td>
                <td><span className="bold">{rp(d.amount)}</span></td>
                <td><div className="bold" style={{fontSize:12}}>{d.destination}</div><div style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td>
                <td><button className="btn bg xs" onClick={e=>{e.stopPropagation(); if(!adminName)return alert("Admin?"); onAction(d.id,"oer_doc_received",adminName); API.oerDocReceived(d.id,adminName);}}>Terima OER</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function GAQueue({ data, onAction, onSel }) {
  const [gaNote, setGaNote] = useState("");
  const queue = data.filter(d => d.status === "doc_received_jkt");
  const oerQueue = data.filter(d => d.status === "oer_doc_received");
  
  return (
    <div>
      <div className="card mb3">
        <div className="ch">
          <h3>Antrian GA</h3>
          <input value={gaNote} onChange={e=>setGaNote(e.target.value)} placeholder="Catatan opsional..." style={{width:200,fontSize:12,padding:"6px 10px",marginLeft:"auto"}}/>
        </div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Nominal</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead>
          <tbody>{queue.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold">{d.submitter}</div></td>
              <td><span className="bold">{rp(d.amount)}</span></td>
              <td><div className="bold" style={{fontSize:12}}>{d.destination}</div><div style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td>
              <td><button className="btn bg xs" onClick={e=>{e.stopPropagation(); onAction(d.id,"doc_complete",gaNote); API.docComplete(d.id,null,gaNote); setGaNote("");}}>✓ Lengkap</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      {oerQueue.length>0 && (
        <div className="card">
          <div className="ch"><h3 style={{color:"#7c3aed"}}>OER Dokumen — Perlu Approve</h3></div>
          <div className="tw"><table>
            <thead><tr><th>ID</th><th>Pemohon</th><th>Nominal CA</th><th>Tujuan & Tanggal</th><th>Selisih</th><th>Aksi</th></tr></thead>
            <tbody>{oerQueue.map(d=>{
              const sel = (d.oerAmount||0)-d.amount; 
              return(
                <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
                  <td><span className="mono">{d.id}</span></td>
                  <td>{d.submitter}</td>
                  <td><span className="bold">{rp(d.amount)}</span></td>
                  <td><div className="bold" style={{fontSize:12}}>{d.destination}</div><div style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td>
                  <td className="bold" style={{color:sel<0?"#7c3aed":"#059669"}}>{sel<0?`Lebih ${rp(Math.abs(sel))}`:sel>0?`Kurang ${rp(sel)}`:"Pas"}</td>
                  <td><button className="btn bg xs" style={{background:"#7c3aed"}} onClick={e=>{e.stopPropagation(); onAction(d.id,"oer_doc_complete",gaNote); API.oerDocComplete(d.id,gaNote,d.amount,d.oerAmount); setGaNote("");}}>Approve OER</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function MonitorPage({ data, onSel }) {
  const overdue = data.filter(d=>d.isLate===true);
  const actionable = data.filter(d=>["doc_complete","approved","processing","kurang_bayar","lebih_bayar","employee_confirmed"].includes(d.status) && !d.settled);
  const caOut = data.filter(d=>d.type==="cash_advance" && !d.settled && !["rejected"].includes(d.status));
  
  return (
    <div>
      <div className="sg">
        <div className="st tl"><div className="sl">Total Antrian</div><div className="sv">{actionable.length}</div></div>
        <div className="st rd"><div className="sl">Terlambat</div><div className="sv">{overdue.length}</div></div>
      </div>

      <div className="card mt4">
        <div className="ch"><h3>Perlu Ditindak Finance</h3></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Tujuan & Tanggal</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{actionable.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold">{d.submitter}</div></td>
              <td><div className="trunc" style={{maxWidth:130}}>{d.purpose}</div></td>
              <td><div className="bold" style={{fontSize:12}}>{d.destination}</div><div style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td>
              <td className="bold">{rp(d.amount)}</td>
              <td><SBadge s={d.status}/></td>
              <td><button className="btn bo xs" onClick={()=>onSel(d.id)}>Buka Settle</button></td>
            </tr>
          ))}</tbody>
        </table>{actionable.length===0&&<div className="empty" style={{padding:"20px 0"}}><p>Tidak ada yang perlu ditindak 🎉</p></div>}</div>
      </div>

      <div className="card mt4">
        <div className="ch"><h3>CA Outstanding</h3></div>
        <div style={{maxHeight:300,overflowY:"auto"}}>
          {caOut.map(d=>(
            <div key={d.id} onClick={()=>onSel(d.id)} style={{padding:12,borderBottom:"1px solid var(--ln)",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}>
                <span className="mono">{d.id}</span>
                <div className="bold">{d.submitter}</div>
                <div style={{fontSize:11,color:"var(--i3)",marginTop:2}}><span className="bold" style={{color:"var(--ink)"}}>{d.destination}</span> | {fd(d.dateStart)} – {fd(d.dateEnd)}</div>
                <div className="trunc" style={{maxWidth:250,fontSize:11,color:"var(--i3)",marginTop:2}}>{d.purpose}</div>
              </div>
              <div style={{textAlign:"right"}}><div className="bold">{rp(d.amount)}</div><SBadge s={d.status}/><LateBadge d={d}/></div>
            </div>
          ))}
          {caOut.length===0&&<div className="empty">Semua CA settle 🎉</div>}
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ onSave }) {
  const [sbUrl,setUrl] = useState(CONFIG.SUPABASE_URL); 
  const [sbKey,setKey] = useState(CONFIG.SUPABASE_KEY);
  
  const save = () => { 
    CONFIG.SUPABASE_URL=sbUrl.trim(); 
    CONFIG.SUPABASE_KEY=sbKey.trim(); 
    _saveConfig({ ..._loadConfig(), SUPABASE_URL:sbUrl.trim(), SUPABASE_KEY:sbKey.trim() }); 
    onSave(); 
  };
  
  return (
    <div className="card">
      <div className="ch"><h3>Koneksi Supabase</h3></div>
      <div className="cb">
        <div className="fg mb3"><label className="fl">URL</label><input value={sbUrl} onChange={e=>setUrl(e.target.value)}/></div>
        <div className="fg mb3"><label className="fl">Key</label><input value={sbKey} onChange={e=>setKey(e.target.value)}/></div>
        <button className="btn bp" onClick={save}>Simpan</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORMS & MODALS
// ═══════════════════════════════════════════════════════════════

function EditForm({ trx, onSave, onCancel }) {
  const [f,setF] = useState({
    type:        trx.type, purpose: trx.purpose, destination: trx.destination,
    dateStart:   trx.dateStart, dateEnd: trx.dateEnd, approverName:trx.approverName,
    notes:       trx.notes||"", items: trx.categories.map(c=>({cat:c.cat, amt:String(c.amt)})),
  });
  const set  = (k,v) => setF(p=>({...p,[k]:v}));
  const si   = (i,k,v) => setF(p=>{const n=[...p.items];n[i]={...n[i],[k]:v};return{...p,items:n};});
  const total = f.items.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);

  const save = async () => {
    if (!f.purpose||!f.dateStart||!f.dateEnd||!f.approverName||total===0){alert("Harap lengkapi semua field wajib.");return;}
    const updated = {
      ...trx, type: f.type, purpose: f.purpose, destination: f.destination, dateStart: f.dateStart, dateEnd: f.dateEnd,
      approverName:f.approverName, notes: f.notes, amount: total, categories: f.items.map(it=>({cat:it.cat, amt:parseFloat(it.amt)||0})),
    };
    // 1. Update UI immediately (optimistic)
    onSave(updated);
    // 2. Sync ke Supabase di background — tidak await agar UI tidak freeze
    if (isReady()) API.editData(trx.id, updated).catch(e=>console.error("Edit sync error:", e));
  };

  return (
    <div style={{padding:"4px 0"}}>
      <div className="al aw mb4"><Ic n="alert" s={14} c="#d97706"/><span>Edit Pengajuan</span></div>
      <div className="fs mb3">
        <div className="fst">Jenis Pengajuan</div>
        <div style={{display:"flex",gap:9}}>
          {[["reimburse","💰 Reimburse"],["cash_advance","🏦 Cash Advance"]].map(([v,l])=>(
            <label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:"var(--r2)",border:`2px solid ${f.type===v?"var(--tl)":"var(--ln)"}`,background:f.type===v?"var(--tlb)":"var(--w)",cursor:"pointer"}}>
              <input type="radio" checked={f.type===v} onChange={()=>set("type",v)} style={{width:"auto"}}/><span style={{fontSize:13,fontWeight:700}}>{l}</span>
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
            {f.items.length>1&&<button className="btn bo xs" onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))}><Ic n="trash" s={12}/></button>}
          </div>
        ))}
        <button className="btn bo sm" onClick={()=>setF(p=>({...p,items:[...p.items,{cat:"Perjalanan Dinas",amt:""}]}))}>+ Item</button>
      </div>
      <div className="fg fg2 mb3">
        <div className="fs"><div className="fst">Nama Admin *</div><input value={f.approverName} onChange={e=>set("approverName",e.target.value)}/></div>
        <div className="fs"><div className="fst">Catatan</div><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:9}}>
        <button className="btn bo" onClick={onCancel}>Batal</button>
        <button className="btn bp" onClick={save}>Simpan</button>
      </div>
    </div>
  );
}

function OerReconBox({ trx, rc, isFin, isOwner, onAction }) {
  const [editMode, setEditMode] = useState(false); 
  const [items, setItems] = useState(OER_CATS.map(cat => ({ cat, amt: (trx.oerCategories||[]).find(x=>x.cat===cat) ? String((trx.oerCategories||[]).find(x=>x.cat===cat).amt) : "" })));
  const [oerNote, setOerNote] = useState(trx.oerNote||""); 
  const editTotal = items.reduce((s,it)=>s+(parseFloat(it.amt)||0),0);
  const editRc = editMode ? (() => { const sel = editTotal - trx.amount; return { ca:trx.amount, oer:editTotal, selisih:sel, isKurang:sel>0, isLebih:sel<0, isLunas:sel===0 }; })() : rc;
  
  const saveEdit = () => { 
    const cats = items.filter(it=>parseFloat(it.amt)>0).map(it=>({cat:it.cat,amt:parseFloat(it.amt)}));
    const oerAmt = cats.reduce((s,it)=>s+it.amt,0);
    onAction(trx.id, "edit_oer", {oerAmount:oerAmt, oerCategories:cats, oerNote, caAmount:trx.amount}); 
    if (isReady()) API.updateOer(trx.id, cats, oerNote, trx.amount).catch(e=>console.error("OER edit err:",e));
    setEditMode(false); 
  };

  const doSettle = (note) => {
    onAction(trx.id, "settle", note);
    if (isReady()) API.updateStatus(trx.id, { status:"settled", settled:true, settled_date:today(), finance_note:note }).catch(e=>console.error("Settle err:",e));
  };
  
  const colV = editRc.isKurang?"#1e40af":editRc.isLebih?"#7c3aed":"#059669";
  
  return (
    <div style={{marginBottom:16,border:`2px solid ${editRc.isLebih?"#c4b5fd":"#93c5fd"}`,borderRadius:10,overflow:"hidden"}}>
      <div style={{padding:"9px 14px",background:editRc.isLebih?"#ede9fe":"#dbeafe",fontWeight:800,fontSize:12,display:"flex",justifyContent:"space-between"}}>
        <span>📊 Rekonsiliasi</span>
        {isFin && !trx.settled && <button className="btn bo sm" onClick={()=>setEditMode(!editMode)}>{editMode?"Batal":"Edit"}</button>}
      </div>
      <div style={{padding:14}}>
        {editMode ? (
          <>
            {items.map((it,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12}}>{it.cat}</span><input type="number" value={it.amt} onChange={e=>{const n=[...items];n[i].amt=e.target.value;setItems(n);}} style={{width:100,textAlign:"right"}}/></div>))}
            <textarea value={oerNote} onChange={e=>setOerNote(e.target.value)} placeholder="Catatan koreksi..." rows={2} style={{marginTop:8,width:"100%"}}/>
            <div style={{textAlign:"right"}}><button className="btn bg mt2" onClick={saveEdit}>Simpan</button></div>
          </>
        ) : (
          <>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>CA</span><span>{rp(rc.ca)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>OER</span><span>{rp(rc.oer)}</span></div>
            <div style={{height:1,background:"var(--ln)",margin:"8px 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,color:colV}}><span>{rc.isKurang?"Finance bayar kamu":rc.isLebih?"Kamu bayar perusahaan":"Pas"}</span><span>{rp(Math.abs(rc.selisih))}</span></div>
            
            {isOwner && !trx.settled && rc.isLebih && (
              <div className="al aw mt3" style={{fontSize:12}}>
                <div>
                  <p style={{fontWeight:800,marginBottom:6}}>⚠️ Sisa CA Perlu Dikembalikan: <strong>{rp(Math.abs(rc.selisih))}</strong></p>
                  <p style={{marginBottom:4}}>1. Transfer <strong>{rp(Math.abs(rc.selisih))}</strong> ke rekening perusahaan</p>
                  <p style={{marginBottom:4}}>2. Screenshot bukti transfer</p>
                  <p style={{marginBottom:8}}>3. Kirim foto bukti ke WhatsApp Finance, sebutkan ID <strong>{trx.id}</strong></p>
                  <a href={`https://wa.me/${FINANCE_WA}?text=${encodeURIComponent(`Halo, saya ${trx.submitter} mengirim bukti transfer pengembalian CA.\n\nID: ${trx.id}\nNominal: ${rp(Math.abs(rc.selisih))}\n\nTerlampir bukti transfer.`)}`}
                    target="_blank" rel="noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 12px",background:"#25D366",borderRadius:8,color:"white",fontWeight:800,fontSize:12,textDecoration:"none"}}>
                    📲 Kirim via WhatsApp ke {FINANCE_WA_NAME}
                  </a>
                </div>
              </div>
            )}
            {isFin && !trx.settled && (trx.status==="lebih_bayar"||trx.status==="employee_confirmed") && (
              <div className="mt3">
                <button className="btn sm" style={{width:"100%",background:rc.isLebih?"#7c3aed":"#059669",color:"white"}}
                  onClick={()=>doSettle(rc.isLebih?"Dana diterima via WA":"Sudah transfer ke karyawan")}>
                  Konfirmasi & Selesaikan
                </button>
              </div>
            )}
            {isFin && trx.status==="kurang_bayar" && (
              <div className="mt3">
                <button className="btn bp sm" style={{width:"100%"}}
                  onClick={()=>{ onAction(trx.id,"awaiting_confirm"); if(isReady()) API.updateStatus(trx.id,{status:"awaiting_confirm"}).catch(()=>{}); }}>
                  Kirim Konfirmasi ke Karyawan
                </button>
              </div>
            )}
            {isOwner && trx.status==="awaiting_confirm" && rc.isKurang && (
              <div className="mt3">
                <button className="btn bg sm" style={{width:"100%"}}
                  onClick={()=>{ onAction(trx.id,"employee_confirmed"); if(isReady()) API.updateStatus(trx.id,{status:"employee_confirmed"}).catch(()=>{}); }}>
                  ✓ Setuju & Konfirmasi
                </button>
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
  const [note,setNote] = useState(""); 
  const [tDate,setTDate] = useState(trx.transferDate||""); 
  const [busy,setBusy] = useState(false);
  const [editing,setEditing] = useState(false);
  
  const isFin = user.role==="finance"; 
  const isGA = user.role==="ga";
  const isAdminLK = user.role==="admin_lk";
  const isAdminJKT = user.role==="admin_jkt";
  const isOwner = user.role==="employee" && (trx.submitterUsername===user.username || trx.submitter===user.name);
  
  // Hanya Admin LK, Admin JKT, GA, Finance yang boleh edit
  const canEdit = isFin || isGA || isAdminLK || isAdminJKT;
  
  const rc = recon(trx);
  
  const OER_STATUSES = ["awaiting_oer","oer_doc_pending","oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"];
  const isOERPhase = OER_STATUSES.includes(trx.status);
  const OER_SUBMITTED = ["oer_doc_pending","oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"].includes(trx.status);
  const docStatuses = ["doc_received_lk","doc_sent_jkt","doc_received_jkt","doc_complete","approved","processing","paid",...OER_STATUSES];

  const tlBase = [
    {ok:true, icon:"send", title:"Pengajuan Dikirim", sub:`${trx.submitter} · ${fd(trx.submitted)}`, col:"var(--tl)"},
    {ok:docStatuses.includes(trx.status), icon:"user", title:"Diterima Admin LK", sub:trx.adminLkName||(trx.status==="pending"?"Menunggu dokumen fisik…":"–"), col:"var(--tl)"},
    {ok:["doc_sent_jkt","doc_received_jkt","doc_complete","approved","processing","paid",...OER_STATUSES].includes(trx.status), icon:"send", title:"Dikirim ke Jakarta", sub:"", col:"var(--bl)"},
    {ok:["doc_received_jkt","doc_complete","approved","processing","paid",...OER_STATUSES].includes(trx.status), icon:"user", title:"Diterima Admin JKT", sub:trx.adminJktName||"–", col:"var(--tl)"},
    {ok:["doc_complete","approved","processing","paid",...OER_STATUSES].includes(trx.status), icon:"check", title:"Dokumen Lengkap (GA)", sub:trx.gaNote||"–", col:"var(--gn)"},
    {ok:["processing","paid",...OER_STATUSES].includes(trx.status), icon:"money", title:"Diproses Finance", sub:"", col:"var(--pu)"},
  ];

  const tl = trx.type==="cash_advance" ? [
    ...tlBase,
    {ok:isOERPhase, icon:"check", title:"Pembayaran CA Pertama", sub:isOERPhase?`Dibayar ${fd(trx.settledDate)}`:"", col:"var(--gn)"},
    {ok:OER_SUBMITTED, icon:"send", title:"OER Disubmit", sub:trx.oerDate?`${fd(trx.oerDate)} · ${rp(trx.oerAmount)}`:"", col:"#ca8a04"},
    {ok:["oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"].includes(trx.status), icon:"user", title:"OER Diterima Admin JKT", sub:"", col:"var(--tl)"},
    {ok:["oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"].includes(trx.status), icon:"check", title:"OER Disetujui GA", sub:trx.gaOerNote||"", col:"var(--gn)"},
    {ok:trx.settled||trx.status==="settled", icon:"check", title:"Selesai", sub:trx.settled?`Lunas ${fd(trx.settledDate)}`:"", col:"var(--gn)"}
  ] : [
    ...tlBase,
    {ok:trx.status==="paid"||trx.settled, icon:"check", title:"Pembayaran Selesai", sub:(trx.status==="paid"||trx.settled)?`Lunas ${fd(trx.settledDate)}`:"", col:"var(--gn)"}
  ];

  const act = async (a, n, d) => { 
    setBusy(true);
    try {
      onAction(trx.id, a, n, trx.type, d);
      const newStatus = a==="pay" ? (trx.type==="cash_advance" ? "awaiting_oer" : "paid")
                      : a==="process" ? "processing"
                      : a==="approve" ? "approved"
                      : a;
      await API.updateStatus(trx.id, { status: newStatus, finance_note: n||"", transfer_date: d||"", settled_date: today() });
    } finally { setBusy(false); }
  };

  return (
    <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mo">
        <div className="mh">
          <div><span className="mono">{trx.id}</span><h2 style={{fontSize:15,fontWeight:800}}>{trx.purpose}</h2></div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {canEdit && !editing && <button className="btn bo sm" onClick={()=>setEditing(true)}>✏️ Edit</button>}
            {editing && <span style={{fontSize:11,fontWeight:700,color:"var(--am)",background:"var(--amb)",padding:"3px 9px",borderRadius:20}}>Mode Edit</span>}
            <button className="btn bo sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="mb2">
          {/* ✅ onEdit sekarang berfungsi karena sudah ditambahkan ke Props di atas */}
          {editing ? <EditForm trx={trx} onSave={updated=>{setEditing(false);onEdit(updated);}} onCancel={()=>setEditing(false)}/> : <>
            <div style={{display:"flex",gap:7,alignItems:"center",padding:10,background:"var(--ln2)",borderRadius:10,marginBottom:16}}><TTag t={trx.type}/><SBadge s={trx.status} trx={trx} isOwner={isOwner}/><LateBadge d={trx}/></div>
            <div className="g2 mb4"><div><p className="sl">Pemohon</p><p className="bold">{trx.submitter}</p><p style={{fontSize:12}}>{trx.dept}</p></div><div><p className="sl">Perjalanan</p><p className="bold">{trx.destination}</p><p style={{fontSize:12}}>{fd(trx.dateStart)} – {fd(trx.dateEnd)}</p></div></div>
            <div className="fs mb4"><div className="fst">Rincian</div>{trx.categories.map((c,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>{c.cat}</span><span className="bold">{rp(c.amt)}</span></div>))}<div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"2px solid var(--tl)"}}><span className="bold">TOTAL</span><span className="bold" style={{fontSize:16}}>{rp(trx.amount)}</span></div></div>
            {trx.type==="cash_advance" && rc && <OerReconBox trx={trx} rc={rc} isFin={isFin} isOwner={isOwner} onAction={onAction}/>}
            <p className="sl mb3">Progress</p><div>{tl.map((t,i)=>(<div key={i} className="tlr"><div className="tldc"><div className="tld" style={{background:t.ok?t.col:"var(--ln)"}}><Ic n={t.icon} s={12} c={t.ok?"#fff":"var(--i4)"}/></div>{i<tl.length-1&&<div className="tlln"/>}</div><div className="tlb"><div className="tlt" style={{color:t.ok?"var(--ink)":"var(--i4)"}}>{t.title}</div><div className="tls">{t.sub}</div></div></div>))}</div>
            {isFin && ["approved","doc_complete"].includes(trx.status) && <div className="mt4 fs"><div className="fst">Mulai Proses</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan..." rows={2}/><button className="btn bp mt2" onClick={()=>act("process",note)} disabled={busy}>{busy?"Loading...":"Proses"}</button></div>}
            {isFin && trx.status==="processing" && <div className="mt4 fs"><div className="fst">Konfirmasi Bayar</div><p style={{fontSize:12,marginBottom:8}}>Transfer ke: <strong>{trx.submitter}</strong></p><label className="fl">Tgl Masuk Rekening (Opsional)</label><input type="date" value={tDate} onChange={e=>setTDate(e.target.value)}/><button className="btn bg mt2" onClick={()=>act("pay",note,tDate)} disabled={busy}>{busy?"Loading...":"Tandai Dibayar"}</button></div>}
            {isOwner && trx.type==="cash_advance" && ["paid","awaiting_oer"].includes(trx.status) && !trx.oerAmount && <div className="mt4 fs"><div className="fst">Submit OER</div><p style={{fontSize:12,marginBottom:8}}>Trip selesai. Masukkan rincian pengeluaran aktual untuk rekonsiliasi.</p><button className="btn bp sm" onClick={()=>{const n = prompt("Total pengeluaran (Rp)? (Hanya angka)"); if(n){const d={oerAmount:parseFloat(n),oerCategories:[{cat:"Lain-lain",amt:parseFloat(n)}],oerDate:today()}; onAction(trx.id,"oer_submitted",d); API.submitOer(trx.id,d);}}} disabled={busy}>Isi OER (Cepat)</button></div>}
          </>}
        </div>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser] = useState(null); 
  const [page,setPage] = useState("dashboard"); 
  const [data,setData] = useState(DEMO);
  const [selId,setSelId] = useState(null); 
  const [toast,setToast] = useState(null); 
  const [loading,setLoading] = useState(false);

  const reloadData = async () => { if(!isReady())return; const res = await API.getAll(); if(res) setData(res.map(d=>withLateFlagOnly(d))); };
  const handleLogin = (u) => { setUser(u); setLoading(true); reloadData().then(()=>setLoading(false)); };
  const nav = (p, id) => { if (id) setSelId(id); setPage(p); };

  // Polling data
  useEffect(() => { if (!isReady() || !user) return; const timer = setInterval(() => reloadData(), 300000); return () => clearInterval(timer); }, [user]);

  const handleAction = (id, a, n, t, d) => {
    setData(prev=>prev.map(trx=>{
      if (trx.id!==id) return trx;
      if (a==="settle") return { ...trx, status:"settled", settled:true, settledDate:today(), financeNote:n||trx.financeNote };
      if (a==="edit_oer") { const sel=(n.oerAmount||0)-(n.caAmount||trx.amount); return { ...trx, oerAmount:n.oerAmount, oerCategories:n.oerCategories, oerNote:n.oerNote||trx.oerNote, status:sel>0?"kurang_bayar":sel<0?"lebih_bayar":"settled", settled:sel===0 }; }
      if (a==="pay") return { ...trx, status:(t==="cash_advance"?"awaiting_oer":"paid"), settledDate:today(), transferDate:d||"" };
      if (a==="oer_submitted") return { ...trx, ...n, status:"oer_doc_pending" };
      if (a==="edit") return { ...trx, ...n };
      const m = {approve:"approved",process:"processing",doc_received_lk:"doc_received_lk",doc_sent_jkt:"doc_sent_jkt",doc_received_jkt:"doc_received_jkt",doc_complete:"doc_complete",oer_doc_received:"oer_doc_received",oer_doc_complete:"oer_doc_complete",awaiting_confirm:"awaiting_confirm",employee_confirmed:"employee_confirmed"};
      return { ...trx, status: m[a]||trx.status, financeNote:n||trx.financeNote };
    }));
    setToast({msg:"✓ Berhasil"}); setTimeout(()=>setToast(null),2500);
    if (a==="settle") setSelId(null);
  };

  if (!user) return (<><style>{CSS}</style><LoginScreen onLogin={handleLogin}/></>);
  const sel = data.find(d=>d.id===selId);
  const NAV = {
    employee: [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"submit",ic:"plus",lb:"Ajukan"},{id:"list",ic:"list",lb:"Pengajuan Saya"}],
    admin_lk: [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"admin_lk_queue",ic:"check",lb:"Antrian LK"},{id:"list",ic:"list",lb:"Semua"}],
    admin_jkt:[{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"admin_jkt_queue",ic:"check",lb:"Antrian JKT"},{id:"list",ic:"list",lb:"Semua"}],
    ga:       [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"ga_queue",ic:"check",lb:"Antrian GA"},{id:"list",ic:"list",lb:"Semua"}],
    finance:  [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"monitor",ic:"chart",lb:"Monitor"},{id:"list",ic:"list",lb:"Semua"},{id:"overdue",ic:"alert",lb:"CA Outstanding"},{id:"settings",ic:"settings",lb:"Pengaturan"}],
  };

  return (
    <><style>{CSS}</style><div className="app">
      <div className="sb"><div className="sb-logo"><div className="sb-lh">ReimburseApp</div></div><div className="sb-u"><div className="av">{user.avatar}</div><div><div className="sb-un">{user.name}</div><div className="sb-ur">{user.role}</div></div></div>
        <nav className="sb-nav">{(NAV[user.role]||[]).map(i=>(<div key={i.id} className={`nv${page===i.id?" on":""}`} onClick={()=>nav(i.id)}><Ic n={i.ic} s={14}/>{i.lb}</div>))}</nav>
        <div className="nv" style={{marginTop:"auto", marginBottom:"16px", color:"#fca5a5", opacity:1}} onClick={()=>window.location.reload()}>
          <Ic n="logout" s={14}/><span>Log Out</span>
        </div>
      </div>
      <div className="main">
        <div className="bar"><h1 className="bt">{page.toUpperCase().replace("_"," ")}</h1><div className="br"><span className={`cs ${isReady()?"cs-ok":"cs-no"}`}>{isReady()?"Supabase ✓":"Offline"}</span><button className="btn bo sm" onClick={reloadData}>🔄</button></div></div>
        <div className="page">
          {loading ? <div className="empty">Memuat data...</div> : (
            <>
              {page==="dashboard" && <Dashboard data={data} user={user} nav={nav}/>}
              {page==="submit" && <SubmitPage user={user} onSubmit={d=>{setData([d,...data]); nav("list");}} data={data}/>}
              {page==="list" && <ListPage data={data} user={user} onSel={id=>setSelId(id)}/>}
              {page==="admin_lk_queue" && <AdminLKQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
              {page==="admin_jkt_queue" && <AdminJKTQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
              {page==="ga_queue" && <GAQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
              {page==="monitor" && <MonitorPage data={data} onSel={id=>setSelId(id)} onAction={handleAction}/>}
              {page==="settings" && <SettingsPage onSave={()=>reloadData()}/>}
              {page==="overdue" && (
                <div>
                  <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><strong>CA Outstanding — SLA: maks 5 hari kerja setelah trip selesai.</strong></div>
                  <div className="card">
                    <div className="ch">
                      <h3>CA Belum Selesai</h3>
                      <button className="btn bo sm" onClick={()=>{
                        const rows = data.filter(d=>d.type==="cash_advance"&&!d.settled&&!["rejected"].includes(d.status));
                        if (!rows.length) return alert("Tidak ada data CA outstanding.");
                        const headers = ["ID","Pemohon","Departemen","Keperluan","Tujuan","Trip Selesai","Hari Belum Serahkan Dok.","Status Dokumen","Jumlah","Status"];
                        const csvRows = rows.map(d=>{
                          const daysSince = workdaysSinceEnd(d.dateEnd);
                          const isPending = d.status === "pending";
                          const hariCol = isPending ? (daysSince > 5 ? `+${daysSince} hari (TERLAMBAT)` : `${daysSince} hari`) : "Dokumen sudah diserahkan";
                          return [d.id, d.submitter, d.dept, d.purpose, d.destination, d.dateEnd, hariCol, isPending?"Belum diserahkan":"Sudah diserahkan", d.amount, STATUS[d.status]?.label||d.status];
                        });
                        const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
                        const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href=url; a.download=`CA_Outstanding_${today()}.csv`; a.click();
                        URL.revokeObjectURL(url);
                      }}>
                        ⬇️ Export Excel
                      </button>
                    </div>
                    <div className="tw"><table>
                      <thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Trip Selesai</th><th>Hari Belum Serahkan Dok.</th><th>Jumlah</th><th>Status</th></tr></thead>
                      <tbody>{data.filter(d=>d.type==="cash_advance"&&!d.settled&&!["rejected"].includes(d.status)).map(d=>{
                        const daysSince = workdaysSinceEnd(d.dateEnd);
                        const isPending = d.status === "pending";
                        return (
                          <tr key={d.id} onClick={()=>setSelId(d.id)} style={{cursor:"pointer"}}>
                            <td><span className="mono">{d.id}</span></td>
                            <td><div className="bold">{d.submitter}</div><div style={{fontSize:11,color:"var(--i3)"}}>{d.dept}</div></td>
                            <td><div className="trunc" style={{maxWidth:140}}>{d.purpose}</div></td>
                            <td>{fd(d.dateEnd)}</td>
                            <td>
                              {isPending
                                ? daysSince > 5
                                  ? <span style={{fontWeight:800,color:"var(--rd)"}}>+{daysSince} hari ⚠️</span>
                                  : <span style={{color:"var(--am)"}}>{daysSince} hari</span>
                                : <span style={{color:"var(--gn)",fontWeight:700}}>✓ Dokumen diserahkan</span>
                              }
                            </td>
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
    {sel && <DetailModal trx={sel} user={user} onClose={()=>setSelId(null)} onAction={handleAction} onEdit={updated=>{setData(prev=>prev.map(d=>d.id===updated.id?withLateFlagOnly(updated):d)); setToast({msg:"✓ Pengajuan berhasil diperbarui"}); setTimeout(()=>setToast(null),2500);}}/>}
    {toast && <div className="toast" style={{background:"var(--ink)"}}>{toast.msg}</div>}</>
  );
}
