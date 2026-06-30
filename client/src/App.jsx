import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthContext";


// Eagerly loaded (always needed)
import Navbar  from "./components/common/Navbar.jsx";
import Footer  from "./components/common/Footer.jsx";

// Lazy-loaded pages (split into separate chunks — faster initial load)
const Home            = lazy(() => import("./pages/Home.jsx"));
const Login           = lazy(() => import("./pages/Login.jsx"));
const Register        = lazy(() => import("./pages/Register.jsx"));
const DoctorLogin     = lazy(() => import("./pages/DoctorLogin.jsx"));
const DoctorRegister  = lazy(() => import("./pages/DoctorRegister.jsx"));
const Doctors         = lazy(() => import("./pages/Doctors.jsx"));
const BookAppointment = lazy(() => import("./pages/BookAppointment.jsx"));
const MyAppointments  = lazy(() => import("./pages/MyAppointments.jsx"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard.jsx"));
const Profile         = lazy(() => import("./pages/Profile.jsx"));
const NotFound        = lazy(() => import("./pages/NotFound.jsx"));
const About           = lazy(() => import("./pages/About.jsx"));
const Contact         = lazy(() => import("./pages/Contact.jsx"));

// Page loader fallback
function PageLoader() {
  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-semibold animate-pulse">Loading page…</p>
      </div>
    </div>
  );
}

// Guard: logged-in users only (any role)
function AuthRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <PageLoader />;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

// Guard: doctor role only
function DoctorRoute({ children }) {
  const { isLoggedIn, isDoctor, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isLoggedIn) return <Navigate to="/doctor/login" replace />;
  if (!isDoctor)  return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Inter, sans-serif',
            fontWeight: '600',
            fontSize: '14px',
            borderRadius: '12px',
            padding: '12px 16px',
          },
          success: {
            style: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
          },
          error: {
            style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/"                   element={<Home />} />
            <Route path="/login"              element={<Login />} />
            <Route path="/register"           element={<Register />} />
            <Route path="/doctor/login"       element={<DoctorLogin />} />
            <Route path="/doctor/register"    element={<DoctorRegister />} />
            <Route path="/doctors"            element={<Doctors />} />
            <Route path="/about"             element={<About />} />
            <Route path="/contact"           element={<Contact />} />

            {/* Patient protected */}
            <Route path="/book/:id"             element={<AuthRoute><BookAppointment /></AuthRoute>} />
            <Route path="/book-appointment/:id" element={<AuthRoute><BookAppointment /></AuthRoute>} />
            <Route path="/appointments"         element={<AuthRoute><MyAppointments /></AuthRoute>} />
            <Route path="/profile"              element={<AuthRoute><Profile /></AuthRoute>} />

            {/* Doctor protected */}
            <Route path="/doctor/dashboard"   element={<DoctorRoute><DoctorDashboard /></DoctorRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default App;