"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import "./globals.css";
import { API_URL } from "@/config";

interface InvoiceItem {
  description: string;
  quantity: string;
  price: string;
}

interface Invoice {
  id: string;
  vendor: string;
  total: string;
  date: string;
  status: "COMPLETED" | "PROCESSING" | "FAILED";
  processedAt: string;
  error?: string;
  s3Key?: string;
  fileName?: string;
  items?: InvoiceItem[];
}

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [user, setUser] = useState({ id: "", name: "" });
  const router = useRouter();

  useEffect(() => {
    const userId = localStorage.getItem("userId") || "";
    const userName = localStorage.getItem("userName") || "";
    if (!userId) { router.push("/login"); return; }
    setUser({ id: userId, name: userName });

    const savedTheme = localStorage.getItem("theme") as 'light' | 'dark';
    if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
    }

    fetchInvoices(userId);
    const interval = setInterval(() => fetchInvoices(userId), 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchInvoices = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/invoices?userId=${uid}`);
      const data = await res.json();
      setInvoices(data || []);
      setIsLoading(false);
    } catch (err) { console.error(err); setIsLoading(false); }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleLogout = () => { localStorage.clear(); router.push("/login"); };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user.id) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const urlRes = await fetch(`${API_URL}/upload-url?fileName=${encodeURIComponent(file.name)}&userId=${user.id}&contentType=${encodeURIComponent(file.type)}`);
      const { uploadUrl } = await urlRes.json();
      setUploadProgress(40);

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (uploadRes.ok) {
        setUploadProgress(100);
        setTimeout(() => { setIsUploading(false); setUploadProgress(0); fetchInvoices(user.id); }, 1200);
      }
    } catch (err) { console.error(err); setIsUploading(false); }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      const res = await fetch(`${API_URL}/invoices?userId=${user.id}&id=${encodeURIComponent(inv.id)}&s3Key=${encodeURIComponent(inv.s3Key || '')}`, { method: 'DELETE' });
      if (res.ok) fetchInvoices(user.id);
    } catch (err) { console.error(err); }
  };

  const downloadCSV = (invoice: Invoice) => {
    if (!invoice.items) return;
    const headers = "Description,Quantity,Price\n";
    const rows = invoice.items.map(i => `"${String(i.description || '')}","${String(i.quantity || '')}","${String(i.price || '')}"`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_${invoice.id.substring(0,8)}.csv`;
    a.click();
  };

  return (
    <div className="container fade-in">
      <header>
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Overview for {user.name} ({user.id})</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button className="btn btn-primary" onClick={() => document.getElementById('fileInput')?.click()}>
            Upload Invoice
          </button>
          <button className="btn btn-secondary" style={{ color: 'var(--error)' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <input id="fileInput" type="file" hidden accept=".pdf,image/*" onChange={handleUpload} />

      <div className="dashboard-stats">
        <div className="card stat-card">
          <p className="stat-label">Invoices Processed</p>
          <p className="stat-value">{invoices.length}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">System Status</p>
          <p className="stat-value" style={{ color: 'var(--success)', fontSize: '1.25rem' }}>Active</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">API Latency</p>
          <p className="stat-value" style={{ fontSize: '1.25rem' }}>&lt; 200ms</p>
        </div>
      </div>

      {isUploading && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Processing document...</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.875rem' }}>{uploadProgress}%</span>
          </div>
          <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--primary)', width: `${uploadProgress}%`, transition: 'width 0.4s' }}></div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '0' }}>
        <div className="invoice-list">
          {isLoading ? (
            [1,2,3].map(i => <div key={i} className="invoice-row shimmer" style={{ height: '64px' }}></div>)
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              No invoices found. Start by uploading one.
            </div>
          ) : (
            invoices.map((inv) => (
              <div key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                 <div className="invoice-row" 
                      onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                      style={{ cursor: 'pointer' }}>
                  <span className={`status-badge status-${inv.status.toLowerCase()}`}>{inv.status}</span>
                  <div>
                    <p style={{ fontWeight: 600 }}>{String(inv.vendor || inv.fileName || 'Processing...')}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.date || 'Analyzing date...'} • {inv.id.substring(4,12)}</p>
                    {inv.status === 'FAILED' && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>Error: {inv.error || 'Unknown error'}</p>
                    )}
                  </div>
                  <span className="price" style={{ textAlign: 'right', fontSize: '1rem' }}>{inv.total || '—'}</span>
                  <div style={{ textAlign: 'right' }}>
                    <button className="btn btn-danger" style={{ padding: '0.5rem' }} onClick={(e) => { e.stopPropagation(); handleDelete(inv); }}>Delete</button>
                  </div>
                </div>

                {expandedId === inv.id && (
                  <div style={{ padding: '1.5rem 2rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', textAlign: 'left', fontSize: '0.875rem' }}>
                      <thead style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0' }}>DESCRIPTION</th>
                          <th style={{ padding: '0.5rem 0' }}>QTY</th>
                          <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>PRICE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.items?.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 0' }}>{item.description}</td>
                            <td style={{ padding: '0.75rem 0' }}>{item.quantity}</td>
                            <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600 }}>{item.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button className="btn btn-secondary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => downloadCSV(inv)}>
                      Download CSV Analysis
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        <p>@copyright reserved to prasad patil</p>
      </footer>
    </div>
  );
}
