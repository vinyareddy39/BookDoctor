import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const { isLoggedIn, isDoctor, isPatient, user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/90 border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="text-2xl font-extrabold text-primary-600 tracking-tight">
          Book<span className="text-secondary-500">Doctor</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-6 items-center font-medium text-slate-600">
          <Link to="/" className="hover:text-primary-600 transition-colors">Home</Link>

          {/* Patient links */}
          {isPatient && (
            <>
              <Link to="/doctors" className="hover:text-primary-600 transition-colors">Find Doctors</Link>
              <Link to="/appointments" className="hover:text-primary-600 transition-colors">My Appointments</Link>
              <Link to="/profile" className="hover:text-primary-600 transition-colors">My Profile</Link>
            </>
          )}

          {/* Doctor links */}
          {isDoctor && (
            <>
              <Link to="/doctor/dashboard" className="hover:text-secondary-600 transition-colors">My Dashboard</Link>
            </>
          )}

          {/* Logged out */}
          {!isLoggedIn && (
            <Link to="/doctors" className="hover:text-primary-600 transition-colors">Doctors</Link>
          )}

          {/* Auth buttons */}
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
                <div className={`w-2 h-2 rounded-full ${isDoctor ? "bg-secondary-500" : "bg-green-500"}`}></div>
                <span className="text-sm font-semibold text-slate-700">{user?.name?.split(" ")[0]}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  isDoctor ? "bg-secondary-100 text-secondary-700" : "bg-primary-100 text-primary-700"
                }`}>
                  {user?.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-slate-600 hover:text-primary-600 font-semibold transition-colors">
                Login
              </Link>
              <Link
                to="/register"
                className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-slate-600 hover:text-primary-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-6 pb-4 space-y-3 shadow-lg">
          <Link to="/" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-700 font-medium hover:text-primary-600">Home</Link>
          {isPatient && <>
            <Link to="/doctors" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-700 font-medium hover:text-primary-600">Find Doctors</Link>
            <Link to="/appointments" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-700 font-medium hover:text-primary-600">My Appointments</Link>
            <Link to="/profile" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-700 font-medium hover:text-primary-600">My Profile</Link>
          </>}
          {isDoctor && <>
            <Link to="/doctor/dashboard" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-700 font-medium hover:text-secondary-600">My Dashboard</Link>
          </>}
          {!isLoggedIn && <Link to="/doctors" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-700 font-medium hover:text-primary-600">Doctors</Link>}
          {isLoggedIn
            ? <button onClick={handleLogout} className="w-full text-left py-2 text-red-500 font-semibold">Logout</button>
            : <>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-700 font-medium">Login</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="block py-2 text-primary-600 font-semibold">Register</Link>
              </>
          }
        </div>
      )}
    </nav>
  );
}
