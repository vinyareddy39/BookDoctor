import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface px-6">
      <div className="text-center max-w-md animate-fade-in-up">
        {/* Illustration */}
        <div className="text-9xl mb-6 animate-bounce-slow">🏥</div>

        <h1 className="text-8xl font-black text-primary-600 mb-4">404</h1>
        <h2 className="text-2xl font-black text-slate-800 mb-3">Page Not Found</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Oops! The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Home
          </Link>
          <Link to="/doctors" className="btn-secondary">
            Find Doctors
          </Link>
        </div>
      </div>
    </div>
  );
}
