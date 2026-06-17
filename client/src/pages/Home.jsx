import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="min-h-[calc(100vh-73px)] bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-6">
      <div className="max-w-4xl text-center space-y-8 animate-fade-in-up">
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Your Health, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-500">
            Our Priority.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Find the best doctors in your area and book appointments instantly. 
          Experience seamless healthcare management from the comfort of your home.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link 
            to="/doctors" 
            className="bg-primary-600 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg shadow-primary-500/30 hover:bg-primary-700 hover:-translate-y-1 transition-all duration-300"
          >
            Find a Doctor
          </Link>
          {isLoggedIn ? (
            <Link 
              to="/appointments" 
              className="bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-full font-semibold text-lg hover:bg-slate-50 hover:-translate-y-1 transition-all duration-300 shadow-sm"
            >
              My Appointments
            </Link>
          ) : (
            <Link 
              to="/login" 
              className="bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-full font-semibold text-lg hover:bg-slate-50 hover:-translate-y-1 transition-all duration-300 shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

