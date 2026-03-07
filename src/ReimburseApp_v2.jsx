import { useState } from "react";

// ═══════════════════════════════════════════════════════════════
// ⚙️  KONFIGURASI — GANTI SESUAI KEBUTUHAN
// ═══════════════════════════════════════════════════════════════
// ── Persist CONFIG ke localStorage ──────────────────────────
const LS_CONFIG = "reimburse_config_v3";
const _loadConfig = () => { try { return JSON.parse(localStorage.getItem(LS_CONFIG)||"{}"); } catch { return {}; } };
const _saveConfig = (obj) => { try { localStorage.setItem(LS_CONFIG, JSON.stringify(obj)); } catch {} };
const _cfg = _loadConfig();

const CONFIG = {
  SCRIPT_URL:    _cfg.SCRIPT_URL    || "https://script.google.com/macros/s/AKfycbzF85jBC3pVY9t7geZiXvVB4tNMY_XzEEQjc84x6-D144lWgLgciY8kcFFkc1fe9IWq7g/exec",
  PASS_APPROVER: _cfg.PASS_APPROVER || "approver123",
  PASS_FINANCE:  _cfg.PASS_FINANCE  || "finance123",
};

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DEPTS = ["Marketing","Sales Dealer","Sales MO","Sales RO","RDC","Collection","Procurement","IT","Finance","GA","HR","Lainnya"];
const CATS  = ["Perjalanan Dinas","Akomodasi / Hotel","Makan & Entertainment","Transportasi","Uang Saku","Komunikasi","Lain-lain"];
const STATUS = {
  pending:           { label:"Menunggu Approval",    color:"#92400e", bg:"#fffbeb", dot:"#f59e0b" },
  approved:          { label:"Disetujui",             color:"#1e40af", bg:"#eff6ff", dot:"#3b82f6" },
  processing:        { label:"Diproses Finance",     color:"#5b21b6", bg:"#f5f3ff", dot:"#8b5cf6" },
  paid:              { label:"CA Dicairkan",          color:"#065f46", bg:"#ecfdf5", dot:"#10b981" },
  awaiting_oer:      { label:"Menunggu OER",          color:"#854d0e", bg:"#fef9c3", dot:"#ca8a04" },
  kurang_bayar:      { label:"Kurang Bayar ↑",        color:"#1e3a5f", bg:"#dbeafe", dot:"#3b82f6" },
  lebih_bayar:       { label:"Lebih Bayar ↓",         color:"#4c1d95", bg:"#ede9fe", dot:"#8b5cf6" },
  settled:           { label:"Lunas ✓",               color:"#065f46", bg:"#ecfdf5", dot:"#10b981" },
  rejected:          { label:"Ditolak",               color:"#991b1b", bg:"#fef2f2", dot:"#ef4444" },
  overdue:           { label:"CA Terlambat ⚠️",      color:"#9f1239", bg:"#fff1f2", dot:"#e11d48" },
};
// OER categories matching real form
const OER_CATS = [
  "Plane Fare","Akomodasi / Hotel","Car Rental / Bensin / Tol",
  "Taxi / Bus / Kereta","Telepon / Komunikasi","Makan (dengan tamu)",
  "Meal Allowance","Uang Saku","Airport Tax","Lain-lain"
];
const DEMO = [];

// ID generator: timestamp-based, no counter, no duplicates across sessions
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
const today = () => new Date().toISOString().split("T")[0];
const ddiff = (a,b) => Math.round((new Date(b)-new Date(a))/864e5);
// Rekonsiliasi CA vs OER
const recon = (trx) => {
  if (trx.type !== "cash_advance") return null;
  const ca  = trx.amount || 0;
  const oer = trx.oerAmount || 0;
  if (!oer) return null;
  const selisih = oer - ca; // positif = kurang bayar, negatif = lebih bayar
  return { ca, oer, selisih, isKurang: selisih > 0, isLebih: selisih < 0, isLunas: selisih === 0 };
};
// Hitung hari kerja sejak tanggal selesai trip
const workdaysSinceEnd = (dateEnd) => {
  if (!dateEnd) return 0;
  const end = new Date(dateEnd); end.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  let days = 0, cur = new Date(end);
  cur.setDate(cur.getDate()+1); // mulai hari setelah trip selesai
  while (cur <= now) {
    const dow = cur.getDay();
    if (dow!==0 && dow!==6) days++;
    cur.setDate(cur.getDate()+1);
  }
  return days;
};
const isOverdue = (d) => {
  if (d.type==="cash_advance" && !d.settled && !["rejected","paid"].includes(d.status) && d.dateEnd) {
    return workdaysSinceEnd(d.dateEnd) > 5;
  }
  // OER (reimburse) juga 5 hari kerja setelah trip
  if (d.type==="reimburse" && d.status==="pending" && d.dateEnd) {
    return workdaysSinceEnd(d.dateEnd) > 5;
  }
  return false;
};

// ── Sheets API ───────────────────────────────────────────────
const API = {
  async post(action, extra={}) {
    if (!CONFIG.SCRIPT_URL) return null;
    try {
      const body = JSON.stringify({ action, ...extra });
      const r = await fetch(CONFIG.SCRIPT_URL, {
        method:"POST",
        redirect:"follow",
        body,
      });
      const txt = await r.text();
      try { return JSON.parse(txt); }
      catch { console.error("Apps Script response:", txt); return null; }
    } catch(e) { console.error("fetch error:", e); return null; }
  },
  getAll:      ()       => API.post("getAll"),
  create:      (data)   => API.post("create",       { data }),
  update:      (id,s,n) => API.post("updateStatus", { id, status:s, note:n }),
  settle:      (id,n)   => API.post("settle",       { id, note:n }),
  submitOer:   (id,d)   => API.post("submitOer",    { id, data:d }),
  registerAcc: (acc)    => API.post("registerAcc",  { acc }),
  loginAcc:    (u,p)    => API.post("loginAcc",     { username:u, password:p }),
  editData:    (id,d)   => API.post("editData",     { id, data:d }),
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
  settings:"M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
};
const Ic = ({ n, s=16, c="currentColor" }) => (
  <svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={IP[n]||""}/></svg>
);
const SBadge = ({ s }) => { const c=STATUS[s]||{label:s,color:"#475569",bg:"#f1f5f9"}; return <span className="badge" style={{color:c.color,background:c.bg}}>{c.label}</span>; };
const TTag = ({ t }) => t==="cash_advance"?<span className="tag tca">Cash Advance</span>:<span className="tag tre">Reimburse</span>;

// ── Local account store (localStorage fallback) ──────────────
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
  const [tab,setTab]     = useState("karyawan"); // karyawan | staff
  const [mode,setMode]   = useState("login");    // login | register (karyawan only)

  // shared fields
  const [err,setErr]     = useState("");
  const [show,setShow]   = useState(false);
  const [show2,setShow2] = useState(false);

  // karyawan login fields
  const [username,setUsername] = useState("");
  const [pass,setPass]         = useState("");

  // karyawan register fields
  const [regName,setRegName]   = useState("");
  const [regDept,setRegDept]   = useState("");
  const [regUser,setRegUser]   = useState("");
  const [regPass,setRegPass]   = useState("");
  const [regPass2,setRegPass2] = useState("");

  // staff fields
  const [role,setRole]         = useState("approver");
  const [staffPass,setStaffPass]=useState("");

  const clr = () => setErr("");

  const [busy2,setBusy2] = useState(false);

  // ── Register karyawan (Sheets + localStorage fallback) ────
  const doRegister = async () => {
    if (!regName.trim())       return setErr("Nama tidak boleh kosong");
    if (!regDept)              return setErr("Pilih departemen dulu");
    if (!regUser.trim())       return setErr("Username tidak boleh kosong");
    if (regUser.includes(" ")) return setErr("Username tidak boleh mengandung spasi");
    if (regPass.length < 4)    return setErr("Password minimal 4 karakter");
    if (regPass !== regPass2)  return setErr("Konfirmasi password tidak cocok");
    const ukey = regUser.toLowerCase().trim();
    const av   = regName.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    const newAcc = { username:ukey, name:regName.trim(), dept:regDept, avatar:av, password:regPass };
    setBusy2(true);
    if (CONFIG.SCRIPT_URL) {
      // Sheets mode: ignore localStorage sepenuhnya
      const res = await API.registerAcc(newAcc);
      setBusy2(false);
      if (!res) return setErr("Tidak bisa terhubung ke server. Cek koneksi atau Apps Script.");
      if (!res.ok) return setErr(res.error || "Username sudah dipakai, pilih yang lain");
    } else {
      // localStorage fallback (offline mode)
      const accounts = lsGet2();
      if (accounts[ukey]) { setBusy2(false); return setErr("Username sudah dipakai"); }
      accounts[ukey] = newAcc;
      lsSave2(accounts);
      setBusy2(false);
    }
    onLogin({ name:newAcc.name, dept:newAcc.dept, role:"employee", avatar:av });
  };

  // ── Login karyawan (Sheets + localStorage fallback) ───────
  const doLogin = async () => {
    if (!username.trim()) return setErr("Masukkan username");
    if (!pass)            return setErr("Masukkan password");
    const ukey = username.toLowerCase().trim();
    setBusy2(true);
    if (CONFIG.SCRIPT_URL) {
      // Sheets mode: ignore localStorage sepenuhnya
      const res = await API.loginAcc(ukey, pass);
      setBusy2(false);
      if (!res) return setErr("Tidak bisa terhubung ke server. Cek koneksi atau Apps Script.");
      if (!res.ok) return setErr(res.error || "Username atau password salah");
      const name = res.name || res.acc?.name || ukey;
      const dept = res.dept || res.acc?.dept || "-";
      const av2  = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
      onLogin({ name, dept, role:"employee", avatar:av2 });
    } else {
      const accounts = lsGet2();
      const acc = accounts[ukey];
      setBusy2(false);
      if (!acc)             return setErr("Username tidak ditemukan");
      if (acc.password !== pass) return setErr("Password salah!");
      onLogin({ name:acc.name, dept:acc.dept, role:"employee", avatar:acc.avatar });
    }
  };

  // ── Login staff (approver / finance) ──────────────────────
  const doStaff = () => {
    const correct = role==="approver" ? CONFIG.PASS_APPROVER : CONFIG.PASS_FINANCE;
    if (staffPass !== correct) return setErr("Password salah!");
    const info = role==="approver"
      ? { name:"Approver", dept:"Management", avatar:"AP" }
      : { name:"Finance",  dept:"Finance",    avatar:"FN" };
    onLogin({ ...info, role });
  };

  // PwInput moved to module scope

  return (
    <div className="lw">
      <div className="lr1"/><div className="lr2"/>
      <div className="lc">
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div className="l-ico">💼</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontStyle:"italic",color:"var(--ink)"}}>ReimburseApp</h1>
          <p style={{fontSize:12,color:"var(--i3)",marginTop:3}}>Sistem Reimburse & Cash Advance</p>
        </div>

        {/* Tabs: Karyawan vs Staff */}
        <div className="l-tabs">
          {[["karyawan","👤  Karyawan"],["staff","🔐  Admin / Finance"]].map(([v,l])=>(
            <button key={v} className={`l-tab${tab===v?" on":""}`}
              onClick={()=>{setTab(v);setErr("");setMode("login");}}>
              {l}
            </button>
          ))}
        </div>

        {err && <div className="l-err"><Ic n="x" s={13} c="#dc2626"/>{err}</div>}

        {/* ── KARYAWAN TAB ── */}
        {tab==="karyawan" && mode==="login" && (
          <>
            <div className="l-fld">
              <label>Username</label>
              <input value={username} onChange={e=>{setUsername(e.target.value);clr();}}
                placeholder="Username yang sudah didaftarkan" autoFocus
                onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </div>
            <div className="l-fld">
              <label>Password</label>
              <PwInput value={pass} onChange={v=>{setPass(v);clr();}} placeholder="Password kamu"
                showState={show} toggleShow={()=>setShow(s=>!s)} onEnter={doLogin}/>
            </div>
            <button className="l-btn" onClick={doLogin} disabled={busy2}>{busy2?<span className="sp2"/>:"Masuk →"}</button>
            <div style={{textAlign:"center",marginTop:14}}>
              <span style={{fontSize:12.5,color:"var(--i3)"}}>Belum punya akun? </span>
              <button onClick={()=>{setMode("register");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,color:"var(--tl)",fontFamily:"inherit"}}>
                Daftar sekarang
              </button>
            </div>
          </>
        )}

        {tab==="karyawan" && mode==="register" && (
          <>
            <div style={{background:"var(--tlb)",border:"1px solid var(--tlbd)",borderRadius:"var(--r3)",padding:"9px 12px",marginBottom:14,fontSize:12,color:"#134e4a"}}>
              ✨ Daftar sekali, langsung bisa login kapan saja dari HP atau laptop.
            </div>
            <div className="l-fld">
              <label>Nama Lengkap <span style={{color:"var(--rd)"}}>*</span></label>
              <input value={regName} onChange={e=>{setRegName(e.target.value);clr();}} placeholder="Nama lengkap kamu" autoFocus/>
            </div>
            <div className="l-fld">
              <label>Departemen <span style={{color:"var(--rd)"}}>*</span></label>
              <select value={regDept} onChange={e=>{setRegDept(e.target.value);clr();}}>
                <option value="">-- Pilih Departemen --</option>
                {DEPTS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="l-fld">
              <label>Username <span style={{color:"var(--rd)"}}>*</span></label>
              <input value={regUser} onChange={e=>{setRegUser(e.target.value);clr();}} placeholder="Contoh: budi.santoso"/>
              <p style={{fontSize:11,color:"var(--i3)",marginTop:3}}>Huruf kecil, tanpa spasi. Dipakai untuk login berikutnya.</p>
            </div>
            <div className="l-fld">
              <label>Password <span style={{color:"var(--rd)"}}>*</span></label>
              <PwInput value={regPass} onChange={v=>{setRegPass(v);clr();}} placeholder="Min. 4 karakter"
                showState={show} toggleShow={()=>setShow(s=>!s)}/>
            </div>
            <div className="l-fld">
              <label>Konfirmasi Password <span style={{color:"var(--rd)"}}>*</span></label>
              <PwInput value={regPass2} onChange={v=>{setRegPass2(v);clr();}} placeholder="Ulangi password"
                showState={show2} toggleShow={()=>setShow2(s=>!s)} onEnter={doRegister}/>
            </div>
            <button className="l-btn" onClick={doRegister} disabled={busy2}>{busy2?<span className="sp2"/>:"Daftar & Masuk →"}</button>
            <div style={{textAlign:"center",marginTop:14}}>
              <span style={{fontSize:12.5,color:"var(--i3)"}}>Sudah punya akun? </span>
              <button onClick={()=>{setMode("login");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,color:"var(--tl)",fontFamily:"inherit"}}>
                Login di sini
              </button>
            </div>
          </>
        )}

        {/* ── STAFF TAB ── */}
        {tab==="staff" && (
          <>
            <div className="l-fld">
              <label>Login sebagai</label>
              <select value={role} onChange={e=>{setRole(e.target.value);clr();}}>
                <option value="approver">✅  Approver / Admin</option>
                <option value="finance">💼  Finance</option>
              </select>
            </div>
            <div className="l-fld">
              <label>Password <span style={{color:"var(--rd)"}}>*</span></label>
              <PwInput value={staffPass} onChange={v=>{setStaffPass(v);clr();}} placeholder="Masukkan password"
                showState={show} toggleShow={()=>setShow(s=>!s)} onEnter={doStaff}/>
            </div>
            <button className="l-btn" onClick={doStaff}>Masuk →</button>
            <div className="l-note">
              🔑 Password default: <strong>approver123</strong> / <strong>finance123</strong><br/>
              Ganti di menu <strong>Pengaturan</strong> (login Finance).<br/><br/>
              🔒 <strong>Lupa password karyawan?</strong> Hubungi Finance untuk reset akun di Google Sheets tab <em>Accounts</em>.
            </div>
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
  const mine    = user.role==="employee" ? data.filter(d=>d.submitter===user.name) : data;
  const pending = data.filter(d=>d.status==="pending");
  const approved= data.filter(d=>d.status==="approved");
  const overdue = data.filter(d=>d.status==="overdue");
  const totalRp = mine.reduce((a,d)=>a+d.amount,0);
  const paidRp  = mine.filter(d=>d.status==="paid").reduce((a,d)=>a+d.amount,0);
  const active  = mine.filter(d=>["pending","approved","processing"].includes(d.status));
  const pct     = totalRp?Math.min(100,Math.round(paidRp/totalRp*100)):0;

  return (
    <div>
      <div className="hero">
        <div className="hr1"/><div className="hr2"/>
        <div style={{position:"relative"}}>
          <p style={{fontSize:10,fontWeight:800,letterSpacing:".12em",textTransform:"uppercase",color:"var(--tl2)",marginBottom:4}}>Selamat datang</p>
          <h2 style={{fontSize:20,fontWeight:800,letterSpacing:"-.01em",marginBottom:3}}>{user.name}</h2>
          <p style={{fontSize:12.5,color:"rgba(255,255,255,.5)"}}>
            {user.dept} · {user.role==="finance"?"Finance":user.role==="approver"?"Approver / Atasan":"Karyawan"}
          </p>
        </div>
      </div>

      {overdue.length>0 && <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><span><strong>{overdue.length} CA Terlambat</strong> — melewati batas 5 hari kerja!</span></div>}
      {user.role==="approver" && pending.length>0 && <div className="al aw mb4"><Ic n="clock" s={14} c="#d97706"/><span><strong>{pending.length} pengajuan</strong> menunggu persetujuan Anda.</span></div>}
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
              <td><SBadge s={d.status}/></td>
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
  const [f,setF] = useState({type:"reimburse",purpose:"",destination:"Jakarta",dateStart:"",dateEnd:"",approverName:"",notes:"",caRef:"",items:[{cat:"Perjalanan Dinas",amt:""}]});
  const [busy,setBusy] = useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const si=(i,k,v)=>setF(p=>{const it=[...p.items];it[i]={...it[i],[k]:v};return{...p,items:it};});
  const total = f.items.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);
  // CA milik user yg sudah dicairkan dan belum ada OER
  const myCAs = (data||[]).filter(d=>d.type==="cash_advance"&&d.submitter===user.name&&["paid","awaiting_oer"].includes(d.status)&&!d.oerAmount);

  const submit = async () => {
    if (!f.purpose||!f.dateStart||!f.dateEnd||!f.approverName||total===0) { alert("Harap lengkapi semua field wajib (*)"); return; }
    setBusy(true);
    const entry = {
      id:gid(), type:f.type, submitter:user.name, dept:user.dept,
      purpose:f.purpose, destination:f.destination, dateStart:f.dateStart, dateEnd:f.dateEnd,
      amount:total, status:"pending", submitted:today(),
      categories:f.items.map(it=>({cat:it.cat,amt:parseFloat(it.amt)||0})),
      notes:f.notes, settled:false, settledDate:null, approverName:f.approverName,
      financeNote:"", caRef:f.caRef||"", oerAmount:0,
    };
    if (CONFIG.SCRIPT_URL) await API.create(entry);
    else await new Promise(r=>setTimeout(r,500));
    setBusy(false);
    onSubmit(entry);
  };

  return (
    <div><div className="card">
      <div className="ch"><div><h3>Form Pengajuan</h3><p style={{fontSize:11,color:"var(--i3)",marginTop:3}}>Oleh: <strong>{user.name}</strong> · {user.dept}</p></div></div>
      <div className="cb">
        {/* JENIS */}
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
          {f.type==="cash_advance" && <div className="al aw mt3"><Ic n="clock" s={13} c="#d97706"/><span>CA wajib diselesaikan dengan <strong>OER maks. 5 hari kerja</strong> setelah selesai.</span></div>}
          {f.type==="reimburse" && myCAs.length>0 && (
            <div style={{marginTop:10,padding:"11px 14px",background:"#eff6ff",borderRadius:"var(--r2)",border:"1px solid #93c5fd"}}>
              <p style={{fontSize:12,fontWeight:700,color:"#1e40af",marginBottom:7}}>🔗 Link ke CA (jika ini OER untuk CA sebelumnya)</p>
              <select value={f.caRef} onChange={e=>set("caRef",e.target.value)} style={{background:"white"}}>
                <option value="">— Tidak ada CA terkait —</option>
                {myCAs.map(ca=><option key={ca.id} value={ca.id}>{ca.id} · {ca.purpose} · {rp(ca.amount)}</option>)}
              </select>
              {f.caRef && <p style={{fontSize:11,color:"#1d4ed8",marginTop:5}}>✓ OER ini akan clearing CA {f.caRef} secara otomatis</p>}
            </div>
          )}
        </div>
        {/* DETAIL */}
        <div className="fs mb4">
          <div className="fst">Detail Perjalanan</div>
          <div className="fg mb3"><label className="fl">Keperluan <span style={{color:"var(--rd)"}}>*</span></label><textarea value={f.purpose} onChange={e=>set("purpose",e.target.value)} placeholder="Jelaskan tujuan..." rows={2}/></div>
          <div className="fg fg3">
            <div><label className="fl">Kota Tujuan <span style={{color:"var(--rd)"}}>*</span></label><input value={f.destination} onChange={e=>set("destination",e.target.value)}/></div>
            <div><label className="fl">Tgl Mulai <span style={{color:"var(--rd)"}}>*</span></label><input type="date" value={f.dateStart} onChange={e=>set("dateStart",e.target.value)}/></div>
            <div><label className="fl">Tgl Selesai <span style={{color:"var(--rd)"}}>*</span></label><input type="date" value={f.dateEnd} onChange={e=>set("dateEnd",e.target.value)}/></div>
          </div>
        </div>
        {/* BIAYA */}
        <div className="fs mb4">
          <div className="fst">Rincian Biaya</div>
          {f.items.map((it,i)=>(
            <div key={i} style={{display:"flex",gap:9,alignItems:"flex-end",marginBottom:8}}>
              <div style={{flex:2}}>{i===0&&<label className="fl">Kategori <span style={{color:"var(--rd)"}}>*</span></label>}<select value={it.cat} onChange={e=>si(i,"cat",e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div style={{flex:1.5}}>{i===0&&<label className="fl">Nominal (Rp) <span style={{color:"var(--rd)"}}>*</span></label>}<input type="number" value={it.amt} onChange={e=>si(i,"amt",e.target.value)} placeholder="0" min="0"/></div>
              {f.items.length>1 && <button className="btn bo xs" onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{color:"var(--rd)",borderColor:"#fca5a5",flexShrink:0}}><Ic n="trash" s={12}/></button>}
            </div>
          ))}
          <button className="btn bo sm" onClick={()=>setF(p=>({...p,items:[...p.items,{cat:"Perjalanan Dinas",amt:""}]}))}><Ic n="plus" s={12}/>Tambah Item</button>
          {total>0 && <div style={{marginTop:11,padding:"10px 13px",background:"var(--tlb)",border:"1px solid var(--tlbd)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between"}}>
            <span style={{fontWeight:700,color:"var(--tl)"}}>Total</span>
            <span style={{fontWeight:800,fontSize:16,color:"var(--tl)"}}>{rp(total)}</span>
          </div>}
        </div>
        <div className="fs mb4"><div className="fst">Nama Atasan <span style={{color:"var(--rd)"}}>*</span></div><input value={f.approverName} onChange={e=>set("approverName",e.target.value)} placeholder="Nama lengkap atasan langsung"/></div>
        <div className="fs mb4"><div className="fst">Catatan (Opsional)</div><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Catatan untuk Finance..." rows={2}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:9}}>
          <button className="btn bo" onClick={()=>setF({type:"reimburse",purpose:"",destination:"Jakarta",dateStart:"",dateEnd:"",approverName:"",notes:"",items:[{cat:"Perjalanan Dinas",amt:""}]})}>Reset</button>
          <button className="btn bp" onClick={submit} disabled={busy}>{busy?<span className="sp2"/>:<Ic n="send" s={13}/>}{busy?"Menyimpan...":"Submit Pengajuan"}</button>
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
  const base = user.role==="employee" ? data.filter(d=>d.submitter===user.name) : data;
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
            <tr key={d.id} onClick={()=>onSel(d.id)}>
              <td><span className="mono">{d.id}</span></td>
              <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div><div style={{fontSize:11,color:"var(--i3)"}}>{d.dept}</div></td>
              <td><TTag t={d.type}/></td>
              <td><div className="trunc" style={{maxWidth:155}}>{d.purpose}</div></td>
              <td style={{fontSize:12,color:"var(--i3)"}}>{d.destination}</td>
              <td style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)}<br/>{fd(d.dateEnd)}</td>
              <td className="bold">{rp(d.amount)}</td>
              <td><SBadge s={d.status}/></td>
            </tr>
          ))}</tbody>
        </table>{rows.length===0&&<div className="empty"><Ic n="list" s={36}/><p style={{marginTop:10}}>Tidak ada data</p></div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APPROVAL PAGE
// ═══════════════════════════════════════════════════════════════
function ApprovalPage({ data, onAction, onSel, user }) {
  const [search, setSearch] = useState("");
  const [filterMine, setFilterMine] = useState(false);
  const allPending = data.filter(d=>d.status==="pending");
  const queue = allPending.filter(d => {
    const matchSearch = !search || d.submitter.toLowerCase().includes(search.toLowerCase()) || d.dept.toLowerCase().includes(search.toLowerCase());
    const matchMine   = !filterMine || d.approverName.toLowerCase() === user.name.toLowerCase();
    return matchSearch && matchMine;
  });
  return (
    <div>
      {allPending.length>0 && <div className="al aw mb4"><Ic n="clock" s={14} c="#d97706"/><span><strong>{allPending.length} pengajuan</strong> menunggu persetujuan — {queue.length} tampil.</span></div>}
      {/* Search & Filter Bar */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{padding:"10px 14px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:180,position:"relative"}}>
            <Ic n="search" s={13} c="var(--i4)" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}/>
            <input
              value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Cari nama karyawan atau departemen..."
              style={{width:"100%",paddingLeft:32,paddingRight:10}}
            />
          </div>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12.5,fontWeight:600,color:"var(--i2)",userSelect:"none",flexShrink:0}}>
            <input type="checkbox" checked={filterMine} onChange={e=>setFilterMine(e.target.checked)} style={{width:"auto",accentColor:"var(--tl)",cursor:"pointer"}}/>
            Hanya karyawan saya
          </label>
          {(search||filterMine) && (
            <button className="btn bo sm" onClick={()=>{setSearch("");setFilterMine(false);}} style={{flexShrink:0}}>
              <Ic n="x" s={11}/>Reset
            </button>
          )}
        </div>
      </div>
      <div className="card">
        <div className="ch">
          <h3>Antrian Approval</h3>
          {queue.length>0 && <span style={{fontSize:12,color:"var(--i3)",fontWeight:600}}>{queue.length} pengajuan</span>}
        </div>
        <div className="tw"><table>
          <thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Periode</th><th>Jumlah</th><th>Diajukan</th><th>Aksi</th></tr></thead>
          <tbody>{queue.map(d=>(
            <tr key={d.id} onClick={()=>onSel(d.id)} style={{cursor:"pointer"}}>
              <td><span className="mono">{d.id}</span></td>
              <td>
                <div className="bold" style={{fontSize:13}}>{d.submitter}</div>
                <div style={{fontSize:11,color:"var(--i3)"}}>{d.dept}</div>
                {d.approverName && <div style={{fontSize:10,color:"var(--tl)",marginTop:2}}>→ {d.approverName}</div>}
              </td>
              <td><div className="trunc" style={{maxWidth:150}}>{d.purpose}</div></td>
              <td style={{fontSize:11,color:"var(--i3)"}}>{fd(d.dateStart)}<br/>{fd(d.dateEnd)}</td>
              <td className="bold">{rp(d.amount)}</td>
              <td style={{fontSize:11,color:"var(--i3)"}}>{fd(d.submitted)}</td>
              <td onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",gap:5}}>
                  <button className="btn bg xs" onClick={()=>onAction(d.id,"approve","Disetujui")}><Ic n="check" s={11}/>OK</button>
                  <button className="btn br2 xs" onClick={()=>onAction(d.id,"reject","Ditolak")}><Ic n="x" s={11}/>Tolak</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>{queue.length===0&&<div className="empty"><Ic n="search" s={36}/><p style={{marginTop:10}}>{allPending.length===0?"Tidak ada antrian 🎉":"Tidak ada hasil untuk pencarian ini"}</p></div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MONITOR PAGE
// ═══════════════════════════════════════════════════════════════
function MonitorPage({ data, onSel }) {
  const totalRp = data.reduce((a,d)=>a+d.amount,0);
  const paidRp  = data.filter(d=>d.status==="paid").reduce((a,d)=>a+d.amount,0);
  const pct = totalRp?Math.round(paidRp/totalRp*100):0;
  const overdue = data.filter(d=>d.status==="overdue");
  const caOut   = data.filter(d=>d.type==="cash_advance"&&!d.settled&&!["rejected","settled"].includes(d.status));
  const needSettle = data.filter(d=>d.type==="cash_advance"&&["kurang_bayar","lebih_bayar"].includes(d.status)&&!d.settled);
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
                • {d.id} – {d.submitter}: {rc?.isKurang?`Transfer ${rp(Math.abs(rc.selisih))} ke karyawan`:`Terima ${rp(Math.abs(rc?.selisih||0))} dari karyawan`}
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
      <div className="g2">
        <div className="card">
          <div className="ch"><h3>Perlu Ditindak</h3></div>
          <div className="tw"><table>
            <thead><tr><th>ID</th><th>Pemohon</th><th>Jumlah</th><th>Status</th></tr></thead>
            <tbody>{data.filter(d=>["approved","processing"].includes(d.status)).map(d=>(
              <tr key={d.id} onClick={()=>onSel(d.id)}>
                <td><span className="mono">{d.id}</span></td>
                <td><div className="bold" style={{fontSize:13}}>{d.submitter}</div></td>
                <td className="bold">{rp(d.amount)}</td>
                <td><SBadge s={d.status}/></td>
              </tr>
            ))}</tbody>
          </table>{!data.some(d=>["approved","processing"].includes(d.status))&&<div className="empty" style={{padding:"20px 0"}}><p>Tidak ada yang perlu ditindak 🎉</p></div>}</div>
        </div>
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
                <div style={{textAlign:"right"}}><div className="bold">{rp(d.amount)}</div><SBadge s={d.status}/></div>
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
  const [url,setUrl]   = useState(CONFIG.SCRIPT_URL);
  const [pa,setPa]     = useState(CONFIG.PASS_APPROVER);
  const [pf,setPf]     = useState(CONFIG.PASS_FINANCE);
  const [saved,setSaved]= useState(false);
  const save = () => {
    CONFIG.SCRIPT_URL     = url.trim();
    CONFIG.PASS_APPROVER  = pa;
    CONFIG.PASS_FINANCE   = pf;
    _saveConfig({ SCRIPT_URL: url.trim(), PASS_APPROVER: pa, PASS_FINANCE: pf });
    setSaved(true); setTimeout(()=>setSaved(false),2500);
    if (onSave) onSave();
  };
  return (
    <div>
      <div className="card mb4">
        <div className="ch"><h3>Koneksi Google Sheets</h3></div>
        <div className="cb">
          <div className="al ab mb4"><Ic n="settings" s={14} c="#2563eb"/><span>Isi URL Apps Script agar data karyawan langsung tersimpan ke Google Sheets secara otomatis.</span></div>
          <div className="fg mb4">
            <label className="fl">Apps Script Web App URL</label>
            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/xxxxx/exec"/>
            <p style={{fontSize:11,color:"var(--i3)",marginTop:4}}>Dari: Google Sheets → Extensions → Apps Script → Deploy → salin URL</p>
          </div>
          <div style={{padding:"10px 13px",background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
            <p style={{fontSize:11,fontWeight:700,color:"var(--i3)",marginBottom:3}}>STATUS</p>
            {url.trim()
              ? <span style={{color:"var(--gn)",fontWeight:700,fontSize:13}}>✓ Terhubung ke Google Sheets — data tersimpan otomatis</span>
              : <span style={{color:"var(--am)",fontWeight:700,fontSize:13}}>⚠️ Belum terhubung — data hanya tersimpan sementara (hilang saat refresh)</span>
            }
          </div>
        </div>
      </div>
      <div className="card">
        <div className="ch"><h3>Password Login</h3></div>
        <div className="cb">
          <div className="al aw mb4"><Ic n="alert" s={14} c="#d97706"/><span>Ganti password default sebelum dibagikan ke tim! Password tersimpan sementara di browser.</span></div>
          <div className="fg fg2 mb4">
            <div>
              <label className="fl">Password Approver</label>
              <input value={pa} onChange={e=>setPa(e.target.value)} placeholder="approver123"/>
              <p style={{fontSize:11,color:"var(--i3)",marginTop:3}}>Default: approver123</p>
            </div>
            <div>
              <label className="fl">Password Finance</label>
              <input value={pf} onChange={e=>setPf(e.target.value)} placeholder="finance123"/>
              <p style={{fontSize:11,color:"var(--i3)",marginTop:3}}>Default: finance123</p>
            </div>
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
// EDIT FORM (shared by karyawan & finance)
// ═══════════════════════════════════════════════════════════════
function EditForm({ trx, user, onSave, onCancel }) {
  const [f,setF] = useState({
    type:        trx.type,
    purpose:     trx.purpose,
    destination: trx.destination,
    dateStart:   trx.dateStart,
    dateEnd:     trx.dateEnd,
    approverName:trx.approverName,
    notes:       trx.notes||"",
    items:       trx.categories.map(c=>({cat:c.cat, amt:String(c.amt)})),
  });
  const [busy,setBusy] = useState(false);
  const set  = (k,v) => setF(p=>({...p,[k]:v}));
  const si   = (i,k,v) => setF(p=>{const it=[...p.items];it[i]={...it[i],[k]:v};return{...p,items:it};});
  const total = f.items.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);
  const isFin = user.role==="finance";

  const save = async () => {
    if (!f.purpose||!f.dateStart||!f.dateEnd||!f.approverName||total===0){alert("Harap lengkapi semua field wajib.");return;}
    setBusy(true);
    const updated = {
      ...trx,
      type:        f.type,
      purpose:     f.purpose,
      destination: f.destination,
      dateStart:   f.dateStart,
      dateEnd:     f.dateEnd,
      approverName:f.approverName,
      notes:       f.notes,
      amount:      total,
      categories:  f.items.map(it=>({cat:it.cat, amt:parseFloat(it.amt)||0})),
    };
    if (CONFIG.SCRIPT_URL) await API.editData(trx.id, updated);
    else await new Promise(r=>setTimeout(r,400));
    setBusy(false);
    onSave(updated);
  };

  return (
    <div style={{padding:"4px 0"}}>
      <div className="al aw mb4" style={{marginBottom:14}}>
        <Ic n="alert" s={14} c="#d97706"/>
        <span>{isFin ? "Mode Edit Finance — semua field bisa diubah." : "Edit Pengajuan — perubahan akan disimpan langsung."}</span>
      </div>

      {/* Jenis */}
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

      {/* Detail */}
      <div className="fs mb3">
        <div className="fst">Detail Perjalanan</div>
        <div className="fg mb3">
          <label className="fl">Keperluan *</label>
          <textarea value={f.purpose} onChange={e=>set("purpose",e.target.value)} rows={2}/>
        </div>
        <div className="fg fg3">
          <div><label className="fl">Kota Tujuan</label><input value={f.destination} onChange={e=>set("destination",e.target.value)}/></div>
          <div><label className="fl">Tgl Mulai</label><input type="date" value={f.dateStart} onChange={e=>set("dateStart",e.target.value)}/></div>
          <div><label className="fl">Tgl Selesai</label><input type="date" value={f.dateEnd} onChange={e=>set("dateEnd",e.target.value)}/></div>
        </div>
      </div>

      {/* Biaya */}
      <div className="fs mb3">
        <div className="fst">Rincian Biaya</div>
        {f.items.map((it,i)=>(
          <div key={i} style={{display:"flex",gap:9,alignItems:"flex-end",marginBottom:8}}>
            <div style={{flex:2}}>{i===0&&<label className="fl">Kategori</label>}
              <select value={it.cat} onChange={e=>si(i,"cat",e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
            </div>
            <div style={{flex:1.5}}>{i===0&&<label className="fl">Nominal (Rp)</label>}
              <input type="number" value={it.amt} onChange={e=>si(i,"amt",e.target.value)} placeholder="0" min="0"/>
            </div>
            {f.items.length>1&&<button className="btn bo xs" onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{color:"var(--rd)",borderColor:"#fca5a5",flexShrink:0}}><Ic n="trash" s={12}/></button>}
          </div>
        ))}
        <button className="btn bo sm" onClick={()=>setF(p=>({...p,items:[...p.items,{cat:"Perjalanan Dinas",amt:""}]}))}><Ic n="plus" s={12}/>Tambah Item</button>
        {total>0&&<div style={{marginTop:10,padding:"9px 13px",background:"var(--tlb)",border:"1px solid var(--tlbd)",borderRadius:"var(--r2)",display:"flex",justifyContent:"space-between"}}>
          <span style={{fontWeight:700,color:"var(--tl)"}}>Total</span>
          <span style={{fontWeight:800,fontSize:15,color:"var(--tl)"}}>{rp(total)}</span>
        </div>}
      </div>

      {/* Atasan & catatan */}
      <div className="fg fg2 mb3">
        <div className="fs"><div className="fst">Nama Atasan *</div><input value={f.approverName} onChange={e=>set("approverName",e.target.value)}/></div>
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
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function DetailModal({ trx, user, onClose, onAction, onEdit }) {
  const [note,setNote]   = useState("");
  const [busy,setBusy]   = useState(false);
  const [editing,setEditing] = useState(false);
  const isApp = user.role==="approver";
  const isFin = user.role==="finance";
  const isOwner = user.role==="employee" && trx.submitter===user.name;
  const canEdit = (isFin || (isOwner && trx.status!=="paid" && trx.status!=="rejected"));

  const act = async (action, n) => {
    setBusy(true);
    const sm = {approve:"approved",reject:"rejected",process:"processing",pay:"paid"};
    if (CONFIG.SCRIPT_URL) await API.update(trx.id, sm[action], n);
    else await new Promise(r=>setTimeout(r,400));
    setBusy(false); onAction(trx.id, action, n);
  };
  const settle = async () => {
    setBusy(true);
    if (CONFIG.SCRIPT_URL) await API.settle(trx.id, note);
    else await new Promise(r=>setTimeout(r,400));
    setBusy(false); onAction(trx.id, "settle", note);
  };
  // OER submission state (for employee submitting OER against CA)
  const [oerItems, setOerItems] = useState(OER_CATS.map(cat=>({cat,amt:""})));
  const [oerNote, setOerNote]   = useState("");
  const [showOerForm, setShowOerForm] = useState(false);
  const oerTotal = oerItems.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);
  const setOi = (i,v) => setOerItems(prev=>{const n=[...prev];n[i]={...n[i],amt:v};return n;});

  const submitOer = async () => {
    if (oerTotal===0) { alert("Isi minimal satu item biaya OER"); return; }
    setBusy(true);
    const oerData = {
      oerAmount: oerTotal,
      oerCategories: oerItems.filter(it=>parseFloat(it.amt)>0).map(it=>({cat:it.cat,amt:parseFloat(it.amt)})),
      oerNote, oerDate: today(),
    };
    if (CONFIG.SCRIPT_URL) await API.submitOer(trx.id, oerData);
    else await new Promise(r=>setTimeout(r,400));
    setBusy(false);
    onAction(trx.id, "oer_submitted", oerData);
  };
  const rc = recon(trx);

  const tl = [
    {ok:true,  icon:"send",  title:"Pengajuan Dikirim",  sub:`${trx.submitter} · ${fd(trx.submitted)}`, col:"var(--tl)"},
    {ok:!["pending"].includes(trx.status), icon:"user", title:"Approval Atasan", sub:trx.status==="pending"?"Menunggu…":trx.approverName, col:trx.status==="pending"?"var(--am)":"var(--gn)"},
    {ok:["processing","paid"].includes(trx.status), icon:"money", title:"Diproses Finance", sub:trx.status==="processing"?"Sedang diproses…":trx.status==="paid"?"Selesai":"Belum", col:trx.status==="paid"?"var(--gn)":"var(--i4)"},
    {ok:trx.status==="paid", icon:"check", title:"Pembayaran", sub:trx.status==="paid"?`Dibayar · ${fd(trx.settledDate)}`:"Menunggu", col:trx.status==="paid"?"var(--gn)":"var(--i4)"},
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
            {canEdit && !editing && (
              <button className="btn bo sm" onClick={()=>setEditing(true)} style={{color:"var(--bl)",borderColor:"var(--blbd)"}}>
                ✏️ Edit
              </button>
            )}
            {editing && (
              <span style={{fontSize:11,fontWeight:700,color:"var(--am)",background:"var(--amb)",padding:"3px 9px",borderRadius:20}}>Mode Edit</span>
            )}
            <button className="btn bo sm" onClick={onClose}><Ic n="x" s={13}/></button>
          </div>
        </div>
        <div className="mb2">
          {editing ? (
            <EditForm
              trx={trx}
              user={user}
              onSave={(updated) => { setEditing(false); onEdit(updated); }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,alignItems:"center",padding:"9px 13px",background:"var(--ln2)",borderRadius:"var(--r2)",marginBottom:16}}>
                <TTag t={trx.type}/><SBadge s={trx.status}/><span style={{marginLeft:"auto",fontSize:11,color:"var(--i3)"}}>Diajukan {fd(trx.submitted)}</span>
              </div>
              {trx.status==="rejected"&&trx.financeNote&&<div className="al ae mb4"><Ic n="x" s={13} c="#dc2626"/><span><strong>Alasan:</strong> {trx.financeNote}</span></div>}
              {trx.financeNote&&trx.status!=="rejected"&&<div className="al ab mb4"><Ic n="bell" s={13} c="#2563eb"/><span>{trx.financeNote}</span></div>}

              <div className="g2 mb4">
                <div>
                  <p style={{fontSize:10.5,fontWeight:800,color:"var(--i3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>Pemohon</p>
                  <p className="bold">{trx.submitter}</p><p style={{fontSize:12,color:"var(--i3)"}}>{trx.dept}</p>
                  <p style={{fontSize:12,color:"var(--i3)",marginTop:4}}>Atasan: {trx.approverName}</p>
                </div>
                <div>
                  <p style={{fontSize:10.5,fontWeight:800,color:"var(--i3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>Perjalanan</p>
                  <p className="bold">{trx.destination}</p><p style={{fontSize:12,color:"var(--i3)"}}>{fd(trx.dateStart)} – {fd(trx.dateEnd)}</p>
                  {trx.type==="cash_advance"&&<p style={{fontSize:12,fontWeight:700,marginTop:4,color:trx.settled?"var(--gn)":"var(--am)"}}>Settlement: {trx.settled?`✓ ${fd(trx.settledDate)}`:"Belum"}</p>}
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
                  <span style={{fontWeight:800,color:"var(--tl)"}}>TOTAL</span>
                  <span style={{fontWeight:800,fontSize:16,color:"var(--tl)"}}>{rp(trx.amount)}</span>
                </div>
              </div>

              {trx.notes&&<div className="al at mb4"><Ic n="bell" s={13} c="var(--tl)"/><span>{trx.notes}</span></div>}

              {/* ── REKONSILIASI CA vs OER ── */}
              {trx.type==="cash_advance" && rc && (
                <div style={{marginBottom:16,border:"2px solid",borderColor:rc.isKurang?"#93c5fd":rc.isLebih?"#c4b5fd":"#6ee7b7",borderRadius:"var(--r2)",overflow:"hidden"}}>
                  <div style={{padding:"9px 14px",background:rc.isKurang?"#dbeafe":rc.isLebih?"#ede9fe":"#ecfdf5",fontWeight:800,fontSize:12,color:rc.isKurang?"#1e3a8a":rc.isLebih?"#4c1d95":"#065f46",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>📊 Rekonsiliasi CA vs OER</span>
                    {rc.isKurang&&<span style={{background:"#1e40af",color:"white",padding:"2px 10px",borderRadius:20,fontSize:11}}>KURANG BAYAR</span>}
                    {rc.isLebih&&<span style={{background:"#7c3aed",color:"white",padding:"2px 10px",borderRadius:20,fontSize:11}}>LEBIH BAYAR</span>}
                    {rc.isLunas&&<span style={{background:"#059669",color:"white",padding:"2px 10px",borderRadius:20,fontSize:11}}>LUNAS</span>}
                  </div>
                  <div style={{padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
                      <span style={{color:"var(--i3)"}}>CA Dicairkan</span>
                      <span style={{fontWeight:700}}>{rp(rc.ca)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
                      <span style={{color:"var(--i3)"}}>Total Biaya OER</span>
                      <span style={{fontWeight:700}}>{rp(rc.oer)}</span>
                    </div>
                    <div style={{height:1,background:"var(--ln)",margin:"8px 0"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}>
                      <span style={{fontWeight:800,color:rc.isKurang?"#1e40af":rc.isLebih?"#7c3aed":"#059669"}}>
                        {rc.isKurang?"Perusahaan bayar ke karyawan":rc.isLebih?"Karyawan kembalikan ke perusahaan":"Selisih"}
                      </span>
                      <span style={{fontWeight:800,fontSize:16,color:rc.isKurang?"#1e40af":rc.isLebih?"#7c3aed":"#059669"}}>
                        {rp(Math.abs(rc.selisih))}
                      </span>
                    </div>
                    {trx.oerCategories&&trx.oerCategories.length>0&&(
                      <details style={{marginTop:10}}>
                        <summary style={{fontSize:11,color:"var(--i3)",cursor:"pointer"}}>Lihat rincian OER</summary>
                        <div style={{marginTop:7}}>
                          {trx.oerCategories.map((oc,i)=>(
                            <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid var(--ln)"}}>
                              <span style={{color:"var(--i3)"}}>{oc.cat}</span><span style={{fontWeight:600}}>{rp(oc.amt)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}

              <p style={{fontSize:10.5,fontWeight:800,color:"var(--i3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Progress</p>
              <div>{tl.map((t,i)=>(
                <div key={i} className="tlr">
                  <div className="tldc"><div className="tld" style={{background:t.ok?t.col:"var(--ln)"}}><Ic n={t.icon} s={12} c={t.ok?"#fff":"var(--i4)"}/></div>{i<tl.length-1&&<div className="tlln"/>}</div>
                  <div className="tlb"><div className="tlt" style={{color:t.ok?"var(--ink)":"var(--i4)"}}>{t.title}</div><div className="tls">{t.sub}</div></div>
                </div>
              ))}</div>

              {isApp&&trx.status==="pending"&&(
                <div style={{marginTop:16,padding:14,background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
                  <p style={{fontSize:13,fontWeight:700,marginBottom:9}}>Tindakan Approval</p>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan (opsional)..." rows={2} style={{marginBottom:9}}/>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn bg" onClick={()=>act("approve",note||"Disetujui")} disabled={busy}>{busy?<span className="sp2"/>:<Ic n="check" s={13}/>}Setujui</button>
                    <button className="btn br2" onClick={()=>act("reject",note||"Ditolak")} disabled={busy}><Ic n="x" s={13}/>Tolak</button>
                  </div>
                </div>
              )}
              {isFin&&trx.status==="approved"&&(
                <div style={{marginTop:16,padding:14,background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
                  <p style={{fontSize:13,fontWeight:700,marginBottom:9}}>Mulai Proses</p>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan Finance..." rows={2} style={{marginBottom:9}}/>
                  <button className="btn bp" onClick={()=>act("process",note)} disabled={busy}>{busy?<span className="sp2"/>:<Ic n="money" s={13}/>}Mulai Proses</button>
                </div>
              )}
              {isFin&&trx.status==="processing"&&(
                <div style={{marginTop:16,padding:14,background:"var(--ln2)",borderRadius:"var(--r2)",border:"1px solid var(--ln)"}}>
                  <p style={{fontSize:13,fontWeight:700,marginBottom:9}}>Konfirmasi Pembayaran</p>
                  <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="No. referensi transfer..." rows={2} style={{marginBottom:9}}/>
                  <button className="btn bg" onClick={()=>act("pay",note)} disabled={busy}>{busy?<span className="sp2"/>:<Ic n="check" s={13}/>}Tandai Sudah Dibayar</button>
                </div>
              )}
              {/* Employee: submit OER for this CA */}
              {isOwner && trx.type==="cash_advance" && ["paid","awaiting_oer"].includes(trx.status) && !trx.oerAmount && (
                <div style={{marginTop:16,padding:14,background:"#fef9c3",borderRadius:"var(--r2)",border:"2px solid #ca8a04"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <p style={{fontSize:13,fontWeight:800,color:"#78350f"}}>📋 Submit OER untuk CA ini</p>
                    <button className="btn bo sm" onClick={()=>setShowOerForm(v=>!v)} style={{fontSize:11}}>{showOerForm?"Sembunyikan":"Isi OER"}</button>
                  </div>
                  <p style={{fontSize:11,color:"#92400e"}}>CA dicairkan {rp(trx.amount)} — isi pengeluaran aktual di bawah untuk rekonsiliasi otomatis.</p>
                  {showOerForm&&(
                    <div style={{marginTop:12}}>
                      <div style={{border:"1px solid #fde68a",borderRadius:"var(--r3)",overflow:"hidden",marginBottom:10}}>
                        <div style={{padding:"7px 12px",background:"#fffbeb",fontSize:10.5,fontWeight:800,color:"#92400e",textTransform:"uppercase",letterSpacing:".06em"}}>Rincian Pengeluaran (sesuai form OER)</div>
                        {oerItems.map((it,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",padding:"7px 12px",borderBottom:i<oerItems.length-1?"1px solid #fef3c7":"none",gap:10}}>
                            <span style={{flex:2,fontSize:12,color:"var(--i2)"}}>{it.cat}</span>
                            <input type="number" value={it.amt} onChange={e=>setOi(i,e.target.value)} placeholder="0" min="0"
                              style={{flex:1,padding:"5px 8px",border:"1px solid #fde68a",borderRadius:6,fontSize:12,textAlign:"right",fontFamily:"inherit"}}/>
                          </div>
                        ))}
                        {oerTotal>0&&(
                          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 12px",background:"#fef3c7",borderTop:"2px solid #f59e0b"}}>
                            <span style={{fontWeight:800,color:"#78350f"}}>Total OER</span>
                            <span style={{fontWeight:800,fontSize:15,color:"#78350f"}}>{rp(oerTotal)}</span>
                          </div>
                        )}
                      </div>
                      {oerTotal>0&&(
                        <div style={{padding:"10px 12px",marginBottom:10,borderRadius:"var(--r3)",border:"1px solid",
                          borderColor:oerTotal>trx.amount?"#93c5fd":oerTotal<trx.amount?"#c4b5fd":"#6ee7b7",
                          background:oerTotal>trx.amount?"#dbeafe":oerTotal<trx.amount?"#ede9fe":"#ecfdf5"}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                            <span>CA Dicairkan</span><span style={{fontWeight:700}}>{rp(trx.amount)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                            <span>Total OER</span><span style={{fontWeight:700}}>{rp(oerTotal)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,
                            color:oerTotal>trx.amount?"#1e40af":oerTotal<trx.amount?"#7c3aed":"#059669"}}>
                            <span>{oerTotal>trx.amount?"Perusahaan bayar kamu":oerTotal<trx.amount?"Kamu kembalikan":"Lunas pas ✓"}</span>
                            <span>{rp(Math.abs(oerTotal-trx.amount))}</span>
                          </div>
                        </div>
                      )}
                      <textarea value={oerNote} onChange={e=>setOerNote(e.target.value)} placeholder="Catatan OER (opsional)..." rows={2} style={{marginBottom:9}}/>
                      <button className="btn bp" onClick={submitOer} disabled={busy||oerTotal===0}>{busy?<span className="sp2"/>:<Ic n="send" s={13}/>}Submit OER</button>
                    </div>
                  )}
                </div>
              )}

              {/* Finance: confirm settlement kurang/lebih bayar */}
              {isFin && trx.type==="cash_advance" && rc && !trx.settled && (
                <div style={{marginTop:16,padding:14,borderRadius:"var(--r2)",border:"2px solid",
                  borderColor:rc.isKurang?"#93c5fd":rc.isLebih?"#c4b5fd":"#6ee7b7",
                  background:rc.isKurang?"#eff6ff":rc.isLebih?"#f5f3ff":"#f0fdf4"}}>
                  <p style={{fontSize:13,fontWeight:800,marginBottom:4,
                    color:rc.isKurang?"#1e3a8a":rc.isLebih?"#4c1d95":"#065f46"}}>
                    {rc.isKurang?"💙 Kurang Bayar — Transfer ke Karyawan":rc.isLebih?"💜 Lebih Bayar — Terima Kembalian":"💚 Pas — Konfirmasi Lunas"}
                  </p>
                  <p style={{fontSize:13,marginBottom:10,fontWeight:700,
                    color:rc.isKurang?"#1e40af":rc.isLebih?"#7c3aed":"#059669"}}>
                    {rc.isKurang?`Transfer ${rp(Math.abs(rc.selisih))} ke ${trx.submitter}`:rc.isLebih?`Terima ${rp(Math.abs(rc.selisih))} dari ${trx.submitter}`:`Selisih Rp 0 — langsung konfirmasi`}
                  </p>
                  <textarea value={note} onChange={e=>setNote(e.target.value)}
                    placeholder={rc.isKurang?"No. referensi transfer...":rc.isLebih?"Konfirmasi penerimaan kembalian...":"Catatan settlement..."}
                    rows={2} style={{marginBottom:9}}/>
                  <button className="btn bg" onClick={settle} disabled={busy}>
                    {busy?<span className="sp2"/>:<Ic n="check" s={13}/>}
                    {rc.isKurang?"Konfirmasi Sudah Transfer":rc.isLebih?"Konfirmasi Sudah Diterima":"Konfirmasi Lunas"}
                  </button>
                </div>
              )}

              {isFin&&trx.status==="paid"&&trx.type==="cash_advance"&&!trx.oerAmount&&(
                <div style={{marginTop:16,padding:14,background:"var(--amb)",borderRadius:"var(--r2)",border:"1px solid var(--ambd)"}}>
                  <p style={{fontSize:13,fontWeight:700,marginBottom:4,color:"#78350f"}}>⏳ Menunggu OER dari {trx.submitter}</p>
                  <p style={{fontSize:11,color:"#92400e"}}>Karyawan perlu submit OER untuk bisa dilakukan rekonsiliasi dan settlement.</p>
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
  const [data,setData]       = useState(DEMO.map(d=>isOverdue(d)?{...d,status:"overdue"}:d));
  const [selId,setSelId]     = useState(null);
  const [toast,setToast]     = useState(null);
  const [sideOpen,setSideOpen]=useState(false);
  const [loading,setLoading] = useState(false);

  const handleLogin = async (u) => {
    setUser(u);
    if (CONFIG.SCRIPT_URL) {
      setLoading(true);
      const res = await API.getAll();
      if (res?.data?.length) setData(res.data.map(d=>isOverdue(d)?{...d,status:"overdue"}:d));
      setLoading(false);
    }
  };

  const handleLogout = () => { setUser(null); setPage("dashboard"); setData(DEMO); setSideOpen(false); };

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const handleAction = (id, action, noteOrData) => {
    setData(prev=>prev.map(d=>{
      if (d.id!==id) return d;
      if (action==="oer_submitted") {
        const oer = noteOrData;
        const selisih = oer.oerAmount - d.amount;
        const newStatus = selisih > 0 ? "kurang_bayar" : selisih < 0 ? "lebih_bayar" : "settled";
        return {...d, oerAmount:oer.oerAmount, oerCategories:oer.oerCategories, oerNote:oer.oerNote, oerDate:oer.oerDate, status:newStatus};
      }
      const m = {
        approve:  {status:"approved"},
        reject:   {status:"rejected",   financeNote:noteOrData},
        process:  {status:"processing", financeNote:noteOrData},
        pay:      {status:"awaiting_oer",settledDate:today(), financeNote:noteOrData},
        settle:   {settled:true, status:"settled", settledDate:today(), financeNote:noteOrData},
      };
      return {...d, ...m[action]};
    }));
    const msgs = {
      approve:"✓ Pengajuan disetujui", reject:"Pengajuan ditolak",
      process:"✓ Mulai diproses", pay:"✓ CA dicairkan — menunggu OER",
      settle:"✓ Settlement dikonfirmasi — CA lunas",
      oer_submitted:"✓ OER berhasil disubmit — rekonsiliasi selesai",
    };
    showToast(msgs[action]||"Berhasil");
    setSelId(null);
  };

  const handleEdit = (updated) => {
    setData(prev => prev.map(d => d.id===updated.id ? updated : d));
    showToast("✓ Perubahan disimpan");
  };

  const handleSubmit = (entry) => { setData(p=>[entry,...p].map(d=>isOverdue(d)?{...d,status:"overdue"}:d)); showToast(`\u2713 ${entry.id} berhasil dikirim`); setPage("list"); };
  const nav = (p, id) => { if (id) setSelId(id); setPage(p); setSideOpen(false); };

  const pCt = data.filter(d=>d.status==="pending").length;
  const aCt = data.filter(d=>d.status==="approved").length;
  const oCt = data.filter(d=>d.status==="overdue").length;
  const sel = data.find(d=>d.id===selId);

  const NAV = {
    employee:[{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"submit",ic:"plus",lb:"Ajukan Baru"},{id:"list",ic:"list",lb:"Pengajuan Saya"}],
    approver:[{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"approval",ic:"check",lb:"Antrian Approval",bd:pCt},{id:"list",ic:"list",lb:"Semua Pengajuan"}],
    finance: [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"monitor",ic:"chart",lb:"Monitor Finance",bd:aCt||null},{id:"list",ic:"list",lb:"Semua Pengajuan"},{id:"overdue",ic:"alert",lb:"CA Outstanding",bd:oCt||null},{id:"settings",ic:"settings",lb:"Pengaturan"}],
  };
  const TITLES = {dashboard:"Dashboard",submit:"Form Pengajuan",list:"Daftar Pengajuan",approval:"Antrian Approval",monitor:"Monitor Finance",overdue:"CA Outstanding",settings:"Pengaturan"};

  // Show login if not logged in
  if (!user) return (<><style>{CSS}</style><LoginScreen onLogin={handleLogin}/></>);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {sideOpen && <div style={{position:"fixed",inset:0,zIndex:199,background:"rgba(0,0,0,.4)"}} onClick={()=>setSideOpen(false)}/>}

        {/* SIDEBAR */}
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

        {/* MAIN */}
        <div className="main">
          <div className="bar">
            <button className="btn bo sm" onClick={()=>setSideOpen(o=>!o)}><Ic n="menu" s={15}/></button>
            <h1 className="bt">{TITLES[page]||"Dashboard"}</h1>
            <div className="br">
              <span className={`cs ${CONFIG.SCRIPT_URL?"cs-ok":"cs-no"}`}>
                <span style={{width:6,height:6,borderRadius:"50%",background:CONFIG.SCRIPT_URL?"var(--gn)":"var(--am)",display:"inline-block"}}/>
                {CONFIG.SCRIPT_URL?"Sheets ✓":"Lokal"}
              </span>
              {user.role==="employee"&&page!=="submit"&&<button className="btn bp sm" onClick={()=>nav("submit")}><Ic n="plus" s={13}/>Ajukan</button>}
              {CONFIG.SCRIPT_URL&&<button className="btn bo sm" title="Refresh data" onClick={()=>{setLoading(true);API.getAll().then(r=>{if(r?.data?.length)setData(r.data);setLoading(false);});}}><Ic n="refresh" s={13}/></button>}
            </div>
          </div>

          <div className="page">
            {loading ? (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:280,gap:12,color:"var(--i3)"}}>
                <div style={{width:22,height:22,border:"3px solid var(--ln)",borderTopColor:"var(--tl)",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>
                <span>Memuat data...</span>
              </div>
            ) : (
              <>
                {page==="dashboard" && <Dashboard data={data} user={user} nav={nav}/>}
                {page==="submit"    && <SubmitPage user={user} onSubmit={handleSubmit} data={data}/>}
                {page==="list"      && <ListPage data={data} user={user} onSel={id=>setSelId(id)}/>}
                {page==="approval"  && <ApprovalPage data={data} onAction={handleAction} onSel={(id)=>{setSelId(id);}} user={user}/>}
                {page==="monitor"   && <MonitorPage data={data} onSel={id=>setSelId(id)}/>}
                {page==="settings"  && <SettingsPage onSave={()=>showToast("✓ Pengaturan disimpan")}/>}
                {page==="overdue"   && (
                  <div>
                    <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><strong>CA Outstanding — SLA: maks 5 hari kerja setelah trip selesai.</strong></div>
                    <div className="card">
                      <div className="ch"><h3>CA Belum Selesai</h3></div>
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
                              <td><SBadge s={d.status}/></td>
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
