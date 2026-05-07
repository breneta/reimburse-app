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
const ddiff = (a,b) => Math.round((new Date(b)-new Date(a))/864e5);

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
  let days = 0, cur = new Date(end); cur.setDate(cur.getDate()+1);
  while (cur <= now) { if (cur.getDay()!==0 && cur.getDay()!==6) days++; cur.setDate(cur.getDate()+1); }
  return days;
};

const isOverdue = (d) => {
  if (!d.dateEnd) return false;
  if (d.type === "cash_advance") {
    const OER_SUBMITTED = ["oer_doc_pending","oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","awaiting_confirm","employee_confirmed","settled"];
    if (OER_SUBMITTED.includes(d.status) || d.oerDate) return false;
    const PRE_DISBURSE = ["pending","doc_received_lk","doc_sent_jkt","doc_received_jkt","doc_complete","approved","processing","rejected"];
    if (PRE_DISBURSE.includes(d.status)) return false;
    return workdaysSinceEnd(d.dateEnd) > 5;
  }
  if (d.type === "reimburse") {
    if (!d.submitted) return false;
    let end = new Date(d.dateEnd); end.setHours(0,0,0,0);
    let sub = new Date(d.submitted); sub.setHours(0,0,0,0);
    let days = 0, cur = new Date(end); cur.setDate(cur.getDate()+1);
    while (cur <= sub) { if (cur.getDay()!==0 && cur.getDay()!==6) days++; cur.setDate(cur.getDate()+1); }
    return days > 5;
  }
  return false;
};
const withLateFlagOnly = (d) => ({ ...d, isLate: isOverdue(d) });

// ── API ──────────────────────────────────────────────────────
const SB = {
  async req(method, path, body=null, params=null) {
    if (!isReady()) return null;
    try {
      let url = CONFIG.SUPABASE_URL + "/rest/v1/" + path;
      if (params) { const qs = Object.entries(params).map(([k,v])=>k+"="+encodeURIComponent(v)).join("&"); url += "?" + qs; }
      const headers = { "apikey": CONFIG.SUPABASE_KEY, "Authorization": "Bearer " + CONFIG.SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=representation" };
      const f = { method, headers }; if (body && method !== "GET") f.body = JSON.stringify(body);
      const r = await fetch(url, f); const txt = await r.text();
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
    const p = { status: "doc_complete", ga_note: note||"" }; if (amt) p.oer_amount = amt; return SB.update(id, p);
  },
  oerDocComplete: (id, note, ca, oer) => {
    const sel = (oer||0) - ca; const s = sel > 0 ? "kurang_bayar" : sel < 0 ? "lebih_bayar" : "settled";
    return SB.update(id, { status: s, ga_oer_note: note||"", settled: s==="settled" });
  },
  submitOer: (id, d) => SB.update(id, { oer_amount:d.oerAmount, oer_categories:d.oerCategories, oer_note:d.oerNote||"", oer_date:d.oerDate||today(), status:"oer_doc_pending" }),
  updateOer: (id, cats, note, ca) => {
    const amt = cats.reduce((s,it)=>s+(it.amt||0),0); const sel = amt - ca; const s = sel > 0 ? "kurang_bayar" : sel < 0 ? "lebih_bayar" : "settled";
    return SB.update(id, { oer_amount: amt, oer_categories: cats, oer_note: note||"", status: s });
  }
};

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

const PwInput = ({ value, onChange, placeholder, showState, toggleShow, onEnter }) => (
  <div style={{position:"relative"}}>
    <input type={showState?"text":"password"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} onKeyDown={e=>e.key==="Enter"&&onEnter&&onEnter()} style={{paddingRight:42}}/>
    <button onClick={e=>{e.preventDefault();toggleShow();}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--i3)"}}>{showState?"🙈":"👁️"}</button>
  </div>
);

function LoginScreen({ onLogin }) {
  const [tab,setTab] = useState("karyawan"); const [mode,setMode] = useState("login");
  const [err,setErr] = useState(""); const [show,setShow] = useState(false); const [show2,setShow2] = useState(false);
  const [username,setUsername] = useState(""); const [pass,setPass] = useState("");
  const [regName,setRegName] = useState(""); const [regDept,setRegDept] = useState(""); const [regArea,setRegArea] = useState(""); const [regUser,setRegUser] = useState(""); const [regPass,setRegPass] = useState(""); const [regPass2,setRegPass2] = useState("");
  const [role,setRole] = useState("admin_lk"); const [staffPass,setStaffPass]=useState("");
  const clr = () => setErr(""); const [busy2,setBusy2] = useState(false);

  const doRegister = async () => {
    if (!regName.trim()||!regDept||!regArea||!regUser.trim()||regPass.length<4||regPass!==regPass2) return setErr("Lengkapi data dengan benar");
    const ukey = regUser.toLowerCase().trim(); const av = regName.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    setBusy2(true); const res = isReady() ? await API.registerAcc({username:ukey, name:regName.trim(), dept:regDept, area:regArea, password:regPass}) : {ok:true};
    setBusy2(false); if (res && res.ok) onLogin({ name:regName.trim(), dept:regDept, area:regArea, role:"employee", avatar:av, username:ukey }); else setErr(res?.error||"Gagal daftar");
  };
  const doLogin = async () => {
    if (!username.trim()||!pass) return setErr("Isi username & password");
    setBusy2(true); const res = isReady() ? await API.loginAcc(username.trim(), pass) : {ok:false};
    setBusy2(false); if (res && res.ok) onLogin({ ...res, role:"employee", avatar:res.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) }); else setErr("Gagal login");
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
        <div style={{textAlign:"center",marginBottom:24}}><div className="l-ico">💼</div><h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontStyle:"italic"}}>ReimburseApp</h1><p style={{fontSize:12,color:"var(--i3)",marginTop:3}}>Sistem Reimburse & Cash Advance</p></div>
        <div className="l-tabs">{[["karyawan","👤 Karyawan"],["staff","🔐 Admin / GA"]].map(([v,l])=>(<button key={v} className={`l-tab${tab===v?" on":""}`} onClick={()=>{setTab(v);setErr("");setMode("login");}}>{l}</button>))}</div>
        {err && <div className="l-err"><Ic n="x" s={13} c="#dc2626"/>{err}</div>}
        {tab==="karyawan" && mode==="login" && (
          <><div className="l-fld"><label>Username</label><input value={username} onChange={e=>{setUsername(e.target.value);clr();}} placeholder="Username" autoFocus/></div>
            <div className="l-fld"><label>Password</label><PwInput value={pass} onChange={v=>{setPass(v);clr();}} placeholder="Password" showState={show} toggleShow={()=>setShow(s=>!s)} onEnter={doLogin}/></div>
            <button className="l-btn" onClick={doLogin} disabled={busy2}>{busy2?<span className="sp2"/>:"Masuk →"}</button>
            <div style={{textAlign:"center",marginTop:14}}><span style={{fontSize:12.5,color:"var(--i3)"}}>Belum punya akun? </span><button onClick={()=>{setMode("register");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,color:"var(--tl)"}}>Daftar</button></div></>
        )}
        {tab==="karyawan" && mode==="register" && (
          <><div className="l-fld"><label>Nama Lengkap *</label><input value={regName} onChange={e=>{setRegName(e.target.value);clr();}} placeholder="Nama lengkap"/></div>
            <div className="l-fld"><label>Departemen *</label><select value={regDept} onChange={e=>setRegDept(e.target.value)}><option value="">-- Pilih --</option>{DEPTS.map(d=><option key={d}>{d}</option>)}</select></div>
            <div className="l-fld"><label>Area *</label><select value={regArea} onChange={e=>setRegArea(e.target.value)}><option value="">-- Pilih --</option>{AREAS.map(a=><option key={a}>{a}</option>)}</select></div>
            <div className="l-fld"><label>Username *</label><input value={regUser} onChange={e=>{setRegUser(e.target.value);clr();}} placeholder="Username"/></div>
            <div className="l-fld"><label>Password *</label><PwInput value={regPass} onChange={v=>{setRegPass(v);clr();}} placeholder="Min. 4 karakter" showState={show} toggleShow={()=>setShow(s=>!s)}/></div>
            <div className="l-fld"><label>Konfirmasi Password *</label><PwInput value={regPass2} onChange={v=>{setRegPass2(v);clr();}} placeholder="Ulangi" showState={show2} toggleShow={()=>setShow2(s=>!s)} onEnter={doRegister}/></div>
            <button className="l-btn" onClick={doRegister} disabled={busy2}>{busy2?<span className="sp2"/>:"Daftar →"}</button>
            <div style={{textAlign:"center",marginTop:14}}><span style={{fontSize:12.5,color:"var(--i3)"}}>Punya akun? </span><button onClick={()=>{setMode("login");setErr("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,color:"var(--tl)"}}>Login</button></div></>
        )}
        {tab==="staff" && (
          <><div className="l-fld"><label>Login sebagai</label><select value={role} onChange={e=>setRole(e.target.value)}><option value="admin_lk">📦 Admin LK</option><option value="admin_jkt">🏢 Admin JKT</option><option value="ga">🗂 GA</option><option value="finance">💼 Finance</option></select></div>
            <div className="l-fld"><label>Password *</label><PwInput value={staffPass} onChange={v=>{setStaffPass(v);clr();}} placeholder="Password" showState={show} toggleShow={()=>setShow(s=>!s)} onEnter={doStaff}/></div>
            <button className="l-btn" onClick={doStaff}>Masuk →</button></>
        )}
      </div>
    </div>
  );
}

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
        <div style={{position:"relative"}}><p style={{fontSize:10,fontWeight:800,textTransform:"uppercase",color:"var(--tl2)"}}>Selamat datang</p><h2 style={{fontSize:20,fontWeight:800}}>{user.name}</h2><p style={{fontSize:12.5,color:"rgba(255,255,255,.5)"}}>{user.dept} · {user.area} · {user.role}</p></div>
      </div>
      {overdue.length>0 && <div className="al ae mb4"><Ic n="alert" s={14} c="#dc2626"/><span><strong>{overdue.length} Pengajuan Terlambat</strong> — lewati batas 5 hari kerja!</span></div>}
      {kurangBayar.map(d=>(
        <div key={d.id} className="al ab mb3" style={{background:"linear-gradient(135deg,#1e40af,#3b82f6)",color:"white"}}><div style={{flex:1}}><p style={{fontWeight:800}}>Konfirmasi Nominal — {d.id}</p><p style={{fontSize:12}}>Finance akan transfer <strong style={{color:"#fde68a"}}>{rp(Math.abs((d.oerAmount||0)-d.amount))}</strong> kepadamu.</p></div><button className="btn sm" onClick={()=>nav("list")} style={{background:"white",color:"#1e40af"}}>Lihat →</button></div>
      ))}
      {lebihBayar.map(d=>(
        <div key={d.id} className="al aw mb3" style={{background:"linear-gradient(135deg,#7c3aed,#8b5cf6)",color:"white"}}><div style={{flex:1}}><p style={{fontWeight:800}}>Pengembalian Sisa — {d.id}</p><p style={{fontSize:12}}>Kamu harus transfer sisa <strong style={{color:"#fde68a"}}>{rp(Math.abs((d.oerAmount||0)-d.amount))}</strong> ke perusahaan dan kirim bukti via WA.</p></div><button className="btn sm" onClick={()=>nav("list")} style={{background:"white",color:"#7c3aed"}}>Lihat →</button></div>
      ))}
      <div className="sg"><div className="st tl"><div className="sl">Total Diajukan</div><div className="sv md">{rp(mine.reduce((a,d)=>a+d.amount,0))}</div></div><div className="st gn"><div className="sl">Sudah Lunas</div><div className="sv md">{rp(mine.filter(d=>d.status==="paid"||d.status==="settled").reduce((a,d)=>a+d.amount,0))}</div></div></div>
      <div className="card mt4"><div className="ch"><h3>Pengajuan Terbaru</h3><button className="btn bo sm" onClick={()=>nav("list")}>Lihat Semua</button></div><div className="tw"><table><thead><tr><th>ID</th><th>Jenis</th><th>Keperluan</th><th>Jumlah</th><th>Status</th></tr></thead><tbody>{mine.slice(0,5).map(d=>(<tr key={d.id} onClick={()=>nav("detail",d.id)}><td><span className="mono">{d.id}</span></td><td><TTag t={d.type}/></td><td><div className="trunc" style={{maxWidth:180}}>{d.purpose}</div></td><td className="bold">{rp(d.amount)}</td><td><SBadge s={d.status} trx={d} isOwner={user.role==="employee"}/><LateBadge d={d}/></td></tr>))}</tbody></table></div></div>
    </div>
  );
}

function SubmitPage({ user, onSubmit, data }) {
  const [f,setF] = useState({type:"reimburse",purpose:"",destination:"Jakarta",dateStart:"",dateEnd:"",approverName:"",notes:"",caRef:"",docRoute:"admin_jkt",items:[{cat:"Perjalanan Dinas",amt:""}]});
  const [busy,setBusy] = useState(false); const set=(k,v)=>setF(p=>({...p,[k]:v})); const si=(i,k,v)=>setF(p=>{const n=[...p.items];n[i]={...n[i],[k]:v};return{...p,items:n};});
  const total = f.items.reduce((a,it)=>a+(parseFloat(it.amt)||0),0);
  const myCAs = data.filter(d=>d.type==="cash_advance" && (d.submitterUsername===user.username||d.submitter===user.name) && ["paid","awaiting_oer"].includes(d.status) && !d.oerAmount);

  const submit = async () => {
    if (!f.purpose||!f.dateStart||!f.dateEnd||!f.approverName||total===0) return alert("Lengkapi data wajib (*)");
    const entry = { id:gid(), ...f, submitter:user.name, submitterUsername:user.username||"", dept:user.dept, area:user.area||"Jakarta", amount:total, submitted:today(), categories:f.items.map(it=>({cat:it.cat,amt:parseFloat(it.amt)||0})) };
    setBusy(true); if (isReady()) await API.create(entry); setBusy(false); onSubmit(entry);
  };

  return (
    <div className="card"><div className="ch"><h3>Form Pengajuan</h3></div><div className="cb">
      <div className="fs mb4" style={{border:"2px solid var(--tl)",background:"var(--tlb)"}}><div className="fst">📬 Jalur Dokumen *</div><div style={{display:"flex",gap:9}}>{[["admin_jkt","🏢 Jakarta (Langsung)"],["admin_lk","📦 Luar Kota (Kirim)"]].map(([v,l])=>(<label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:12,border:`2px solid ${f.docRoute===v?"var(--tl)":"var(--ln)"}`,borderRadius:10,background:"white"}}><input type="radio" checked={f.docRoute===v} onChange={()=>set("docRoute",v)} style={{width:"auto"}}/><div><div className="bold">{l}</div></div></label>))}</div></div>
      <div className="fs mb4"><div className="fst">Jenis *</div><div style={{display:"flex",gap:9}}>{[["reimburse","💰 Reimburse"],["cash_advance","🏦 Cash Advance"]].map(([v,l])=>(<label key={v} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:12,border:`2px solid ${f.type===v?"var(--tl)":"var(--ln)"}`,borderRadius:10,background:"white"}}><input type="radio" checked={f.type===v} onChange={()=>set("type",v)} style={{width:"auto"}}/><div className="bold">{l}</div></label>))}</div>
      {f.type==="reimburse" && myCAs.length>0 && <div className="mt3"><label className="fl">🔗 Link ke CA</label><select value={f.caRef} onChange={e=>set("caRef",e.target.value)}><option value="">-- Pilih --</option>{myCAs.map(ca=><option key={ca.id} value={ca.id}>{ca.id} · {ca.purpose}</option>)}</select></div>}</div>
      <div className="fs mb4"><div className="fst">Detail Perjalanan</div><div className="fg mb3"><label className="fl">Keperluan *</label><textarea value={f.purpose} onChange={e=>set("purpose",e.target.value)} rows={2}/></div><div className="fg fg3"><div><label className="fl">Kota Tujuan *</label><input value={f.destination} onChange={e=>set("destination",e.target.value)}/></div><div><label className="fl">Tgl Mulai *</label><input type="date" value={f.dateStart} onChange={e=>set("dateStart",e.target.value)}/></div><div><label className="fl">Tgl Selesai *</label><input type="date" value={f.dateEnd} onChange={e=>set("dateEnd",e.target.value)}/></div></div></div>
      <div className="fs mb4"><div className="fst">Biaya</div>{f.items.map((it,i)=>(<div key={i} style={{display:"flex",gap:9,marginBottom:8}}><select value={it.cat} onChange={e=>si(i,"cat",e.target.value)} style={{flex:2}}>{CATS.map(c=><option key={c}>{c}</option>)}</select><input type="number" value={it.amt} onChange={e=>si(i,"amt",e.target.value)} placeholder="0" style={{flex:1.5}}/>{f.items.length>1 && <button className="btn bo xs" onClick={()=>setF(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))}>✕</button>}</div>))}<button className="btn bo sm" onClick={()=>setF(p=>({...p,items:[...p.items,{cat:"Perjalanan Dinas",amt:""}]}))}>+ Item</button><div className="mt3 bold" style={{fontSize:16,textAlign:"right"}}>{rp(total)}</div></div>
      <div className="fs mb4"><div className="fst">Nama Admin Penerima *</div><input value={f.approverName} onChange={e=>set("approverName",e.target.value)} placeholder="Admin Jakarta / LK"/></div>
      <div style={{textAlign:"right"}}><button className="btn bp" onClick={submit} disabled={busy}>{busy?"Memproses...":"Kirim Pengajuan"}</button></div>
    </div></div>
  );
}

function AdminLKQueue({ data, onAction, onSel }) {
  const [adminName, setAdminName] = useState(""); const [q, setQ] = useState("");
  const queue = data.filter(d => d.status === "pending" && d.docRoute === "admin_lk").filter(d => !q || d.submitter.toLowerCase().includes(q.toLowerCase()));
  const received = data.filter(d => d.status === "doc_received_lk").filter(d => !q || d.submitter.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="card mb3"><div className="cb fg fg2"><div><label className="fl">Cari Pemohon</label><input value={q} onChange={e=>setQ(e.target.value)}/></div><div><label className="fl">Admin LK Bertugas *</label><input value={adminName} onChange={e=>setAdminName(e.target.value)} placeholder="Nama Anda"/></div></div></div>
      <div className="card mb3"><div className="ch"><h3>Menunggu Dokumen</h3></div><div className="tw"><table><thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead><tbody>{queue.map(d=>(<tr key={d.id} onClick={()=>onSel(d.id)}><td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td><td><div className="trunc" style={{maxWidth:130}}>{d.purpose}</div></td><td><div className="bold">{d.destination}</div><div style={{fontSize:11}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td><td><button className="btn bg xs" onClick={e=>{e.stopPropagation(); if(!adminName)return alert("Isi nama admin"); onAction(d.id,"doc_received_lk",adminName); API.docReceivedLK(d.id,adminName);}}>Terima</button></td></tr>))}</tbody></table></div></div>
      {received.length>0 && <div className="card"><div className="ch"><h3>Siap Kirim ke Jakarta</h3></div><div className="tw"><table><thead><tr><th>ID</th><th>Pemohon</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead><tbody>{received.map(d=>(<tr key={d.id} onClick={()=>onSel(d.id)}><td><span className="mono">{d.id}</span></td><td>{d.submitter}</td><td>{d.destination} ({fd(d.dateEnd)})</td><td><button className="btn bp xs" onClick={e=>{e.stopPropagation(); onAction(d.id,"doc_sent_jkt"); API.docSentJkt(d.id);}}>✈️ Kirim JKT</button></td></tr>))}</tbody></table></div></div>}
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
      <div className="card mb3"><div className="ch"><h3>Dari Luar Kota / Langsung</h3></div><div className="tw"><table><thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead><tbody>{[...queue,...direct].map(d=>(<tr key={d.id} onClick={()=>onSel(d.id)}><td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td><td>{d.purpose}</td><td><div className="bold">{d.destination}</div><div style={{fontSize:11}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td><td><button className="btn bg xs" onClick={e=>{e.stopPropagation(); doRec(d.id);}}>Terima</button></td></tr>))}</tbody></table></div></div>
      {oerQueue.length>0 && <div className="card"><div className="ch"><h3>OER Masuk</h3></div><div className="tw"><table><thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead><tbody>{oerQueue.map(d=>(<tr key={d.id} onClick={()=>onSel(d.id)}><td><span className="mono">{d.id}</span></td><td>{d.submitter}</td><td>{d.purpose}</td><td>{d.destination} ({fd(d.dateEnd)})</td><td><button className="btn bg xs" onClick={e=>{e.stopPropagation(); if(!adminName)return alert("Admin?"); onAction(d.id,"oer_doc_received",adminName); API.oerDocReceived(d.id,adminName);}}>Terima OER</button></td></tr>))}</tbody></table></div></div>}
    </div>
  );
}

function GAQueue({ data, onAction, onSel }) {
  const [gaNote, setGaNote] = useState("");
  const queue = data.filter(d => d.status === "doc_received_jkt");
  const oerQueue = data.filter(d => d.status === "oer_doc_received");
  return (
    <div>
      <div className="card mb3"><div className="ch"><h3>Antrian GA</h3></div><div className="tw"><table><thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Tujuan & Tanggal</th><th>Aksi</th></tr></thead><tbody>{queue.map(d=>(<tr key={d.id} onClick={()=>onSel(d.id)}><td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td><td>{d.purpose}</td><td><div className="bold">{d.destination}</div><div style={{fontSize:11}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td><td><button className="btn bg xs" onClick={e=>{e.stopPropagation(); onAction(d.id,"doc_complete",gaNote); API.docComplete(d.id,null,gaNote);}}>✓ Lengkap</button></td></tr>))}</tbody></table></div></div>
      {oerQueue.length>0 && <div className="card"><div className="ch"><h3 style={{color:"#7c3aed"}}>OER Dokumen — Perlu Approve</h3></div><div className="tw"><table><thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Tujuan & Tanggal</th><th>Selisih</th><th>Aksi</th></tr></thead><tbody>{oerQueue.map(d=>{const sel = (d.oerAmount||0)-d.amount; return(<tr key={d.id} onClick={()=>onSel(d.id)}><td><span className="mono">{d.id}</span></td><td>{d.submitter}</td><td>{d.purpose}</td><td>{d.destination}</td><td className="bold" style={{color:sel<0?"#7c3aed":"#059669"}}>{sel<0?`Lebih ${rp(Math.abs(sel))}`:sel>0?`Kurang ${rp(sel)}`:"Pas"}</td><td><button className="btn bg xs" style={{background:"#7c3aed"}} onClick={e=>{e.stopPropagation(); onAction(d.id,"oer_doc_complete",gaNote); API.oerDocComplete(d.id,gaNote,d.amount,d.oerAmount);}}>Approve OER</button></td></tr>);})}</tbody></table></div></div>}
    </div>
  );
}

function MonitorPage({ data, onSel, onAction }) {
  const overdue = data.filter(d=>d.isLate===true);
  const actionable = data.filter(d=>["doc_complete","approved","processing","kurang_bayar","lebih_bayar","employee_confirmed"].includes(d.status) && !d.settled);
  const caOut = data.filter(d=>d.type==="cash_advance" && !d.settled && !["rejected"].includes(d.status));
  return (
    <div>
      <div className="sg"><div className="st tl"><div className="sl">Total Antrian</div><div className="sv">{actionable.length}</div></div><div className="st rd"><div className="sl">Terlambat</div><div className="sv">{overdue.length}</div></div></div>
      <div className="card mt4"><div className="ch"><h3>Perlu Ditindak Finance</h3></div><div className="tw"><table><thead><tr><th>ID</th><th>Pemohon</th><th>Keperluan</th><th>Tujuan & Tanggal</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{actionable.map(d=>(<tr key={d.id} onClick={()=>onSel(d.id)}><td><span className="mono">{d.id}</span></td><td><div className="bold">{d.submitter}</div></td><td>{d.purpose}</td><td><div className="bold">{d.destination}</div><div style={{fontSize:11}}>{fd(d.dateStart)} - {fd(d.dateEnd)}</div></td><td className="bold">{rp(d.amount)}</td><td><SBadge s={d.status}/></td><td><button className="btn bo xs" onClick={()=>onSel(d.id)}>Buka Settle</button></td></tr>))}</tbody></table></div></div>
      <div className="card mt4"><div className="ch"><h3>CA Outstanding</h3></div><div style={{maxHeight:300,overflowY:"auto"}}>{caOut.map(d=>(<div key={d.id} onClick={()=>onSel(d.id)} style={{padding:12,borderBottom:"1px solid var(--ln)",cursor:"pointer",display:"flex",justifyContent:"space-between"}}><div style={{flex:1}}><span className="mono">{d.id}</span><div className="bold">{d.submitter}</div><div style={{fontSize:11,color:"var(--i3)"}}>{d.destination} | {fd(d.dateStart)} - {fd(d.dateEnd)}</div></div><div style={{textAlign:"right"}}><div className="bold">{rp(d.amount)}</div><SBadge s={d.status}/><LateBadge d={d}/></div></div>))}{caOut.length===0&&<div className="empty">Semua CA settle 🎉</div>}</div></div>
    </div>
  );
}

function SettingsPage({ onSave }) {
  const [sbUrl,setUrl] = useState(CONFIG.SUPABASE_URL); const [sbKey,setKey] = useState(CONFIG.SUPABASE_KEY);
  const save = () => { CONFIG.SUPABASE_URL=sbUrl.trim(); CONFIG.SUPABASE_KEY=sbKey.trim(); _saveConfig({ ..._loadConfig(), SUPABASE_URL:sbUrl.trim(), SUPABASE_KEY:sbKey.trim() }); onSave(); };
  return (
    <div className="card"><div className="ch"><h3>Koneksi Supabase</h3></div><div className="cb"><div className="fg mb3"><label className="fl">URL</label><input value={sbUrl} onChange={e=>setUrl(e.target.value)}/></div><div className="fg mb3"><label className="fl">Key</label><input value={sbKey} onChange={e=>setKey(e.target.value)}/></div><button className="btn bp" onClick={save}>Simpan</button></div></div>
  );
}

function OerReconBox({ trx, rc, isFin, isOwner, onAction }) {
  const [editMode, setEditMode] = useState(false); const [items, setItems] = useState(OER_CATS.map(cat => ({ cat, amt: (trx.oerCategories||[]).find(x=>x.cat===cat) ? String((trx.oerCategories||[]).find(x=>x.cat===cat).amt) : "" })));
  const [oerNote, setOerNote] = useState(trx.oerNote||""); const editTotal = items.reduce((s,it)=>s+(parseFloat(it.amt)||0),0);
  const editRc = editMode ? (() => { const sel = editTotal - trx.amount; return { ca:trx.amount, oer:editTotal, selisih:sel, isKurang:sel>0, isLebih:sel<0, isLunas:sel===0 }; })() : rc;
  const saveEdit = () => { const cats = items.filter(it=>parseFloat(it.amt)>0).map(it=>({cat:it.cat,amt:parseFloat(it.amt)})); onAction(trx.id, "edit_oer", {oerCategories:cats, oerNote, caAmount:trx.amount}); API.updateOer(trx.id, cats, oerNote, trx.amount); setEditMode(false); };
  
  const colV = editRc.isKurang?"#1e40af":editRc.isLebih?"#7c3aed":"#059669";
  return (
    <div style={{marginBottom:16,border:`2px solid ${editRc.isLebih?"#c4b5fd":"#93c5fd"}`,borderRadius:10,overflow:"hidden"}}>
      <div style={{padding:"9px 14px",background:editRc.isLebih?"#ede9fe":"#dbeafe",fontWeight:800,fontSize:12,display:"flex",justifyContent:"space-between"}}><span>📊 Rekonsiliasi</span>{isFin && !trx.settled && <button className="btn bo sm" onClick={()=>setEditMode(!editMode)}>{editMode?"Batal":"Edit"}</button>}</div>
      <div style={{padding:14}}>
        {editMode ? (
          <>{items.map((it,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12}}>{it.cat}</span><input type="number" value={it.amt} onChange={e=>{const n=[...items];n[i].amt=e.target.value;setItems(n);}} style={{width:100,textAlign:"right"}}/></div>))}<div style={{textAlign:"right"}}><button className="btn bg mt2" onClick={saveEdit}>Simpan</button></div></>
        ) : (
          <><div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>CA</span><span>{rp(rc.ca)}</span></div><div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span>OER</span><span>{rp(rc.oer)}</span></div><div style={{height:1,background:"var(--ln)",margin:"8px 0"}}/><div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,color:colV}}><span>{rc.isKurang?"Finance bayar kamu":rc.isLebih?"Kamu bayar perusahaan":"Pas"}</span><span>{rp(Math.abs(rc.selisih))}</span></div>
            {isOwner && !trx.settled && rc.isLebih && <div className="al aw mt3" style={{fontSize:11}}><strong>Instruksi:</strong> Transfer {rp(Math.abs(rc.selisih))} ke perusahaan dan kirim bukti via WhatsApp.</div>}
            {isFin && !trx.settled && (trx.status==="lebih_bayar"||trx.status==="employee_confirmed") && <div className="mt3"><button className="btn bg sm" style={{width:"100%",background:rc.isLebih?"#7c3aed":"#059669"}} onClick={()=>onAction(trx.id,"settle",rc.isLebih?"Dana diterima via WA":"Sudah transfer ke karyawan")}>Konfirmasi & Selesaikan</button></div>}
            {isFin && trx.status==="kurang_bayar" && <div className="mt3"><button className="btn bp sm" style={{width:"100%"}} onClick={()=>{onAction(trx.id,"awaiting_confirm"); API.updateStatus(trx.id,{status:"awaiting_confirm"});}}>Kirim Konfirmasi ke Karyawan</button></div>}
            {isOwner && trx.status==="awaiting_confirm" && rc.isKurang && <div className="mt3"><button className="btn bg sm" style={{width:"100%"}} onClick={()=>{onAction(trx.id,"employee_confirmed"); API.updateStatus(trx.id,{status:"employee_confirmed"});}}>✓ Setuju & Konfirmasi</button></div>}
          </>
        )}
      </div>
    </div>
  );
}

function DetailModal({ trx, user, onClose, onAction, onEdit }) {
  const [note,setNote] = useState(""); const [tDate,setTDate] = useState(trx.transferDate||""); const [busy,setBusy] = useState(false);
  const isFin = user.role==="finance"; const isOwner = user.role==="employee" && (trx.submitterUsername===user.username || trx.submitter===user.name);
  const rc = recon(trx);
  
  const tlBase = [
    {ok:true, icon:"send", title:"Pengajuan Dikirim", sub:`${trx.submitter} · ${fd(trx.submitted)}`, col:"var(--tl)"},
    {ok:!!trx.adminLkName || ["doc_received_jkt","doc_complete","approved","processing","paid","settled"].includes(trx.status), icon:"user", title:"Diterima Admin LK", sub:trx.adminLkName||"—", col:"var(--tl)"},
    {ok:["doc_sent_jkt","doc_received_jkt","doc_complete","approved","processing","paid","settled"].includes(trx.status), icon:"send", title:"Dikirim ke Jakarta", sub:"", col:"var(--bl)"},
    {ok:["doc_received_jkt","doc_complete","approved","processing","paid","settled"].includes(trx.status), icon:"user", title:"Diterima Admin JKT", sub:trx.adminJktName||"—", col:"var(--tl)"},
    {ok:["doc_complete","approved","processing","paid","settled"].includes(trx.status), icon:"check", title:"Dokumen Lengkap (GA)", sub:trx.gaNote||"—", col:"var(--gn)"},
    {ok:["processing","paid","settled","awaiting_oer","kurang_bayar","lebih_bayar"].includes(trx.status), icon:"money", title:"Diproses Finance", sub:"", col:"var(--pu)"},
  ];
  const tl = trx.type==="cash_advance" ? [
    ...tlBase,
    {ok:["paid","awaiting_oer","oer_doc_pending","oer_doc_received","oer_doc_complete","kurang_bayar","lebih_bayar","settled"].includes(trx.status), icon:"check", title:"CA Dicairkan", sub:trx.settledDate?`Dibayar ${fd(trx.settledDate)}`:"", col:"var(--gn)"},
    {ok:!!trx.oerDate, icon:"send", title:"OER Disubmit", sub:trx.oerDate?`${fd(trx.oerDate)} · ${rp(trx.oerAmount)}`:"", col:"#ca8a04"},
    {ok:trx.settled||trx.status==="settled", icon:"check", title:"Selesai", sub:trx.settled?`Lunas ${fd(trx.settledDate)}`:"", col:"var(--gn)"}
  ] : [
    ...tlBase,
    {ok:trx.status==="paid"||trx.settled, icon:"check", title:"Pembayaran Selesai", sub:trx.settledDate?`Lunas ${fd(trx.settledDate)}`:"", col:"var(--gn)"}
  ];

  const act = (a, n, d) => { setBusy(true); onAction(trx.id, a, n, trx.type, d); const s = a==="pay" ? (trx.type==="cash_advance"?"awaiting_oer":"paid") : "processing"; API.updateStatus(trx.id, {status:s, finance_note:n, transfer_date:d, settled_date:today()}); setBusy(false); };

  return (
    <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="mo"><div className="mh"><div><span className="mono">{trx.id}</span><h2 style={{fontSize:15,fontWeight:800}}>{trx.purpose}</h2></div><button className="btn bo sm" onClick={onClose}>✕</button></div>
      <div className="mb2">
        <div style={{display:"flex",gap:7,alignItems:"center",padding:10,background:"var(--ln2)",borderRadius:10,marginBottom:16}}><TTag t={trx.type}/><SBadge s={trx.status} trx={trx} isOwner={isOwner}/><LateBadge d={trx}/></div>
        <div className="g2 mb4"><div><p className="sl">Pemohon</p><p className="bold">{trx.submitter}</p><p style={{fontSize:12}}>{trx.dept}</p></div><div><p className="sl">Perjalanan</p><p className="bold">{trx.destination}</p><p style={{fontSize:12}}>{fd(trx.dateStart)} – {fd(trx.dateEnd)}</p></div></div>
        <div className="fs mb4"><div className="fst">Rincian</div>{trx.categories.map((c,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}><span>{c.cat}</span><span className="bold">{rp(c.amt)}</span></div>))}<div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"2px solid var(--tl)"}}><span className="bold">TOTAL</span><span className="bold" style={{fontSize:16}}>{rp(trx.amount)}</span></div></div>
        {trx.type==="cash_advance" && rc && <OerReconBox trx={trx} rc={rc} isFin={isFin} isOwner={isOwner} onAction={onAction}/>}
        <p className="sl mb3">Progress</p><div>{tl.map((t,i)=>(<div key={i} className="tlr"><div className="tldc"><div className="tld" style={{background:t.ok?t.col:"var(--ln)"}}><Ic n={t.icon} s={12} c={t.ok?"#fff":"var(--i4)"}/></div>{i<tl.length-1&&<div className="tlln"/>}</div><div className="tlb"><div className="tlt" style={{color:t.ok?"var(--ink)":"var(--i4)"}}>{t.title}</div><div className="tls">{t.sub}</div></div></div>))}</div>
        {isFin && ["approved","doc_complete"].includes(trx.status) && <div className="mt4 fs"><div className="fst">Mulai Proses</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan..." rows={2}/><button className="btn bp mt2" onClick={()=>act("process",note)}>Proses</button></div>}
        {isFin && trx.status==="processing" && <div className="mt4 fs"><div className="fst">Konfirmasi Bayar</div><p style={{fontSize:12,marginBottom:8}}>Transfer ke: <strong>{trx.submitter}</strong></p><label className="fl">Tgl Masuk Rekening (Opsional)</label><input type="date" value={tDate} onChange={e=>setTDate(e.target.value)}/><button className="btn bg mt2" onClick={()=>act("pay",note,tDate)}>Tandai Dibayar</button></div>}
        {isOwner && trx.type==="cash_advance" && ["paid","awaiting_oer"].includes(trx.status) && !trx.oerAmount && <div className="mt4 fs"><div className="fst">Submit OER</div><p style={{fontSize:12,marginBottom:8}}>Trip selesai. Masukkan rincian pengeluaran aktual untuk rekonsiliasi.</p><button className="btn bp sm" onClick={()=>{const n = prompt("Total pengeluaran?"); if(n){const d={oerAmount:parseFloat(n),oerCategories:[{cat:"Lain-lain",amt:parseFloat(n)}],oerDate:today()}; onAction(trx.id,"oer_submitted",d); API.submitOer(trx.id,d);}}}>Isi OER (Simple)</button></div>}
      </div></div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser] = useState(null); const [page,setPage] = useState("dashboard"); const [data,setData] = useState([]);
  const [selId,setSelId] = useState(null); const [toast,setToast] = useState(null); const [loading,setLoading] = useState(false);

  const reloadData = async () => { if(!isReady())return; const res = await API.getAll(); if(res) setData(res.map(d=>withLateFlagOnly(d))); };
  const handleLogin = (u) => { setUser(u); setLoading(true); reloadData().then(()=>setLoading(false)); };
  const nav = (p, id) => { if (id) setSelId(id); setPage(p); };

  const handleAction = (id, a, n, t, d) => {
    setData(prev=>prev.map(trx=>{
      if (trx.id!==id) return trx;
      if (a==="settle") return { ...trx, status:"settled", settled:true, settledDate:today(), financeNote:n };
      if (a==="edit_oer") return { ...trx, oerAmount:n.oerAmount, oerCategories:n.oerCategories, oerNote:n.oerNote, status:((n.oerAmount-n.caAmount)>0?"kurang_bayar":(n.oerAmount-n.caAmount)<0?"lebih_bayar":"settled") };
      if (a==="pay") return { ...trx, status:(t==="cash_advance"?"awaiting_oer":"paid"), settledDate:today(), transferDate:d };
      if (a==="oer_submitted") return { ...trx, ...n, status:"oer_doc_pending" };
      const m = {approve:"approved",process:"processing",doc_received_lk:"doc_received_lk",doc_sent_jkt:"doc_sent_jkt",doc_received_jkt:"doc_received_jkt",doc_complete:"doc_complete",oer_doc_received:"oer_doc_received",oer_doc_complete:"oer_doc_complete",awaiting_confirm:"awaiting_confirm",employee_confirmed:"employee_confirmed"};
      return { ...trx, status: m[a]||a, financeNote:n||trx.financeNote };
    }));
    setToast({msg:"✓ Berhasil diupdate"}); setTimeout(()=>setToast(null),2500); if(a==="settle")setSelId(null);
  };

  if (!user) return (<><style>{CSS}</style><LoginScreen onLogin={handleLogin}/></>);
  const sel = data.find(d=>d.id===selId);
  const NAV = {
    employee: [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"submit",ic:"plus",lb:"Ajukan"},{id:"list",ic:"list",lb:"Pengajuan Saya"}],
    admin_lk: [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"admin_lk_queue",ic:"check",lb:"Antrian LK"},{id:"list",ic:"list",lb:"Semua"}],
    admin_jkt:[{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"admin_jkt_queue",ic:"check",lb:"Antrian JKT"},{id:"list",ic:"list",lb:"Semua"}],
    ga:       [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"ga_queue",ic:"check",lb:"Antrian GA"},{id:"list",ic:"list",lb:"Semua"}],
    finance:  [{id:"dashboard",ic:"home",lb:"Dashboard"},{id:"monitor",ic:"chart",lb:"Monitor"},{id:"list",ic:"list",lb:"Semua"},{id:"settings",ic:"settings",lb:"Pengaturan"}],
  };

  return (
    <><style>{CSS}</style><div className="app">
      <div className="sb"><div className="sb-logo"><div className="sb-lh">ReimburseApp</div></div><div className="sb-u"><div className="av">{user.avatar}</div><div><div className="sb-un">{user.name}</div><div className="sb-ur">{user.role}</div></div></div>
        <nav className="sb-nav">{(NAV[user.role]||[]).map(i=>(<div key={item.id} className={`nv${page===i.id?" on":""}`} onClick={()=>nav(i.id)}><Ic n={i.ic} s={14}/>{i.lb}</div>))}</nav>
        <div className="nv" style={{marginTop:"auto",opacity:0.5}} onClick={()=>window.location.reload()}>Log Out</div>
      </div>
      <div className="main">
        <div className="bar"><h1 className="bt">{page.toUpperCase()}</h1><div className="br"><span className={`cs ${isReady()?"cs-ok":"cs-no"}`}>{isReady()?"Supabase ✓":"Offline"}</span><button className="btn bo sm" onClick={reloadData}>🔄</button></div></div>
        <div className="page">
          {loading ? <div className="empty">Memuat data...</div> : (
            <>{page==="dashboard" && <Dashboard data={data} user={user} nav={nav}/>}
              {page==="submit" && <SubmitPage user={user} onSubmit={d=>{setData([d,...data]); nav("list");}} data={data}/>}
              {page==="list" && <ListPage data={data} user={user} onSel={id=>setSelId(id)}/>}
              {page==="admin_lk_queue" && <AdminLKQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
              {page==="admin_jkt_queue" && <AdminJKTQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
              {page==="ga_queue" && <GAQueue data={data} onAction={handleAction} onSel={id=>setSelId(id)}/>}
              {page==="monitor" && <MonitorPage data={data} onSel={id=>setSelId(id)} onAction={handleAction}/>}
              {page==="settings" && <SettingsPage onSave={()=>reloadData()}/>}</>
          )}
        </div>
      </div>
    </div>
    {sel && <DetailModal trx={sel} user={user} onClose={()=>setSelId(null)} onAction={handleAction}/>}
    {toast && <div className="toast" style={{background:"var(--ink)"}}>{toast.msg}</div>}</>
  );
}

const SBadge = ({ s, trx, isOwner }) => {
  let ds = s; if (isOwner && trx && (s==="paid"||s==="awaiting_oer") && trx.transferDate) { const t = new Date(); t.setHours(0,0,0,0); const ed = new Date(trx.transferDate); if(ed>=t) ds="paid_queued"; }
  const c=STATUS[ds]||{label:ds,color:"#475569",bg:"#f1f5f9"}; return <span className="badge" style={{color:c.color,background:c.bg}}>{c.label}</span>;
};
const LateBadge = ({ d }) => d.isLate ? <span className="badge" style={{color:"#9f1239",background:"#fff1f2",marginLeft:4}}>⚠ Telat</span> : null;
const TTag = ({ t }) => <span className={`tag ${t==="cash_advance"?"tca":"tre"}`}>{t==="cash_advance"?"CA":"Reimburse"}</span>;
