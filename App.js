```react
import React, { useState, useRef, useCallback, useEffect } from "react";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const defaultCharge = () => ({ id: uid(), label: "New Charge", amount: "" });

const defaultRoute = () => ({
  id: uid(), date: "", route: "", items: "", podNo: "",
  charges: [
    { id: uid(), label: "Service Charge", amount: "" },
    { id: uid(), label: "Labour + Parking", amount: "" },
    { id: uid(), label: "Local Fare", amount: "" },
    { id: uid(), label: "Modi Fare", amount: "" },
  ],
});

const fmt = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmtINR = (n) => n === 0 ? "—" : n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const TD = ({ children, style = {}, ...props }) => (
  <td style={{ border: "1px solid #c8d0da", padding: "7px 12px", ...style }} {...props}>{children}</td>
);

export default function App() {
  const [billTo, setBillTo] = useState("KKPS");
  const [invoiceDate, setInvoiceDate] = useState("11/04/2026");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [bankDetails, setBankDetails] = useState({
    bankName: "HDFC Bank",
    accName: "Kaushal Kushal Parcel Service Pvt Ltd",
    accNo: "50200012345678",
    ifsc: "HDFC0001234"
  });

  const [extraFees, setExtraFees] = useState([
    { id: "ef1", label: "Courier Fee", amount: "200" },
  ]);
  
  const [routes, setRoutes] = useState([
    {
      id: "r1", date: "30/3/26", route: "GHY to NDLS to Pantnagar", items: "10 Bags", podNo: "39623",
      charges: [
        { id: "c1", label: "Service Charge", amount: "400" },
        { id: "c2", label: "Labour + Parking", amount: "250" },
        { id: "c3", label: "Local Fare", amount: "600" },
        { id: "c4", label: "Modi Fare", amount: "950" },
      ],
    },
  ]);

  const pageRefs = useRef([]);

  // --- PERSISTENCE LOGIC ---
  useEffect(() => {
    const saved = localStorage.getItem("kkps_invoice_data");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.billTo) setBillTo(data.billTo);
        if (data.bankDetails) setBankDetails(data.bankDetails);
        if (data.routes) setRoutes(data.routes);
        if (data.extraFees) setExtraFees(data.extraFees);
      } catch (e) { console.error("Failed to load saved data"); }
    }
  }, []);

  useEffect(() => {
    const dataToSave = { billTo, bankDetails, routes, extraFees };
    localStorage.setItem("kkps_invoice_data", JSON.stringify(dataToSave));
  }, [billTo, bankDetails, routes, extraFees]);

  const updateRoute = (id, field, value) =>
    setRoutes(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r));
  const addRoute = () => setRoutes(rs => [...rs, defaultRoute()]);
  const removeRoute = (id) => setRoutes(rs => rs.filter(r => r.id !== id));

  const updateCharge = (routeId, chargeId, field, value) =>
    setRoutes(rs => rs.map(r => r.id !== routeId ? r : {
      ...r, charges: r.charges.map(c => c.id === chargeId ? { ...c, [field]: value } : c),
    }));
  const addCharge = (routeId) =>
    setRoutes(rs => rs.map(r => r.id !== routeId ? r : { ...r, charges: [...r.charges, defaultCharge()] }));
  const removeCharge = (routeId, chargeId) =>
    setRoutes(rs => rs.map(r => r.id !== routeId ? r : { ...r, charges: r.charges.filter(c => c.id !== chargeId) }));

  const updateFee = (id, field, value) =>
    setExtraFees(fs => fs.map(f => f.id === id ? { ...f, [field]: value } : f));
  const addFee = () => setExtraFees(fs => [...fs, { id: uid(), label: "Extra Fee", amount: "" }]);
  const removeFee = (id) => setExtraFees(fs => fs.filter(f => f.id !== id));

  const subtotal = (r) => r.charges.reduce((s, c) => s + fmt(c.amount), 0);
  const totalFees = extraFees.reduce((s, f) => s + fmt(f.amount), 0);
  const grandTotal = routes.reduce((s, r) => s + subtotal(r), 0) + totalFees;

  // --- DOWNLOAD LOGIC ---
  const downloadPNG = useCallback(async () => {
    try {
      setIsGenerating(true);
      const { default: html2canvas } = await import("https://esm.sh/html2canvas");
      for (let i = 0; i < pageRefs.current.length; i++) {
        const canvas = await html2canvas(pageRefs.current[i], { scale: 2, useCORS: true });
        const link = document.createElement("a");
        link.download = `KKPS_Page_${i + 1}_${invoiceDate.replace(/\//g, "-")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    } catch (err) { setErrorMsg("Download failed"); }
    finally { setIsGenerating(false); }
  }, [invoiceDate]);

  const downloadPDF = useCallback(async () => {
    try {
      setIsGenerating(true);
      const { default: html2canvas } = await import("https://esm.sh/html2canvas");
      const { jsPDF } = await import("https://esm.sh/jspdf");
      const pdf = new jsPDF("p", "pt", "a4");
      
      for (let i = 0; i < pageRefs.current.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pageRefs.current[i], { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }
      pdf.save(`KKPS_Invoice_${invoiceDate.replace(/\//g, "-")}.pdf`);
    } catch (err) { setErrorMsg("PDF generation failed"); }
    finally { setIsGenerating(false); }
  }, [invoiceDate]);

  // Paginate routes: 3 per page
  const paginatedRoutes = [];
  for (let i = 0; i < routes.length; i += 3) {
    paginatedRoutes.push(routes.slice(i, i + 3));
  }

  const iCls = "border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";
  const aCls = "border border-gray-300 rounded px-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "32px 16px", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .charge-row .del-btn { opacity: 0; transition: opacity .15s; }
        .charge-row:hover .del-btn { opacity: 1; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* EDITOR */}
      <div className="no-print" style={{ maxWidth: 860, margin: "0 auto 24px" }}>
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08)", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ background: "#1e293b", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: "#fff", fontWeight: 700 }}>⚙️ Invoice Editor (Autosaves)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={downloadPNG} disabled={isGenerating} style={{ background: "#475569", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{isGenerating ? "..." : "↓ PNGs"}</button>
              <button onClick={downloadPDF} disabled={isGenerating} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{isGenerating ? "..." : "↓ PDF"}</button>
            </div>
          </div>

          <div style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>Bill To</label><input className={iCls} value={billTo} onChange={e => setBillTo(e.target.value)} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>Date</label><input className={iCls} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
            </div>

            {routes.map((r, idx) => (
              <div key={r.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 16, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Route #{idx + 1}</span>
                  <button onClick={() => removeRoute(r.id)} style={{ fontSize: 11, color: "#ef4444", border: "none", background: "none", cursor: "pointer" }}>Remove</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <input className={iCls} value={r.date} placeholder="Date" onChange={e => updateRoute(r.id, "date", e.target.value)} />
                  <input className={iCls} value={r.route} placeholder="Route (e.g. GHY to NDLS)" onChange={e => updateRoute(r.id, "route", e.target.value)} />
                  <input className={iCls} value={r.items} placeholder="Items" onChange={e => updateRoute(r.id, "items", e.target.value)} />
                  <input className={iCls} value={r.podNo} placeholder="POD No" onChange={e => updateRoute(r.id, "podNo", e.target.value)} />
                </div>
                {r.charges.map(c => (
                  <div key={c.id} className="charge-row" style={{ display: "grid", gridTemplateColumns: "1fr 100px 20px", gap: 6, marginBottom: 4 }}>
                    <input className={iCls} value={c.label} onChange={e => updateCharge(r.id, c.id, "label", e.target.value)} />
                    <input className={aCls} value={c.amount} onChange={e => updateCharge(r.id, c.id, "amount", e.target.value)} />
                    <button className="del-btn" onClick={() => removeCharge(r.id, c.id)} style={{ border: "none", background: "none", color: "red", cursor: "pointer" }}>×</button>
                  </div>
                ))}
                <button onClick={() => addCharge(r.id)} style={{ fontSize: 11, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>+ Add Item</button>
              </div>
            ))}
            <button onClick={addRoute} style={{ width: "100%", border: "2px dashed #93c5fd", padding: 12, borderRadius: 12, color: "#3b82f6", cursor: "pointer", marginBottom: 20 }}>+ Add New Route</button>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Bank Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input className={iCls} value={bankDetails.bankName} placeholder="Bank" onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})} />
                <input className={iCls} value={bankDetails.accNo} placeholder="Acc No" onChange={e => setBankDetails({...bankDetails, accNo: e.target.value})} />
                <input className={iCls} value={bankDetails.ifsc} placeholder="IFSC" onChange={e => setBankDetails({...bankDetails, ifsc: e.target.value})} />
                <input className={iCls} value={bankDetails.accName} placeholder="Acc Name" onChange={e => setBankDetails({...bankDetails, accName: e.target.value})} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INVOICE PREVIEW (Paginated) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
        {paginatedRoutes.map((pageBatch, pageIdx) => {
          const isLastPage = pageIdx === paginatedRoutes.length - 1;
          return (
            <div 
              key={pageIdx} 
              ref={el => pageRefs.current[pageIdx] = el}
              style={{ 
                background: "#fff", padding: "48px", width: "800px", margin: "0 auto", 
                boxShadow: "0 4px 32px rgba(0,0,0,.1)", color: "#1a1a2e", minHeight: "1000px",
                display: "flex", flexDirection: "column"
              }}
            >
              <div style={{ borderBottom: "3px solid #1a3a5c", paddingBottom: 16, marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a3a5c", margin: 0 }}>Kaushal Kushal parcel service pvt Ltd</h1>
                <p style={{ fontSize: 12, color: "#444", margin: "4px 0" }}>c/o shasakt security pvt Ltd block 1, floor 7 unit 7L, 4, chowringhee lane, Kolkata 700016</p>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>INVOICE</h2>
                  <p style={{ fontSize: 12 }}>Date: {invoiceDate} | Page {pageIdx + 1} of {paginatedRoutes.length}</p>
                </div>
                <div style={{ border: "1px solid #ccc", padding: "8px 16px", borderRadius: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Bill To: </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{billTo}</span>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#e8edf2" }}>
                    {["Date", "Route & Details", "Items", "POD No.", "Amount (INR)"].map(h => (
                      <th key={h} style={{ border: "1px solid #c8d0da", padding: "10px", textAlign: h === "Amount (INR)" ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageBatch.map(r => (
                    <React.Fragment key={r.id}>
                      <tr>
                        <TD style={{ fontWeight: 600 }}>{r.date}</TD>
                        <TD style={{ fontWeight: 600 }}>Route: {r.route}</TD>
                        <TD>{r.items}</TD>
                        <TD className="mono">{r.podNo}</TD>
                        <TD style={{ textAlign: "right", color: "#ccc" }}>—</TD>
                      </tr>
                      {r.charges.map(c => fmt(c.amount) > 0 && (
                        <tr key={c.id}>
                          <TD></TD><TD>{c.label}</TD><TD></TD><TD></TD>
                          <TD style={{ textAlign: "right" }} className="mono">{fmtINR(fmt(c.amount))}</TD>
                        </tr>
                      ))}
                      <tr style={{ background: "#f8fafc" }}>
                        <TD colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Subtotal</TD>
                        <TD style={{ textAlign: "right", fontWeight: 700 }} className="mono">{fmtINR(subtotal(r))}</TD>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {isLastPage && (
                <div style={{ marginTop: "auto" }}>
                  {/* Final Summary List */}
                  <div style={{ marginTop: 24, borderTop: "2px solid #1a3a5c", paddingTop: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#1a3a5c" }}>INVOICE SUMMARY</h3>
                    {routes.map((r, i) => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>Route #{i + 1}: {r.route || "Unnamed Route"}</span>
                        <span className="mono">{fmtINR(subtotal(r))}</span>
                      </div>
                    ))}
                    {extraFees.map(f => fmt(f.amount) > 0 && (
                      <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>{f.label}</span>
                        <span className="mono">{fmtINR(fmt(f.amount))}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, marginTop: 10, padding: "8px", background: "#1a3a5c", color: "#fff" }}>
                      <span>GRAND TOTAL</span>
                      <span className="mono">₹{fmtINR(grandTotal)}</span>
                    </div>
                  </div>

                  {/* Payment Instructions (Only on last page) */}
                  <div style={{ marginTop: 24, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1" }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, margin: "0 0 8px 0" }}>PAYMENT INSTRUCTIONS</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 20px", fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>Bank:</span> {bankDetails.bankName}
                      <span style={{ fontWeight: 600 }}>A/C Name:</span> {bankDetails.accName}
                      <span style={{ fontWeight: 600 }}>A/C No:</span> <span className="mono">{bankDetails.accNo}</span>
                      <span style={{ fontWeight: 600 }}>IFSC:</span> <span className="mono">{bankDetails.ifsc}</span>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: 20, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>Computer generated invoice. No signature required.</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

```
  
