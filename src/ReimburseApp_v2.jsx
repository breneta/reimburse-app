import React, { useState } from "react";

// --- KONFIGURASI ---
const STATUS = {
  pending:    { label: "Menunggu", color: "#92400e", bg: "#fffbeb" },
  approved:   { label: "Disetujui", color: "#1e40af", bg: "#eff6ff" },
  rejected:   { label: "Ditolak", color: "#991b1b", bg: "#fef2f2" },
};

const rp = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(n || 0);

// --- KOMPONEN UTAMA ---
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [data, setData] = useState([
    { id: "TRX-001", submitter: "Budi", purpose: "Beli Mouse", amount: 200000, status: "pending" },
    { id: "TRX-002", submitter: "Siti", purpose: "Grab Car", amount: 50000, status: "pending" }
  ]);

  const handleAction = (id, s) => {
    setData(data.map(d => d.id === id ? { ...d, status: s } : d));
  };

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f1f5f9" }}>
        <div style={{ background: "#fff", padding: "30px", borderRadius: "12px", textAlign: "center", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
          <h2>Login Reimburse</h2>
          <button style={{ display: "block", width: "100%", padding: "12px", margin: "10px 0", cursor: "pointer" }} onClick={() => setUser({ name: "Admin", role: "approver" })}>Login Approver</button>
          <button style={{ display: "block", width: "100%", padding: "12px", cursor: "pointer" }} onClick={() => setUser({ name: "User", role: "employee" })}>Login Karyawan</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: "250px", background: "#0f172a", color: "#fff", padding: "20px" }}>
        <h3>REIMBURSE APP</h3>
        <div style={{ marginTop: "20px", cursor: "pointer" }} onClick={() => setPage("dashboard")}>🏠 Dashboard</div>
        {user.role === "approver" && (
          <div style={{ marginTop: "15px", cursor: "pointer" }} onClick={() => setPage("approval")}>✅ Approval</div>
        )}
        <div style={{ marginTop: "15px", cursor: "pointer", color: "#f87171" }} onClick={() => setUser(null)}>Logout</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "30px", background: "#f8fafc" }}>
        {page === "dashboard" && (
          <div>
            <h2>Dashboard</h2>
            <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <h3>Daftar Pengajuan</h3>
              {data.map(d => (
                <div key={d.id} style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>
                  <strong>{d.purpose}</strong> - {rp(d.amount)} <br/>
                  <small style={{ color: STATUS[d.status].color }}>{STATUS[d.status].label}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {page === "approval" && (
          <div>
            <h2>Antrian Approval</h2>
            <input 
              placeholder="Cari nama karyawan..." 
              style={{ width: "100%", padding: "10px", marginBottom: "20px" }}
              onChange={(e) => setSearch(e.target.value)}
            />
            {data.filter(d => d.status === "pending" && d.submitter.toLowerCase().includes(search.toLowerCase())).map(d => (
              <div key={d.id} style={{ background: "#fff", padding: "15px", marginBottom: "10px", borderRadius: "8px", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong>{d.submitter}</strong> - {d.purpose} <br/> {rp(d.amount)}
                </div>
                <div>
                  <button onClick={() => handleAction(d.id, "approved")} style={{ background: "#10b981", color: "#fff", border: "none", padding: "5px 10px", marginRight: "5px", cursor: "pointer" }}>OK</button>
                  <button onClick={() => handleAction(d.id, "rejected")} style={{ background: "#ef4444", color: "#fff", border: "none", padding: "5px 10px", cursor: "pointer" }}>Tolak</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
