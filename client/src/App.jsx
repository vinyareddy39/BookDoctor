import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthContext";

// Pages
import Home            from "./pages/Home.jsx";
import Login           from "./pages/Login.jsx";
import Register        from "./pages/Register.jsx";
import DoctorLogin     from "./pages/DoctorLogin.jsx";
import DoctorRegister  from "./pages/DoctorRegister.jsx";
import Doctors         from "./pages/Doctors.jsx";
import BookAppointment from "./pages/BookAppointment.jsx";
import MyAppointments  from "./pages/MyAppointments.jsx";
import DoctorDashboard from "./pages/DoctorDashboard.jsx";
import Profile         from "./pages/Profile.jsx";
import NotFound        from "./pages/NotFound.jsx";

// Components
import Navbar  from "./components/common/Navbar.jsx";
import Footer  from "./components/common/Footer.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";

// Guard: logged-in users only (any role)
function AuthRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

// Guard: doctor role only
function DoctorRoute({ children }) {
  const { isLoggedIn, isDoctor, loading } = useAuth();
  if (loading) return null;
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
        <Routes>
          {/* Public */}
          <Route path="/"                   element={<Home />} />
          <Route path="/login"              element={<Login />} />
          <Route path="/register"           element={<Register />} />
          <Route path="/doctor/login"       element={<DoctorLogin />} />
          <Route path="/doctor/register"    element={<DoctorRegister />} />
          <Route path="/doctors"            element={<Doctors />} />

          {/* Patient protected */}
          <Route path="/book/:id"           element={<AuthRoute><BookAppointment /></AuthRoute>} />
          <Route path="/book-appointment/:id" element={<AuthRoute><BookAppointment /></AuthRoute>} />
          <Route path="/appointments"       element={<AuthRoute><MyAppointments /></AuthRoute>} />
          <Route path="/profile"            element={<AuthRoute><Profile /></AuthRoute>} />

          {/* Doctor protected */}
          <Route path="/doctor/dashboard"   element={<DoctorRoute><DoctorDashboard /></DoctorRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;