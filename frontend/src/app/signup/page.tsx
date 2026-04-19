"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "../globals.css";
import { API_URL } from "@/config";

export default function Signup() {
  const [formData, setFormData] = useState({ name: "", email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        alert("Account created successfully. Please sign in.");
        router.push("/login");
      } else {
        const data = await res.json();
        setError(data.message || "Registration failed.");
        setIsLoading(false);
      }
    } catch (err) {
      setError("Server connection lost.");
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Create an account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Join the invoice intelligence platform.</p>
        </div>

        <form onSubmit={handleSignup}>
          <div className="input-group">
            <label>Full Name</label>
            <input 
              type="text" 
              placeholder="e.g. Prasad Patil" 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="prasad@company.com" 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              placeholder="p_patil" 
              value={formData.username} 
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={formData.password} 
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {error && <div style={{ color: 'var(--error)', fontSize: '0.75rem', marginBottom: '1rem' }}>{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>
            {isLoading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}
