import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV_LINKS = [
  { label: "Home",       to: "/" },
  { label: "Doctors",    to: "/doctors" },
  { label: "About",      to: "#about" },
  { label: "Contact",    to: "#contact" },
];

export default function Navbar() {
  const { isLoggedIn, isDoctor, isPatient, user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [scrolled,   setScrolled]   = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (to) => location.pathname === to;

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-md border-b border-slate-100"
          : "bg-white/90 backdrop-blur-sm border-b border-slate-100"
      }`}
    >
      <div className="section">
        <div className="flex items-center justify-between h-16 lg:h-18">

          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/30 group-hover:shadow-lg group-hover:shadow-primary-500/40 transition-all duration-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-primary-600">Book</span>
              <span className="text-slate-800">Doctor</span>
            </span>
          </Link>

          {/* ── Desktop Nav Links ── */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  isActive(link.to)
                    ? "text-primary-600 bg-primary-50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isPatient && (
              <>
                <Link
                  to="/appointments"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    isActive("/appointments") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  My Appointments
                </Link>
                <Link
                  to="/profile"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    isActive("/profile") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Profile
                </Link>
              </>
            )}
            {isDoctor && (
              <Link
                to="/doctor/dashboard"
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  isActive("/doctor/dashboard") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* ── Auth Buttons ── */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <>
                {/* User chip */}
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-full px-3.5 py-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    isDoctor ? "bg-accent-500" : "bg-primary-500"
                  }`}>
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{user?.name?.split(" ")[0]}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                    isDoctor ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"
                  }`}>
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-semibold text-sm border border-red-200 hover:border-red-500 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-primary-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm px-5 py-2.5"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile Hamburger ── */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile Dropdown ── */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 pb-5 pt-3 space-y-1 shadow-xl animate-fade-in">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`block px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
                isActive(link.to) ? "bg-primary-50 text-primary-600" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {isPatient && (
            <>
              <Link to="/appointments" className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">My Appointments</Link>
              <Link to="/profile"      className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Profile</Link>
            </>
          )}
          {isDoctor && (
            <Link to="/doctor/dashboard" className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Dashboard</Link>
          )}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            {isLoggedIn ? (
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            ) : (
              <>
                <Link to="/login"    className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign In</Link>
                <Link to="/register" className="block px-4 py-3 rounded-xl text-sm font-bold text-center text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
