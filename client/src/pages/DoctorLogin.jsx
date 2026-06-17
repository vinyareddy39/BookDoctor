import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DoctorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      const role = data?.data?.role || data?.role;
      if (role === "doctor") {
        navigate("/doctor/dashboard");
      } else {
        setError("Access denied. This portal is for doctors only.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Invalid credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center bg-gradient-to-br from-secondary-50 via-white to-primary-50 px-4 py-12">
      <div className="max-w-md w-full">
        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-secondary-100">
              <svg className="w-8 h-8 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900">Doctor Portal</h2>
            <p className="text-slate-500 mt-2 text-sm">Sign in to manage your appointments & availability</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Doctor Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                placeholder="doctor@clinic.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold rounded-xl py-3.5 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-secondary-600 hover:bg-secondary-700 shadow-secondary-200"
            >
              {loading ? "Signing in..." : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm text-slate-500">
            <p>
              Don't have a doctor account?{" "}
              <Link to="/doctor/register" className="text-secondary-600 font-semibold hover:underline">
                Register here
              </Link>
            </p>
            <div className="border-t border-slate-100 pt-3">
              <Link to="/login" className="text-primary-600 font-semibold hover:underline">
                Are you a Patient? Patient Sign In here →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
