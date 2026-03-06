import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// ⚙️  KONFIGURASI — ISI SETELAH SETUP GOOGLE SHEETS
//    Ikuti panduan di file "Panduan_Setup_Google_Sheets.docx"
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  // 1. Paste URL Apps Script Web App kamu di sini
  //    Contoh: "https://script.google.com/macros/s/AKfy.../exec"
  SCRIPT_URL: "",

  // 2. Ganti ke false setelah URL diisi
  DEMO_MODE: true,
};

// ═══════════════════════════════════════════════════════════════
// DATA DEMO
// ═══════════════════════════════════════════════════════════════
const DEMO_DATA = [
  { id:"TRX-001", type:"cash_advance", submitter:"Budi Santoso", email:"budi@co.id", dept:"Marketing", purpose:"Meeting klien Surabaya", destination:"Surabaya", dateStart:"2026-03-01", dateEnd:"2026-03-03", amount:3500000, status:"paid", submitted:"2026-02-25", categories:[{cat:"Perjalanan Dinas",amt:1500000},{cat:"Akomodasi",amt:1200000},{cat:"Makan",amt:800000}], notes:"", settled:true, settledDate:"2026-03-08", approverName:"Sari Dewi", financeNote:"Sudah transfer BCA" },
  { id:"TRX-002", type:"reimburse", submitter:"Budi Santoso", email:"budi@co.id", dept:"Marketing", purpose:"Promosi event Jakarta", destination:"Jakarta", dateStart:"2026-03-05", dateEnd:"2026-03-05", amount:850000, status:"processing", submitted:"2026-03-06", categories:[{cat:"Transportasi",amt:350000},{cat:"Makan",amt:500000}], notes:"Struk sudah diupload", settled:false, settledDate:null, approverName:"Sari Dewi", financeNote:"Sedang dicek" },
  { id:"TRX-003", type:"cash_advance", submitter:"Andi Pratama", email:"andi@co.id", dept:"Sales Dealer", purpose:"Kunjungan dealer Bandung", destination:"Bandung", dateStart:"2026-02-20", dateEnd:"2026-02-21", amount:2000000, status:"overdue", submitted:"2026-02-18", categories:[{cat:"Perjalanan Dinas",amt:800000},{cat:"Akomodasi",amt:700000},{cat:"Lain-lain",amt:500000}], notes:"", settled:false, settledDate:null, approverName:"Dian Susanti", financeNote:"CA melewati 5 hari kerja!" },
  { id:"TRX-004", type:"reimburse", submitter:"Citra Lestari", email:"citra@co.id", dept:"Collection", purpose:"Penagihan lapangan Bekasi", destination:"Bekasi", dateStart:"2026-03-08", dateEnd:"2026-03-08", amount:275000, status:"pending", submitted:"2026-03-09", categories:[{cat:"Transportasi",amt:175000},{cat:"Komunikasi",amt:100000}], notes:"", settled:false, settledDate:null, approverName:"Sari Dewi", financeNote:"" },
  { id:"TRX-005", type:"cash_advance", submitter:"Dewi Rahayu", email:"dewi@co.id", dept:"IT", purpose:"Training vendor software", destination:"Jakarta", dateStart:"2026-03-15", dateEnd:"2026-03-17", amount:4200000, status:"approved", submitted:"2026-03-10", categories:[{cat:"Perjalanan Dinas",amt:1000000},{cat:"Akomodasi",amt:2100000},{cat:"Makan",amt:1100000}], notes:"Mohon segera diproses", settled:false, settledDate:null, approverName:"Sari Dewi", financeNote:"" },
  { id:"TRX-006", type:"reimburse", submitter:"Budi Santoso", email:"budi@co.id", dept:"Marketing", purpose:"Pembelian branding material", destination:"Jakarta", dateStart:"2026-03-12", dateEnd:"2026-03-12", amount:1250000, status:"rejected", submitted:"2026-03-13", categories:[{cat:"Lain-lain",amt:1250000}], notes:"", settled:false, settledDate:null, approverName:"Sari Dewi", financeNote:"Struk tidak terbaca, upload ulang" },
];

const USERS = {
  employee: { id:"E001", name:"Budi Santoso",      email:"budi@co.id",  role:"employee", dept:"Marketing",    avatar:"BS" },
  approver: { id:"A001", name:"Sari Dewi",          email:"sari@co.id",  role:"approver", dept:"Marketing",    avatar:"SD" },
  finance:  { id:"F001", name:"Finance",   email:"ira@co.id",   role:"finance",  dept:"Finance",      avatar:"IR" },
};

const CATEGORIES = ["Perjalanan Dinas","Akomodasi / Hotel","Makan & Entertainment","Transportasi","Uang Saku","Komunikasi","Lain-lain"];

const STATUS = {
  draft:      { label:"Draft",             color:"#475569", bg:"#f1f5f9", dot:"#94a3b8" },
  pending:    { label:"Menunggu Approval", color:"#92400e", bg:"#fffbeb", dot:"#f59e0b" },
  approved:   { label:"Disetujui",         color:"#1e40af", bg:"#eff6ff", dot:"#3b82f6" },
  processing: { label:"Diproses Finance",  color:"#5b21b6", bg:"#f5f3ff", dot:"#8b5cf6" },
  paid:       { label:"Sudah Dibayar",     color:"#065f46", bg:"#ecfdf5", dot:"#10b981" },
  rejected:   { label:"Ditolak",           color:"#991b1b", bg:"#fef2f2", dot:"#ef4444" },
  overdue:    { label:"CA Terlambat ⚠️",  color:"#9f1239", bg:"#fff1f2", dot:"#e11d48" },
};

let _nid = 7;
const gid   = () => `TRX-${String(_nid++).padStart(3,"0")}`;
const rp    = n  => "Rp " + new Intl.NumberFormat("id-ID").format(n||0);
const fd    = d  => d ? new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "–";
const today = () => new Date().toISOString().split("T")[0];
const diff  = (a,b) => Math.round((new Date(b)-new Date(a))/864e5);

// ═══════════════════════════════════════════════════════════════
// GOOGLE SHEETS API
// ═══════════════════════════════════════════════════════════════
const API = {
  async call(action, payload={}) {
    if (CONFIG.DEMO_MODE || !CONFIG.SCRIPT_URL) return null;
    try {
      const r = await fetch(CONFIG.SCRIPT_URL, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action, ...payload }),
      });
      return await r.json();
    } catch(e) { console.error(e); return null; }
  },
  getAll:          ()        => API.call("getAll"),
  create:          (data)    => API.call("create",       { data }),
  updateStatus:    (id,s,n)  => API.call("updateStatus", { id, status:s, note:n }),
  settle:          (id,n)    => API.call("settle",        { id, note:n }),
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#f0f2f5; --white:#fff; --ink:#0c1824; --ink2:#334155; --ink3:#64748b;
  --ink4:#94a3b8; --ln:#e2e8f0; --ln2:#f1f5f9;
  --tl:#0d9488; --tl2:#14b8a6; --tl-bg:#f0fdfa; --tl-bd:#99f6e4;
  --am:#d97706; --am-bg:#fffbeb; --am-bd:#fde68a;
  --rd:#dc2626; --rd-bg:#fef2f2; --rd-bd:#fca5a5;
  --bl:#2563eb; --bl-bg:#eff6ff; --bl-bd:#93c5fd;
  --gn:#059669; --gn-bg:#ecfdf5; --gn-bd:#6ee7b7;
  --pu:#7c3aed; --pu-bg:#f5f3ff;
  --r:14px; --r2:10px; --r3:7px;
  --s1:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
  --s2:0 4px 20px rgba(0,0,0,.07),0 2px 8px rgba(0,0,0,.04);
  --s3:0 24px 60px rgba(0,0,0,.13),0 8px 20px rgba(0,0,0,.06);
}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;font-size:14px}

/* LAYOUT */
.app{display:flex;min-height:100vh}
.sb{width:248px;background:var(--ink);display:flex;flex-direction:column;position:fixed;height:100vh;z-index:200;transition:.25s ease}
.main{flex:1;margin-left:248px;min-height:100vh;display:flex;flex-direction:column}
.bar{height:56px;background:var(--white);border-bottom:1px solid var(--ln);display:flex;align-items:center;padding:0 24px;gap:12px;position:sticky;top:0;z-index:100}
.page{padding:24px;flex:1}

/* SIDEBAR */
.sb-logo{padding:20px 18px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
.sb-logo-h{font-family:'DM Serif Display',serif;font-size:20px;color:#fff;font-style:italic}
.sb-logo-s{font-size:10px;font-weight:700;color:var(--tl2);letter-spacing:.12em;text-transform:uppercase;margin-top:1px}
.sb-user{padding:12px 16px;display:flex;align-items:center;gap:9px;border-bottom:1px solid rgba(255,255,255,.06)}
.av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--tl),var(--tl2));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0}
.sb-uname{font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-urole{font-size:11px;color:var(--ink4);margin-top:1px;text-transform:capitalize}
.sb-nav{flex:1;padding:8px;overflow-y:auto}
.nv-sec{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.18);padding:10px 10px 4px}
.nv{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;color:rgba(255,255,255,.45);font-size:13px;font-weight:500;margin-bottom:1px;transition:.12s;user-select:none}
.nv:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8)}
.nv.on{background:var(--tl);color:#fff;font-weight:600}
.nv .nb{margin-left:auto;background:var(--rd);color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:10px}
.sb-foot{padding:10px 8px 12px;border-top:1px solid rgba(255,255,255,.06)}
.demo-box{background:rgba(255,255,255,.05);border-radius:8px;padding:11px}
.demo-lbl{font-size:10px;color:rgba(255,255,255,.25);font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px;display:flex;align-items:center;gap:6px}
.demo-badge{background:var(--am);color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:3px;letter-spacing:.04em;text-transform:uppercase}
.rb{display:block;width:100%;padding:7px 9px;border-radius:6px;border:none;background:transparent;cursor:pointer;font-size:12px;font-weight:500;color:rgba(255,255,255,.4);text-align:left;transition:.12s;font-family:inherit;margin-bottom:1px}
.rb:hover{background:rgba(255,255,255,.07);color:#fff}
.rb.on{background:rgba(13,148,136,.22);color:var(--tl2);font-weight:600}

/* TOPBAR */
.bar-title{font-size:15px;font-weight:800;color:var(--ink);flex:1;letter-spacing:-.01em}
.bar-right{display:flex;align-items:center;gap:8px}
.conn{display:flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700}
.conn-demo{background:var(--am-bg);color:var(--am);border:1px solid var(--am-bd)}
.conn-live{background:var(--gn-bg);color:var(--gn);border:1px solid var(--gn-bd)}

/* CARD */
.card{background:var(--white);border-radius:var(--r);border:1px solid var(--ln);box-shadow:var(--s1)}
.ch{padding:15px 20px;border-bottom:1px solid var(--ln);display:flex;align-items:center;justify-content:space-between;gap:12px}
.ch h3{font-size:14px;font-weight:800;color:var(--ink);letter-spacing:-.01em}
.cb{padding:18px 20px}

/* STATS */
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin-bottom:20px}
.st{background:var(--white);border:1px solid var(--ln);border-radius:var(--r);padding:16px 18px;position:relative;overflow:hidden;box-shadow:var(--s1);transition:.15s}
.st::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%}
.st.tl::before{background:var(--tl)} .st.am::before{background:var(--am)}
.st.rd::before{background:var(--rd)} .st.bl::before{background:var(--bl)}
.st.gn::before{background:var(--gn)} .st.pu::before{background:var(--pu)}
.sl{font-size:10.5px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
.sv{font-size:26px;font-weight:800;color:var(--ink);letter-spacing:-.03em;line-height:1}
.sv.md{font-size:18px} .sv.sm{font-size:14px;font-weight:700}
.ss{font-size:11px;color:var(--ink4);margin-top:4px}
.pb{height:4px;background:var(--ln);border-radius:2px;overflow:hidden;margin-top:7px}
.pbf{height:100%;border-radius:2px;transition:.4s}

/* TABLE */
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{padding:8px 13px;text-align:left;font-size:10.5px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.07em;border-bottom:2px solid var(--ln);background:var(--ln2);white-space:nowrap}
td{padding:11px 13px;font-size:13px;color:var(--ink2);border-bottom:1px solid var(--ln);vertical-align:middle}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#fafbfd;cursor:pointer}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r2);border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;transition:.12s;line-height:1;white-space:nowrap}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-p{background:var(--tl);color:#fff;box-shadow:0 2px 6px rgba(13,148,136,.25)}
.btn-p:hover:not(:disabled){background:#0f766e}
.btn-g{background:var(--gn);color:#fff} .btn-g:hover:not(:disabled){background:#047857}
.btn-r{background:var(--rd);color:#fff} .btn-r:hover:not(:disabled){background:#b91c1c}
.btn-o{background:transparent;color:var(--ink2);border:1.5px solid var(--ln)} .btn-o:hover:not(:disabled){background:var(--ln2)}
.btn-a{background:var(--am);color:#fff} .btn-a:hover:not(:disabled){background:#b45309}
.sm{padding:6px 12px;font-size:12px;border-radius:8px}
.xs{padding:3px 9px;font-size:11.5px;border-radius:6px}

/* FORM */
.fg{display:grid;gap:13px}
.fg2{grid-template-columns:1fr 1fr}
.fg3{grid-template-columns:1fr 1fr 1fr}
.fl{display:block;font-size:11.5px;font-weight:700;color:var(--ink2);margin-bottom:4px}
.fl .rq{color:var(--rd);margin-left:1px}
input,select,textarea{width:100%;padding:8px 11px;border:1.5px solid var(--ln);border-radius:var(--r3);font-family:inherit;font-size:13px;color:var(--ink);background:var(--white);outline:none;transition:.12s}
input:focus,select:focus,textarea:focus{border-color:var(--tl);box-shadow:0 0 0 3px rgba(13,148,136,.1)}
textarea{resize:vertical;min-height:70px;line-height:1.5}
.fs{background:var(--ln2);border-radius:var(--r2);padding:14px;border:1px solid var(--ln)}
.fst{font-size:10.5px;font-weight:800;color:var(--tl);text-transform:uppercase;letter-spacing:.1em;margin-bottom:11px}

/* BADGES */
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700}
.badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0}
.tag{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700}
.tag-ca{background:#dbeafe;color:#1e40af} .tag-re{background:#f3e8ff;color:#6b21a8}

/* MODAL */
.ov{position:fixed;inset:0;background:rgba(12,24,36,.6);backdrop-filter:blur(6px);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;animation:fi .15s}
@keyframes fi{from{opacity:0}to{opacity:1}}
.mo{background:var(--white);border-radius:var(--r);box-shadow:var(--s3);width:100%;max-width:640px;max-height:90vh;overflow-y:auto;animation:su .18s}
@keyframes su{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.mh{padding:16px 20px;border-bottom:1px solid var(--ln);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:sticky;top:0;background:var(--white);z-index:1}
.mb{padding:20px}
.mf{padding:12px 20px;border-top:1px solid var(--ln);display:flex;gap:8px;justify-content:flex-end}

/* TIMELINE */
.tl-row{display:flex;gap:11px;margin-bottom:13px}
.tl-dc{display:flex;flex-direction:column;align-items:center}
.tl-d{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tl-ln{width:2px;flex:1;margin-top:3px;background:var(--ln)}
.tl-b{flex:1;padding-top:2px}
.tl-t{font-size:12.5px;font-weight:700}
.tl-s{font-size:11px;color:var(--ink3);margin-top:2px}

/* ALERTS */
.al{padding:10px 14px;border-radius:var(--r2);font-size:12.5px;display:flex;align-items:flex-start;gap:8px;line-height:1.5}
.aw{background:var(--am-bg);border:1px solid var(--am-bd);color:#78350f}
.ae{background:var(--rd-bg);border:1px solid var(--rd-bd);color:#7f1d1d}
.ag{background:var(--gn-bg);border:1px solid var(--gn-bd);color:#064e3b}
.ab{background:var(--bl-bg);border:1px solid var(--bl-bd);color:#1e3a8a}
.at{background:var(--tl-bg);border:1px solid var(--tl-bd);color:#134e4a}

/* UTILS */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.row{display:flex;align-items:center;gap:8px}
.mb1{margin-bottom:4px}.mb2{margin-bottom:8px}.mb3{margin-bottom:12px}
.mb4{margin-bottom:16px}.mb5{margin-bottom:20px}.mb6{margin-bottom:24px}
.mt3{margin-top:12px}.mt4{margin-top:16px}.mt6{margin-top:24px}
.mu{color:var(--ink3)}.bold{font-weight:700}.mono{font-family:ui-monospace,monospace;font-size:12px;font-weight:700;color:var(--tl)}
.trunc{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.empty{text-align:center;padding:48px 20px;color:var(--ink4)}
.sp{display:inline-block;width:16px;height:16px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.toast{position:fixed;bottom:22px;right:22px;z-index:999;padding:11px 18px;border-radius:var(--r2);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;box-shadow:var(--s3);animation:su .2s}
.flt{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.flt input,.flt select{flex:1;min-width:130px;width:auto}

/* HERO */
.hero{background:linear-gradient(130deg,#0c1824 0%,#133040 60%,#164050 100%);border-radius:16px;padding:24px 28px;color:#fff;position:relative;overflow:hidden;margin-bottom:20px}
.hero-ring1{position:absolute;right:-30px;top:-30px;width:180px;height:180px;border-radius:50%;background:rgba(13,148,136,.12)}
.hero-ring2{position:absolute;right:70px;bottom:-50px;width:130px;height:130px;border-radius:50%;background:rgba(20,184,166,.08)}
.hero-inner{position:relative}

/* SETTINGS */
.code-block{background:#0c1824;border-radius:var(--r2);padding:14px 16px;overflow-x:auto;border:1px solid rgba(255,255,255,.08)}
.code-block pre{font-size:11px;color:#e2e8f0;line-height:1.65;font-family:ui-monospace,monospace;white-space:pre-wrap}

/* RESPONSIVE */
@media(max-width:800px){
  .sb{transform:translateX(-100%)}.sb.open{transform:none}
  .main{margin-left:0}
  .fg2,.fg3,.g2,.g3{grid-template-columns:1fr}
  .sg{grid-template-columns:1fr 1fr}
  .page{padding:14px}
  .bar{padding:0 14px}
}
@media(max-width:480px){.sg{grid-template-columns:1fr}}
`;

// ═══════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════
const paths = {
  home:    "M3 12L12 3l9 9M9 21V12h6v9M3 12v9h18v-9",
  plus:    "M12 5v14M5 12h14",
  list:    "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  check:   "M20 6 9 17 4 12",
  x:       "M18 6 6 18M6 6l12 12",
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6",
  clock:   "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  alert:   "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  money:   "M1 4h22v16H1zM1 10h22",
  user:    "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8",
  chart:   "M18 20V10M12 20V4M6 20v-6M2 20h20",
  send:    "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7",
  trash:   "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  bell:    "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  settings:"M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
  link:    "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  menu:    "M3 12h18M3 6h18M3 18h18",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  copy:    "M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.09 19.105 22 18 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z",
};
const Ic = ({ n, s=16, c="currentColor" }) => (
  <svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d={paths[n]||""}/>
  </svg>
);

const SBadge = ({ s }) => { const c=STATUS[s]||STATUS.draft; return <span className="badge" style={{color:c.color,background:c.bg}}>{c.label}</span>; };
const TTag   = ({ t }) => t==="cash_advance" ? <span className="tag tag-ca">Cash Advance</span> : <span className="tag tag-re">Reimburse</span>;

// ═══════════════════════════════════════════════════════════════
// APPS SCRIPT CODE (shown in settings)
// ═══════════════════════════════════════════════════════════════
const SCRIPT = `// ReimburseApp — Google Apps Script Backend
// Cara deploy: buka script.google.com → paste kode ini
// → Deploy → New deployment → Web app
// → Execute as: Me, Access: Anyone → Deploy
// Salin URL-nya ke halaman Settings di aplikasi

const SHEET = "Pengajuan";
const HDR = ["ID","Tipe","Pemohon","Email","Dept","Keperluan",
  "Kota","Tgl Mulai","Tgl Selesai","Jumlah","Status",
  "Tgl Submit","Catatan","Nama Atasan","Catatan Finance",
  "Settled","Tgl Settled","Kategori JSON"];

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HDR);
    sh.getRange(1,1,1,HDR.length)
      .setBackground("#0c1824").setFontColor("#fff").setFontWeight("bold");
  }
  if (d.action === "getAll")       return getAll(sh);
  if (d.action === "create")       return create(sh, d.data);
  if (d.action === "updateStatus") return updateSt(sh, d.id, d.status, d.note);
  if (d.action === "settle")       return doSettle(sh, d.id, d.note);
  return out({ ok: false });
}

function getAll(sh) {
  const rows = sh.getDataRange().getValues();
  const data = rows.slice(1).map(r => ({
    id:r[0], type:r[1], submitter:r[2], email:r[3], dept:r[4],
    purpose:r[5], destination:r[6], dateStart:r[7], dateEnd:r[8],
    amount:r[9], status:r[10], submitted:r[11], notes:r[12],
    approverName:r[13], financeNote:r[14], settled:r[15],
    settledDate:r[16],
    categories: (() => { try { return JSON.parse(r[17]||"[]"); } catch(e){ return []; } })()
  }));
  return out({ ok:true, data });
}

function create(sh, d) {
  sh.appendRow([d.id, d.type, d.submitter, d.email, d.dept,
    d.purpose, d.destination, d.dateStart, d.dateEnd,
    d.amount, "pending", d.submitted, d.notes,
    d.approverName, "", false, "", JSON.stringify(d.categories)]);
  // Kirim email notifikasi ke Finance
  try {
    GmailApp.sendEmail("ira@co.id",
      "[Reimburse] Pengajuan baru: " + d.id,
      d.submitter + " mengajukan " + d.type + " Rp " +
      d.amount.toLocaleString("id-ID") + "\\n" + d.purpose);
  } catch(e) {}
  return out({ ok:true, id:d.id });
}

function updateSt(sh, id, status, note) {
  const rows = sh.getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i+1,11).setValue(status);
      if (note) sh.getRange(i+1,15).setValue(note);
      break;
    }
  }
  return out({ ok:true });
}

function doSettle(sh, id, note) {
  const rows = sh.getDataRange().getValues();
  for (let i=1; i<rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i+1,16).setValue(true);
      sh.getRange(i+1,17).setValue(new Date().toISOString().split("T")[0]);
      if (note) sh.getRange(i+1,15).setValue(note);
      break;
    }
  }
  return out({ ok:true });
}

function out(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

// ═══════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════

function DashboardPage({ data, user, nav }) {
  const mine     = user.role==="finance" ? data : data.filter(d=>d.submitter===user.name);
  const pending  = data.filter(d=>d.status==="pending");
  const approved = data.filter(d=>d.status==="approved");
  const overdue  = data.filter(d=>d.status==="overdue");
  const totalRp  = mine.reduce((a,d)=>a+d.amount,0);
  const paidRp   = mine.filter(d=>d.status==="paid").reduce((a,d)=>a+d.amount,0);
  const active   = mine.filter(d=>["pending","approved","processing"].includes(d.status));
  const pct      = totalRp ? Math.min(100,Math.round(paidRp/totalRp*100)) : 0;
  return (
    <div>
      <div className="hero">
        <div className="hero-ring1"/><div className="hero-ring2"/>
        <div className="hero-inner">
          <p style={{fontSize:10,fontWeight:800,letterSpacing:".12em",textTransform:"uppercase",color:"var(--tl2)",marginBottom:4}}>Selamat datang</p>
          <h2 style={{fontSize:20,fontWeight:800,letterSpacing:"-.01em",marginBottom:3}}>{user.name}</h2>
          <p style={{fontSize:12.5,color:"rgba(255,255,255,.5)"}}>{user.dept} · {user.role==="finance"?"Finance Manager":user.role==="approver"?"Manager / Approver":"Karyawan"}</p>
          {CONFIG.DEMO_MODE && <span style={{marginTop:8,display:"inline-block",background:"rgba(217,119,6,.2)",border:"1px solid rgba(217,119,6,.35)",color:"#fcd34d",padding:"2px 9px",borderRadius:20,fontSize:10.5,fontWeight:700}}>Mode Demo — data tidak tersimpan ke Sheets</span>}
        </div>
      </div>

      {overdue.length>0 && <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><span><strong>{overdue.length} Cash Advance</strong> melewati batas 5 hari kerja. Segera tindak lanjuti!</span></div>}
      {user.role==="approver" && pending.length>0 && <div className="al aw mb4"><Ic n="clock" s={14} c="#d97706"/><span><strong>{pending.length} pengajuan</strong> menunggu persetujuan Anda.</span></div>}
      {user.role==="finance" && approved.length>0 && <div className="al ab mb4"><Ic n="money" s={14} c="#2563eb"/><span><strong>{approved.length} pengajuan</strong> sudah disetujui dan siap diproses.</span></div>}

      <div className="sg">
        {user.role!=="employee" && <div className="st tl"><div className="sl">Total Diajukan</div><div className="sv md">{rp(totalRp)}</div><div className="ss">{mine.length} pengajuan</div></div>}
        <div className="st am"><div className="sl">Sedang Berjalan</div><div className="sv">{active.length}</div><div className="ss">pengajuan aktif</div></div>
        <div className="st gn"><div className="sl">Sudah Dibayar</div><div className="sv md">{rp(paidRp)}</div><div className="pb"><div className="pbf" style={{width:`${pct}%`,background:"var(--gn)"}}/></div><div className="ss">{pct}% dari total</div></div>
        {overdue.length>0 && <div className="st rd"><div className="sl">CA Terlambat ⚠️</div><div className="sv">{overdue.length}</div><div className="ss">harus diselesaikan</div></div>}
        {user.role==="finance" && <><div className="st bl"><div className="sl">Siap Diproses</div><div className="sv">{approved.length}</div></div><div className="st pu"><div className="sl">Antrian Approval</div><div className="sv">{pending.length}</div></div></>}
      </div>

      <div className="card">
        <div className="ch"><h3>Pengajuan Terbaru</h3><button className="btn btn-o sm" onClick={()=>nav("list")}><Ic n="list" s={13}/>Lihat Semua</button></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Jenis</th><th>Keperluan</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>{mine.slice(0,6).map(d=>(
            <tr key={d.id} onClick={()=>nav("detail",d.id)}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--ink3)"}}>{d.dept}</div></td>
              <td><TTag t={d.type}/></td>
              <td><div className="trunc" style={{maxWidth:180,fontSize:13}}>{d.purpose}</div></td>
              <td className="bold">{rp(d.amount)}</td>
              <td><SBadge s={d.status}/></td>
            </tr>
          ))}</tbody>
        </table>
        {mine.length===0&&<div className="empty"><p>Belum ada pengajuan</p></div>}
        </div>
      </div>
    </div>
  );
}

function SubmitPage({ user, onSubmit }) {
  const [f,setF]=useState({type:"reimburse",purpose:"",destination:"Jakarta",dateStart:"",dateEnd:"",approverName:"",notes:"",items:[{cat:"Perjalanan Dinas",amt:""}]});
  const [busy,setBusy]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const si=(i,k,v)=>setF(p=>{const it=[...p.items];it[i]={...it[i],[k]:v};return{...p,items:it};});
  const total=f.items.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);
  const submit=async()=>{
    if(!f.purpose||!f.dateStart||!f.dateEnd||!f.approverName||total===0){alert("Harap lengkapi semua field wajib (*)");return;}
    setBusy(true);
    const entry={id:gid(),type:f.type,submitter:user.name,email:user.email,dept:user.dept,purpose:f.purpose,destination:f.destination,dateStart:f.dateStart,dateEnd:f.dateEnd,amount:total,status:"pending",submitted:today(),categories:f.items.map(it=>({cat:it.cat,amt:parseFloat(it.amt)||0})),notes:f.notes,settled:false,settledDate:null,approverName:f.approverName,financeNote:""};
    if(!CONFIG.DEMO_MODE) await API.create(entry);
    else await new Promise(r=>setTimeout(r,500));
    setBusy(false);
    onSubmit(entry);
  };
  return (
    <div>
      <div className="card">
        <div className="ch"><div><h3>Form Pengajuan Reimburse / Cash Advance</h3><p style={{fontSize:11,color:"var(--ink3)",marginTop:3}}>Field bertanda <span style={{color:"var(--rd)"}}>*</span> wajib diisi</p></div></div>
        <div className="cb">
          {/* TIPE */}
          <div className="fs mb4">
            <div className="fst">Jenis Pengajuan</div>
            <div style={{display:"flex",gap:9}}>
              {[["reimburse","💰 Reimburse","Klaim setelah trip"],["cash_advance","🏦 Cash Advance","Ambil dana sebelum trip"]].map(([v,l,s])=>(
                <label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:9,padding:"11px 14px",borderRadius:"var(--r2)",border:`2px solid ${f.type===v?"var(--tl)":"var(--ln)"}`,background:f.type===v?"var(--tl-bg)":"var(--white)",cursor:"pointer",margin:0}}>
                  <input type="radio" name="tp" checked={f.type===v} onChange={()=>set("type",v)} style={{width:"auto",accentColor:"var(--tl)"}}/>
                  <div><div style={{fontSize:13,fontWeight:700}}>{l}</div><div style={{fontSize:11,color:"var(--ink3)"}}>{s}</div></div>
                </label>
              ))}
            </div>
            {f.type==="cash_advance"&&<div className="al aw mt3"><Ic n="clock" s={13} c="#d97706"/><span>CA wajib diselesaikan <strong>maks. 5 hari kerja</strong> setelah perjalanan selesai.</span></div>}
          </div>
          {/* DETAIL */}
          <div className="fs mb4">
            <div className="fst">Detail Perjalanan</div>
            <div className="fg mb3"><label className="fl">Keperluan / Tujuan <span className="rq">*</span></label><textarea value={f.purpose} onChange={e=>set("purpose",e.target.value)} placeholder="Jelaskan tujuan perjalanan..." rows={2}/></div>
            <div className="fg fg3">
              <div><label className="fl">Kota Tujuan <span className="rq">*</span></label><input value={f.destination} onChange={e=>set("destination",e.target.value)}/></div>
              <div><label className="fl">Tanggal Mulai <span className="rq">*</span></label><input type="date" value={f.dateStart} onChange={e=>set("dateStart",e.target.value)}/></div>
              <div><label className="fl">Tanggal Selesai <span className="rq">*</span></label><input type="date" value={f.dateEnd} onChange={e=>set("dateEnd",e.target.value)}/></div>
            </div>
          </div>
          {/* BIAYA */}
          <div className="fs mb4">
            <div className="fst">Rincian Biaya</div>
            {f.items.map((it,i)=>(
              <div key={i} style={{display:"flex",gap:9,alignItems:"flex-end",marginBottom:9}}>
                <div style={{flex:2}}>{i===0&&<label className="fl">Kategori <span className="rq">*</span></label>}<select value={it.cat} onChange={e=>si(i,"cat",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
                <div style={{flex:1.5}}>{i===0&&<label className="fl">Nominal (Rp) <span className="rq">*</span></label>}<input type="number" value={it.amt} onChange={e=>si(i,"amt",e.target.value)} placeholder="0" min="0"/></div>
                {f.items.length>1&&<button className="btn btn-o xs" onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{color:"var(--rd)",borderColor:"#fca5a5",flexShrink:0}}><Ic n="trash" s={12}/></button>}
              </div>
            ))}
            <button className="btn btn-o sm" onClick={()=>setF(p=>({...p,items:[...p.items,{cat:"Perjalanan Dinas",amt:""}]}))}><Ic n="plus" s={12}/>Tambah Item</button>
            {total>0&&<div style={{marginTop:12,padding:"10px 14px",background:"var(--tl-bg)",border:"1px solid var(--tl-bd)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,color:"var(--tl)"}}>Total Pengajuan</span><span style={{fontWeight:800,fontSize:16,color:"var(--tl)"}}>{rp(total)}</span></div>}
          </div>
          {/* ATASAN */}
          <div className="fs mb4">
            <div className="fst">Nama Atasan</div>
            <input value={f.approverName} onChange={e=>set("approverName",e.target.value)} placeholder="Nama lengkap atasan langsung *"/>
          </div>
          <div className="fs mb4">
            <div className="fst">Catatan (Opsional)</div>
            <textarea value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Catatan tambahan untuk Finance..." rows={2}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:9}}>
            <button className="btn btn-o" onClick={()=>setF({type:"reimburse",purpose:"",destination:"Jakarta",dateStart:"",dateEnd:"",approverName:"",notes:"",items:[{cat:"Perjalanan Dinas",amt:""}]})}>Reset</button>
            <button className="btn btn-p" onClick={submit} disabled={busy}>{busy?<span className="sp"/>:<Ic n="send" s={13}/>}{busy?"Menyimpan...":"Submit Pengajuan"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListPage({ data, user, onSel }) {
  const [q,setQ]=useState(""); const [st,setSt]=useState(""); const [tp,setTp]=useState("");
  const base=user.role==="finance"?data:data.filter(d=>d.submitter===user.name||d.approverName===user.name);
  const rows=base.filter(d=>(!st||d.status===st)&&(!tp||d.type===tp)&&(!q||(d.purpose+d.id+d.submitter+d.destination).toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <div className="card mb4" style={{padding:"11px 16px"}}>
        <div className="flt">
          <input placeholder="Cari ID, nama, keperluan..." value={q} onChange={e=>setQ(e.target.value)} style={{flex:2}}/>
          <select value={st} onChange={e=>setSt(e.target.value)}><option value="">Semua Status</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          <select value={tp} onChange={e=>setTp(e.target.value)}><option value="">Semua Jenis</option><option value="reimburse">Reimburse</option><option value="cash_advance">Cash Advance</option></select>
          {(q||st||tp)&&<button className="btn btn-o sm" onClick={()=>{setQ("");setSt("");setTp("");}}><Ic n="x" s={12}/>Reset</button>}
        </div>
      </div>
      <div className="card">
        <div className="ch"><h3>Daftar Pengajuan <span style={{fontSize:12,color:"var(--ink4)",fontWeight:400}}>({rows.length})</span></h3></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Jenis</th><th>Keperluan</th><th>Kota</th><th>Periode</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>{rows.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--ink3)"}}>{d.dept}</div></td>
              <td><TTag t={d.type}/></td>
              <td><div className="trunc" style={{maxWidth:160,fontSize:13}}>{d.purpose}</div></td>
              <td style={{fontSize:12,color:"var(--ink3)"}}>{d.destination}</td>
              <td style={{fontSize:11,color:"var(--ink3)"}}>{fd(d.dateStart)}<br/>{fd(d.dateEnd)}</td>
              <td className="bold">{rp(d.amount)}</td>
              <td><SBadge s={d.status}/></td>
            </tr>
          ))}</tbody>
        </table>
        {rows.length===0&&<div className="empty"><Ic n="list" s={36}/><p style={{marginTop:10}}>Tidak ada data</p></div>}
        </div>
      </div>
    </div>
  );
}

function ApprovalPage({ data, onAction }) {
  const queue=data.filter(d=>d.status==="pending");
  return (
    <div>
      {queue.length>0&&<div className="al aw mb4"><Ic n="clock" s={14} c="#d97706"/><span><strong>{queue.length} pengajuan</strong> menunggu persetujuan Anda.</span></div>}
      <div className="card">
        <div className="ch"><h3>Antrian Approval</h3></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Periode</th><th>Jumlah</th><th>Diajukan</th><th>Aksi</th></tr></thead>
          <tbody>{queue.map(d=>(
            <tr key={d.id}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--ink3)"}}>{d.dept}</div></td>
              <td><div className="trunc" style={{maxWidth:150}}>{d.purpose}</div></td>
              <td style={{fontSize:11,color:"var(--ink3)"}}>{fd(d.dateStart)}<br/>{fd(d.dateEnd)}</td>
              <td className="bold">{rp(d.amount)}</td>
              <td style={{fontSize:11,color:"var(--ink3)"}}>{fd(d.submitted)}</td>
              <td onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",gap:5}}>
                  <button className="btn btn-g xs" onClick={()=>onAction(d.id,"approve","Disetujui")}><Ic n="check" s={11}/>Setuju</button>
                  <button className="btn btn-r xs" onClick={()=>onAction(d.id,"reject","Ditolak")}><Ic n="x" s={11}/>Tolak</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {queue.length===0&&<div className="empty"><Ic n="check" s={36}/><p style={{marginTop:10}}>Tidak ada antrian 🎉</p></div>}
        </div>
      </div>
    </div>
  );
}

function MonitorPage({ data, onSel }) {
  const totalRp=data.reduce((a,d)=>a+d.amount,0);
  const paidRp=data.filter(d=>d.status==="paid").reduce((a,d)=>a+d.amount,0);
  const pct=totalRp?Math.round(paidRp/totalRp*100):0;
  const overdue=data.filter(d=>d.status==="overdue");
  const caOut=data.filter(d=>d.type==="cash_advance"&&!d.settled&&!["rejected","draft"].includes(d.status));
  return (
    <div>
      {overdue.length>0&&<div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><div><strong>{overdue.length} CA Terlambat:</strong>{overdue.map(d=><div key={d.id} style={{marginTop:3,fontSize:11.5}}>• {d.id} – {d.submitter} ({d.dept}) – selesai {fd(d.dateEnd)}</div>)}</div></div>}
      <div className="sg mb5">
        <div className="st tl"><div className="sl">Total Diajukan</div><div className="sv md">{rp(totalRp)}</div><div className="ss">{data.length} pengajuan</div></div>
        <div className="st gn"><div className="sl">Sudah Dibayar</div><div className="sv md">{rp(paidRp)}</div><div className="pb"><div className="pbf" style={{width:`${pct}%`,background:"var(--gn)"}}/></div><div className="ss">{pct}% dari total</div></div>
        {Object.entries(STATUS).filter(([k])=>data.some(d=>d.status===k)).map(([k,v])=>(
          <div key={k} className="st" style={{borderLeft:`3px solid ${v.dot}`}}>
            <div className="sl">{v.label}</div><div className="sv">{data.filter(d=>d.status===k).length}</div>
          </div>
        ))}
      </div>
      <div className="g2">
        <div className="card">
          <div className="ch"><h3>Perlu Ditindak</h3></div>
          <div className="tw"><table>
            <thead><tr><th>ID</th><th>Pemohon</th><th>Jumlah</th><th>Status</th></tr></thead>
            <tbody>{data.filter(d=>["approved","processing"].includes(d.status)).map(d=>(
              <tr key={d.id} onClick={()=>onSel(d.id)}>
                <td><span className="mono">{d.id}</span></td>
                <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--ink3)"}}>{d.dept}</div></td>
                <td className="bold">{rp(d.amount)}</td>
                <td><SBadge s={d.status}/></td>
              </tr>
            ))}</tbody>
          </table>
          {!data.some(d=>["approved","processing"].includes(d.status))&&<div className="empty" style={{padding:"22px 0"}}><p>Tidak ada yang perlu ditindak 🎉</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="ch"><h3>CA Outstanding ({caOut.length})</h3></div>
          <div style={{maxHeight:360,overflowY:"auto"}}>
            {caOut.map(d=>(
              <div key={d.id} style={{padding:"11px 16px",borderBottom:"1px solid var(--ln)",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={()=>onSel(d.id)}>
                <div><span className="mono">{d.id}</span><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--ink3)"}}>Selesai: {fd(d.dateEnd)}</div></div>
                <div style={{textAlign:"right"}}><div className="bold">{rp(d.amount)}</div><SBadge s={d.status}/></div>
              </div>
            ))}
            {caOut.length===0&&<div className="empty" style={{padding:"22px 0"}}><p>Semua CA sudah settle 🎉</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverduePage({ data, onSel }) {
  const list=data.filter(d=>d.type==="cash_advance"&&!d.settled&&!["rejected","draft"].includes(d.status));
  return (
    <div>
      <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><strong>CA Outstanding = Cash Advance belum diselesaikan. SLA: maks 5 hari kerja setelah trip selesai.</strong></div>
      <div className="card">
        <div className="ch"><h3>CA Belum Selesai ({list.length})</h3></div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Trip Selesai</th><th>Keterlambatan</th><th>Jumlah</th><th>Status</th></tr></thead>
          <tbody>{list.map(d=>{
            const late=Math.max(0,diff(d.dateEnd,today())-5);
            return(<tr key={d.id} onClick={()=>onSel(d.id)}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--ink3)"}}>{d.dept}</div></td>
              <td><div className="trunc" style={{maxWidth:140}}>{d.purpose}</div></td>
              <td style={{fontSize:12}}>{fd(d.dateEnd)}</td>
              <td>{late>0?<span style={{fontWeight:800,color:"var(--rd)",fontSize:12}}>+{late} hari</span>:<span style={{color:"var(--am)",fontWeight:700,fontSize:12}}>Dalam batas</span>}</td>
              <td className="bold">{rp(d.amount)}</td>
              <td><SBadge s={d.status}/></td>
            </tr>);
          })}</tbody>
        </table>
        {list.length===0&&<div className="empty"><Ic n="check" s={36}/><p style={{marginTop:10}}>Semua CA sudah settlement 🎉</p></div>}
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ onSave }) {
  const [url,setUrl]=useState(CONFIG.SCRIPT_URL);
  const [saved,setSaved]=useState(false);
  const [copied,setCopied]=useState(false);
  const save=()=>{CONFIG.SCRIPT_URL=url;CONFIG.DEMO_MODE=!url.trim();setSaved(true);setTimeout(()=>setSaved(false),2500);if(onSave)onSave();};
  const copy=()=>{navigator.clipboard?.writeText(SCRIPT).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};
  return (
    <div>
      <div className="al ab mb4"><Ic n="link" s={14} c="#2563eb"/><div><strong>Koneksi ke Google Sheets</strong><br/><span style={{fontSize:12}}>Isi URL Apps Script di bawah agar data tersimpan permanen. Panduan lengkap ada di <strong>Panduan_Setup_Google_Sheets.docx</strong>.</span></div></div>
      <div className="card mb4">
        <div className="ch"><h3>Konfigurasi</h3></div>
        <div className="cb">
          <div className="fg mb4">
            <label className="fl">Apps Script Web App URL <span className="rq">*</span></label>
            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/xxxxx/exec"/>
            <p style={{fontSize:11,color:"var(--ink3)",marginTop:4}}>Dari: Google Sheets → Extensions → Apps Script → Deploy → Manage deployments → salin URL-nya</p>
          </div>
          <div style={{padding:"11px 14px",background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)",marginBottom:14}}>
            <p style={{fontSize:11,fontWeight:700,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Status Koneksi</p>
            {CONFIG.DEMO_MODE
              ? <span style={{color:"var(--am)",fontWeight:700,fontSize:13}}>⚠️ Mode Demo — data tidak tersimpan ke Sheets</span>
              : <span style={{color:"var(--gn)",fontWeight:700,fontSize:13}}>✓ Terhubung ke Google Sheets</span>
            }
          </div>
          <div style={{display:"flex",gap:9,justifyContent:"flex-end",alignItems:"center"}}>
            {saved&&<span style={{color:"var(--gn)",fontWeight:700,fontSize:13}}>✓ Tersimpan!</span>}
            <button className="btn btn-p" onClick={save}><Ic n="check" s={13}/>Simpan & Aktifkan</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="ch"><h3>Kode Google Apps Script</h3><button className="btn btn-o sm" onClick={copy}><Ic n="copy" s={12}/>{copied?"Tersalin!":"Copy Kode"}</button></div>
        <div className="cb">
          <p style={{fontSize:12,color:"var(--ink3)",marginBottom:12}}>Copy kode ini → buka <strong>script.google.com</strong> → paste → deploy sebagai Web App.</p>
          <div className="code-block"><pre>{SCRIPT}</pre></div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function DetailModal({ trx, user, onClose, onAction }) {
  const [note,setNote]=useState(""); const [busy,setBusy]=useState(false);
  const isApp=user.role==="approver"; const isFin=user.role==="finance";
  const act=async(action,n)=>{
    setBusy(true);
    if(!CONFIG.DEMO_MODE){const map={approve:"approved",reject:"rejected",process:"processing",pay:"paid"};await API.updateStatus(trx.id,map[action],n);}
    else await new Promise(r=>setTimeout(r,450));
    setBusy(false); onAction(trx.id,action,n);
  };
  const settle=async()=>{
    setBusy(true);
    if(!CONFIG.DEMO_MODE) await API.settle(trx.id,note);
    else await new Promise(r=>setTimeout(r,450));
    setBusy(false); onAction(trx.id,"settle",note);
  };
  const tl=[
    {ok:true,icon:"send",title:"Pengajuan Dikirim",sub:`${trx.submitter} · ${fd(trx.submitted)}`,col:"var(--tl)"},
    {ok:!["pending","draft"].includes(trx.status),icon:"user",title:"Approval Atasan",sub:trx.status==="pending"?"Menunggu…":trx.approverName,col:trx.status==="pending"?"var(--am)":"var(--gn)"},
    {ok:["processing","paid"].includes(trx.status),icon:"money",title:"Diproses Finance",sub:trx.status==="processing"?"Sedang diproses…":trx.status==="paid"?"Selesai":"Belum",col:trx.status==="paid"?"var(--gn)":"var(--ink4)"},
    {ok:trx.status==="paid",icon:"check",title:"Pembayaran",sub:trx.status==="paid"?`Dibayar · ${fd(trx.settledDate)}`:"Menunggu",col:trx.status==="paid"?"var(--gn)":"var(--ink4)"},
  ];
  const daysLate=trx.status==="overdue"?Math.max(0,diff(trx.dateEnd,today())-5):0;
  return (
    <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mo">
        <div className="mh">
          <div style={{flex:1}}>
            <span className="mono">{trx.id}</span>
            <h2 style={{fontSize:15,fontWeight:800,marginTop:3,letterSpacing:"-.01em"}}>{trx.purpose}</h2>
          </div>
          <button className="btn btn-o sm" onClick={onClose}><Ic n="x" s={13}/></button>
        </div>
        <div className="mb">
          {/* status bar */}
          <div style={{display:"flex",flexWrap:"wrap",gap:7,alignItems:"center",padding:"9px 13px",background:"var(--ln2)",borderRadius:"var(--r2)",marginBottom:16}}>
            <TTag t={trx.type}/><SBadge s={trx.status}/>
            {daysLate>0&&<span style={{fontSize:12,fontWeight:800,color:"var(--rd)"}}>Terlambat {daysLate} hari!</span>}
            <span style={{marginLeft:"auto",fontSize:11,color:"var(--ink3)"}}>Diajukan {fd(trx.submitted)}</span>
          </div>
          {trx.status==="rejected"&&trx.financeNote&&<div className="al ae mb4"><Ic n="x" s={13} c="#dc2626"/><span><strong>Alasan penolakan:</strong> {trx.financeNote}</span></div>}
          {trx.financeNote&&trx.status!=="rejected"&&<div className="al ab mb4"><Ic n="bell" s={13} c="#2563eb"/><span>{trx.financeNote}</span></div>}
          <div className="g2 mb4">
            <div>
              <p style={{fontSize:10.5,fontWeight:800,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>Pemohon</p>
              <p className="bold">{trx.submitter}</p><p style={{fontSize:12,color:"var(--ink3)"}}>{trx.dept}</p>
              <p style={{fontSize:12,color:"var(--ink3)",marginTop:4}}>Atasan: {trx.approverName}</p>
            </div>
            <div>
              <p style={{fontSize:10.5,fontWeight:800,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>Perjalanan</p>
              <p className="bold">{trx.destination}</p><p style={{fontSize:12,color:"var(--ink3)"}}>{fd(trx.dateStart)} – {fd(trx.dateEnd)}</p>
              {trx.type==="cash_advance"&&<p style={{fontSize:12,fontWeight:700,marginTop:4,color:trx.settled?"var(--gn)":"var(--am)"}}>Settlement: {trx.settled?`✓ ${fd(trx.settledDate)}`:"Belum"}</p>}
            </div>
          </div>
          {/* rincian */}
          <div style={{border:"1px solid var(--ln)",borderRadius:"var(--r2)",overflow:"hidden",marginBottom:16}}>
            <div style={{background:"var(--ln2)",padding:"8px 14px",fontSize:10.5,fontWeight:800,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:".06em"}}>Rincian Biaya</div>
            {trx.categories.map((c,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 14px",borderBottom:i<trx.categories.length-1?"1px solid var(--ln)":"none",fontSize:13}}>
                <span>{c.cat}</span><span className="bold">{rp(c.amt)}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",background:"var(--tl-bg)",borderTop:"2px solid var(--tl)"}}>
              <span style={{fontWeight:800,color:"var(--tl)"}}>TOTAL</span>
              <span style={{fontWeight:800,fontSize:16,color:"var(--tl)"}}>{rp(trx.amount)}</span>
            </div>
          </div>
          {trx.notes&&<div className="al at mb4"><Ic n="bell" s={13} c="var(--tl)"/><span>{trx.notes}</span></div>}
          {/* timeline */}
          <p style={{fontSize:10.5,fontWeight:800,color:"var(--ink3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:11}}>Progress Status</p>
          <div>{tl.map((t,i)=>(
            <div key={i} className="tl-row">
              <div className="tl-dc">
                <div className="tl-d" style={{background:t.ok?t.col:"var(--ln)"}}><Ic n={t.icon} s={12} c={t.ok?"#fff":"var(--ink4)"}/></div>
                {i<tl.length-1&&<div className="tl-ln"/>}
              </div>
              <div className="tl-b">
                <div className="tl-t" style={{color:t.ok?"var(--ink)":"var(--ink4)"}}>{t.title}</div>
                <div className="tl-s">{t.sub}</div>
              </div>
            </div>
          ))}</div>
          {/* actions */}
          {isApp&&trx.status==="pending"&&(
            <div style={{marginTop:16,padding:14,background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
              <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>Tindakan Approval</p>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan (opsional)..." rows={2} style={{marginBottom:9}}/>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-g" onClick={()=>act("approve",note||"Disetujui")} disabled={busy}>{busy?<span className="sp"/>:<Ic n="check" s={13}/>}Setujui</button>
                <button className="btn btn-r" onClick={()=>act("reject",note||"Ditolak")} disabled={busy}><Ic n="x" s={13}/>Tolak</button>
              </div>
            </div>
          )}
          {isFin&&trx.status==="approved"&&(
            <div style={{marginTop:16,padding:14,background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
              <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>Mulai Proses Pembayaran</p>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan Finance..." rows={2} style={{marginBottom:9}}/>
              <button className="btn btn-p" onClick={()=>act("process",note)} disabled={busy}>{busy?<span className="sp"/>:<Ic n="money" s={13}/>}Mulai Proses</button>
            </div>
          )}
          {isFin&&trx.status==="processing"&&(
            <div style={{marginTop:16,padding:14,background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
              <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>Konfirmasi Pembayaran</p>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="No. referensi transfer..." rows={2} style={{marginBottom:9}}/>
              <button className="btn btn-g" onClick={()=>act("pay",note)} disabled={busy}>{busy?<span className="sp"/>:<Ic n="check" s={13}/>}Tandai Sudah Dibayar</button>
            </div>
          )}
          {isFin&&trx.status==="paid"&&trx.type==="cash_advance"&&!trx.settled&&(
            <div style={{marginTop:16,padding:14,background:"var(--am-bg)",borderRadius:"var(--r2)",border:"1px solid var(--am-bd)"}}>
              <p style={{fontSize:13,fontWeight:700,marginBottom:4,color:"#78350f"}}>⚠️ CA Belum Diselesaikan</p>
              <p style={{fontSize:12,color:"#78350f",marginBottom:9}}>Konfirmasi setelah pemohon menyerahkan bukti/kembalikan sisa dana.</p>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan settlement..." rows={2} style={{marginBottom:9}}/>
              <button className="btn btn-g" onClick={settle} disabled={busy}>{busy?<span className="sp"/>:<Ic n="check" s={13}/>}Konfirmasi Settlement</button>
            </div>
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
  const [user,setUser]     = useState(USERS.employee);
  const [page,setPage]     = useState("dashboard");
  const [data,setData]     = useState(DEMO_DATA);
  const [selId,setSelId]   = useState(null);
  const [toast,setToast]   = useState(null);
  const [loading,setLoading]=useState(false);
  const [sideOpen,setSideOpen]=useState(false);

  useEffect(()=>{
    if(!CONFIG.DEMO_MODE&&CONFIG.SCRIPT_URL){
      setLoading(true);
      API.getAll().then(res=>{ if(res?.data) setData(res.data); setLoading(false); });
    }
  },[]);

  const showToast=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  const handleAction=(id,action,note)=>{
    setData(prev=>prev.map(d=>{
      if(d.id!==id) return d;
      const m={approve:{status:"approved"},reject:{status:"rejected",financeNote:note},process:{status:"processing",financeNote:note},pay:{status:"paid",settledDate:today(),financeNote:note},settle:{settled:true,settledDate:today(),financeNote:note}};
      return{...d,...m[action]};
    }));
    const msgs={approve:"✓ Pengajuan disetujui",reject:"Pengajuan ditolak",process:"✓ Mulai diproses",pay:"✓ Pembayaran dikonfirmasi",settle:"✓ CA settlement dikonfirmasi"};
    showToast(msgs[action]||"Berhasil");
    setSelId(null);
  };

  const handleSubmit=(entry)=>{setData(p=>[entry,...p]);showToast(`✓ ${entry.id} berhasil dikirim`);setPage("list");};

  const nav=(p,id)=>{if(id)setSelId(id);setPage(p);setSideOpen(false);};

  const pCt=data.filter(d=>d.status==="pending").length;
  const aCt=data.filter(d=>d.status==="approved").length;
  const oCt=data.filter(d=>d.status==="overdue").length;
  const sel=data.find(d=>d.id===selId);

  const NAV={
    employee:[{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"submit",ic:"plus",lb:"Ajukan Baru"},{id:"list",ic:"list",lb:"Pengajuan Saya"}],
    approver:[{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"approval",ic:"check",lb:"Antrian Approval",bd:pCt},{id:"list",ic:"list",lb:"Semua Pengajuan"}],
    finance: [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"monitor",ic:"chart",lb:"Monitor Finance",bd:aCt||null},{id:"list",ic:"list",lb:"Semua Pengajuan"},{id:"overdue",ic:"alert",lb:"CA Outstanding",bd:oCt||null},{id:"settings",ic:"settings",lb:"Koneksi Sheets"}],
  };
  const TITLES={dashboard:"Dashboard",submit:"Form Pengajuan",list:"Daftar Pengajuan",approval:"Antrian Approval",monitor:"Monitor Finance",overdue:"CA Outstanding",settings:"Koneksi Google Sheets"};

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* overlay close sidebar on mobile */}
        {sideOpen&&<div style={{position:"fixed",inset:0,zIndex:199,background:"rgba(0,0,0,.4)"}} onClick={()=>setSideOpen(false)}/>}

        {/* SIDEBAR */}
        <div className={`sb${sideOpen?" open":""}`}>
          <div className="sb-logo">
            <div className="sb-logo-h">ReimburseApp</div>
            <div className="sb-logo-s">Finance System 2026</div>
          </div>
          <div className="sb-user">
            <div className="av">{user.avatar}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="sb-uname">{user.name}</div>
              <div className="sb-urole">{user.role}</div>
            </div>
          </div>
          <nav className="sb-nav">
            <div className="nv-sec">Menu</div>
            {(NAV[user.role]||[]).map(item=>(
              <div key={item.id} className={`nv${page===item.id?" on":""}`} onClick={()=>nav(item.id)}>
                <Ic n={item.ic} s={14}/><span style={{flex:1}}>{item.lb}</span>
                {item.bd>0&&<span className="nb">{item.bd}</span>}
              </div>
            ))}
          </nav>
          <div className="sb-foot">
            <div className="demo-box">
              <div className="demo-lbl">Ganti Role <span className="demo-badge">Demo</span></div>
              {Object.values(USERS).map(u=>(
                <button key={u.role} className={`rb${user.role===u.role?" on":""}`} onClick={()=>{setUser(u);setPage("dashboard");setSideOpen(false);}}>
                  {u.role==="employee"?"👤 Karyawan":u.role==="approver"?"✅ Approver / Atasan":"💼 Finance"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="main">
          <div className="bar">
            <button className="btn btn-o sm" style={{display:"flex"}} onClick={()=>setSideOpen(o=>!o)}><Ic n="menu" s={15}/></button>
            <h1 className="bar-title">{TITLES[page]||"Dashboard"}</h1>
            <div className="bar-right">
              <span className={`conn ${CONFIG.DEMO_MODE?"conn-demo":"conn-live"}`}>
                <span style={{width:6,height:6,borderRadius:"50%",background:CONFIG.DEMO_MODE?"var(--am)":"var(--gn)",display:"inline-block"}}/>
                {CONFIG.DEMO_MODE?"Mode Demo":"Sheets ✓"}
              </span>
              {user.role==="employee"&&page!=="submit"&&<button className="btn btn-p sm" onClick={()=>nav("submit")}><Ic n="plus" s={13}/>Ajukan</button>}
              {!CONFIG.DEMO_MODE&&<button className="btn btn-o sm" onClick={()=>{setLoading(true);API.getAll().then(r=>{if(r?.data)setData(r.data);setLoading(false);});}}><Ic n="refresh" s={13}/></button>}
            </div>
          </div>

          <div className="page">
            {loading?(
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:280,gap:12,color:"var(--ink3)"}}>
                <div style={{width:22,height:22,border:"3px solid var(--ln)",borderTopColor:"var(--tl)",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>
                <span>Memuat data dari Google Sheets...</span>
              </div>
            ):(
              <>
                {page==="dashboard"&&<DashboardPage data={data} user={user} nav={nav}/>}
                {page==="submit"&&<SubmitPage user={user} onSubmit={handleSubmit}/>}
                {page==="list"&&<ListPage data={data} user={user} onSel={id=>setSelId(id)}/>}
                {page==="approval"&&<ApprovalPage data={data} onAction={handleAction}/>}
                {page==="monitor"&&<MonitorPage data={data} onSel={id=>setSelId(id)}/>}
                {page==="overdue"&&<OverduePage data={data} onSel={id=>setSelId(id)}/>}
                {page==="settings"&&<SettingsPage onSave={()=>showToast("✓ Konfigurasi disimpan")}/>}
              </>
            )}
          </div>
        </div>
      </div>

      {sel&&<DetailModal trx={sel} user={user} onClose={()=>setSelId(null)} onAction={handleAction}/>}

      {toast&&(
        <div className="toast" style={{background:toast.type==="err"?"var(--rd)":"var(--ink)"}}>
          <Ic n={toast.type==="err"?"x":"check"} s={13}/>{toast.msg}
        </div>
      )}
    </>
  );
}
