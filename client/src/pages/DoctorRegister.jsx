import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function DoctorRegister() {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await register({ name, email, password, role: "doctor" });
      toast.success("Doctor account created successfully! 🎉");
      navigate("/doctor/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-accent-600 via-accent-700 to-secondary-700 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-400/20 rounded-full translate-y-1/2 -translate-x-1/4" />

        <div className="flex items-center gap-2.5 z-10">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold">BookDoctor</span>
        </div>

        <div className="z-10 space-y-4">
          <div className="text-6xl">🩺</div>
          <h2 className="text-4xl font-black leading-tight">Grow Your Practice<br />Digitally.</h2>
          <p className="text-accent-100 text-lg leading-relaxed">
            Join our premium network of healthcare professionals and offer seamless consultation bookings to your patients.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { emoji: "🌟", text: "Create online profile" },
              { emoji: "📅", text: "Manage schedule" },
              { emoji: "💸", text: "Zero listing fees" },
              { emoji: "📊", text: "Track earnings" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-2 bg-white/10 rounded-xl p-3">
                <span className="text-xl">{f.emoji}</span>
                <span className="text-sm font-semibold text-accent-100">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="z-10 text-xs text-accent-300">
          Already registered?{" "}
          <Link to="/doctor/login" className="text-white font-bold underline">Sign in here</Link>
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-surface">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-accent-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-extrabold"><span className="text-accent-600">Doctor</span> Portal</span>
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-accent-50 border border-accent-200 rounded-full px-3 py-1 text-xs font-bold text-accent-700 mb-4">
              🩺 Join as a Healthcare Partner
            </div>
            <h1 className="text-3xl font-black text-slate-900">Doctor Registration</h1>
            <p className="text-slate-500 mt-1.5">Set up your profile to start receiving bookings.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="input-label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Dr. Jane Smith"
                required
              />
            </div>

            <div>
              <label className="input-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="doctor@clinic.com"
                required
              />
            </div>

            <div>
              <label className="input-label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  placeholder="Min. 6 characters"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-base font-bold text-white rounded-xl bg-accent-600 hover:bg-accent-700 shadow-lg shadow-accent-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating doctor account...
                </span>
              ) : "Create Doctor Account →"}
            </button>
          </form>

          <div className="mt-6 space-y-4 text-center text-sm text-slate-500">
            <p>
              Already have a doctor account?{" "}
              <Link to="/doctor/login" className="text-accent-600 font-bold hover:underline">Sign in</Link>
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <Link to="/register" className="inline-flex items-center gap-1.5 text-primary-600 font-bold hover:underline">
              Register as Patient →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
