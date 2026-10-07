import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "./NotificationBell.jsx";
import GlobalSearch from "./GlobalSearch.jsx";

const NAV_LINKS = [
  { label: "Home",    to: "/" },
  { label: "Doctors", to: "/doctors" },
];


export default function Navbar() {
  const { isLoggedIn, isDoctor, isPatient, isClinicAdmin, isReceptionist, isLabTech, isAdmin, user, logout } = useAuth();
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
    const wasDoctor = isDoctor;
    logout();
    navigate(wasDoctor ? "/doctor/login" : "/login");
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
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18 gap-2 sm:gap-4">

          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
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

          {/* ── Desktop Nav Links (Visible on lg: 1024px and up) ── */}
          <div className="hidden lg:flex items-center gap-0.5 xl:gap-1 shrink-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
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
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/appointments") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  My Appointments
                </Link>
                <Link
                  to="/my-records"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/my-records") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Rx & Care
                </Link>
                <Link
                  to="/billing"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/billing") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Billing
                </Link>
                <Link
                  to="/profile"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/profile") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Profile
                </Link>
                <Link
                  to="/messages"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/messages") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Chats
                </Link>
              </>
            )}
            {isDoctor && (
              <>
                <Link
                  to="/doctor/dashboard"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/doctor/dashboard") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/emr"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/emr") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  EMR
                </Link>
                <Link
                  to="/lab"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/lab") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Lab
                </Link>
                <Link
                  to="/calendar"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/calendar") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Calendar
                </Link>
                <Link
                  to="/queue"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/queue") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Live Queue
                </Link>
                <Link
                  to="/patients"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/patients") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Patients
                </Link>
                <Link
                  to="/messages"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/messages") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Chats
                </Link>
              </>
            )}
            {isLabTech && (
              <>
                <Link
                  to="/lab"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/lab") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Lab Worklist
                </Link>
                <Link
                  to="/patients"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/patients") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Patients
                </Link>
              </>
            )}
            {isReceptionist && (
              <>
                <Link
                  to="/reception/walk-in"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/reception/walk-in") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Walk-In Desk
                </Link>
                <Link
                  to="/queue"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/queue") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Live Queue
                </Link>
                <Link
                  to="/calendar"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/calendar") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Calendar
                </Link>
                <Link
                  to="/patients"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/patients") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Patients
                </Link>
                <Link
                  to="/billing"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/billing") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Billing
                </Link>
              </>
            )}
            {(isAdmin || isClinicAdmin) && (
              <>
                <Link
                  to="/admin"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/admin") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Admin Portal
                </Link>
                <Link
                  to="/billing"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/billing") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Billing
                </Link>
                <Link
                  to="/emr"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/emr") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  EMR
                </Link>
                <Link
                  to="/lab"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/lab") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Lab
                </Link>
                <Link
                  to="/calendar"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/calendar") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Calendar
                </Link>
                <Link
                  to="/queue"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/queue") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Queue
                </Link>
                <Link
                  to="/patients"
                  className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive("/patients") ? "text-primary-600 bg-primary-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Patients
                </Link>
              </>
            )}
          </div>

          {/* ── Auth Buttons & Utilities (Desktop / Laptop) ── */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 flex-shrink-0">
            {isLoggedIn ? (
              <>
                <GlobalSearch />
                <NotificationBell />

                {/* User chip */}
                <div className="flex items-center gap-2 xl:gap-2.5 bg-slate-50 border border-slate-200 rounded-full px-2.5 xl:px-3.5 py-1 xl:py-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                    isDoctor ? "bg-accent-500" : "bg-primary-500"
                  }`}>
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="text-xs xl:text-sm font-semibold text-slate-700 max-w-[100px] truncate">{user?.name ? user.name.split(" ")[0] : "User"}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${
                    isDoctor ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"
                  }`}>
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-semibold text-xs xl:text-sm border border-red-200 hover:border-red-500 transition-all duration-200 shrink-0"
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
                  className="px-3 xl:px-4 py-2 text-xs xl:text-sm font-semibold text-slate-600 hover:text-primary-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-xs xl:text-sm px-4 xl:px-5 py-2 xl:py-2.5"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile Utilities & Hamburger ── */}
          <div className="lg:hidden flex items-center gap-1.5 sm:gap-2">
            {isLoggedIn && (
              <>
                <GlobalSearch />
                <NotificationBell />
              </>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
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
      </div>

      {/* ── Mobile Dropdown Drawer ── */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 px-4 pb-6 pt-3 space-y-1 shadow-xl animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* Mobile User Header */}
          {isLoggedIn && (
            <div className="flex items-center gap-3 p-3 mb-2 bg-slate-50 border border-slate-200 rounded-xl">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                isDoctor ? "bg-accent-500" : "bg-primary-500"
              }`}>
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 truncate">{user?.name || "User"}</p>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                  isDoctor ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"
                }`}>
                  {user?.role}
                </span>
              </div>
            </div>
          )}

          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={`block px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
                isActive(link.to) ? "bg-primary-50 text-primary-600" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {isPatient && (
            <>
              <Link to="/appointments" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">My Appointments</Link>
              <Link to="/my-records"   onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Rx & Care</Link>
              <Link to="/billing"      onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Billing</Link>
              <Link to="/profile"      onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Profile</Link>
              <Link to="/messages"     onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Chats</Link>
            </>
          )}
          {isDoctor && (
            <>
              <Link to="/doctor/dashboard" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Dashboard</Link>
              <Link to="/emr"              onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">EMR</Link>
              <Link to="/lab"              onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Lab</Link>
              <Link to="/calendar"         onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Calendar</Link>
              <Link to="/queue"            onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Live Queue</Link>
              <Link to="/patients"         onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Patients</Link>
              <Link to="/messages"         onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Chats</Link>
            </>
          )}
          {isLabTech && (
            <>
              <Link to="/lab"      onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Lab Worklist</Link>
              <Link to="/patients" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Patients</Link>
            </>
          )}
          {isReceptionist && (
            <>
              <Link to="/reception/walk-in" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Walk-In Desk</Link>
              <Link to="/billing"           onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Billing</Link>
              <Link to="/queue"             onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Live Queue</Link>
              <Link to="/calendar"          onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Calendar</Link>
              <Link to="/patients"          onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Patients</Link>
            </>
          )}
          {(isAdmin || isClinicAdmin) && (
            <>
              <Link to="/admin"    onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Admin Portal</Link>
              <Link to="/billing"  onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Billing</Link>
              <Link to="/emr"      onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">EMR</Link>
              <Link to="/lab"      onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Lab</Link>
              <Link to="/calendar" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Calendar</Link>
              <Link to="/queue"    onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Live Queue</Link>
              <Link to="/patients" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Patients</Link>
            </>
          )}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            {isLoggedIn ? (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            ) : (
              <>
                <Link to="/login"    onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign In</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-bold text-center text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
