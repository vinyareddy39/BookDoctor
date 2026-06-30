import { Component } from "react";
import { Link } from "react-router-dom";

/**
 * Global Error Boundary
 * Catches any uncaught JS errors in child components and shows a friendly
 * fallback UI instead of a white blank page / full crash.
 *
 * Usage: wrap <App /> or individual sections in <ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in dev; swap with a logging service (e.g. Sentry) in prod
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface px-6">
          <div className="text-center max-w-md animate-fade-in-up">
            {/* Illustration */}
            <div className="text-8xl mb-6">⚠️</div>
            <h1 className="text-3xl font-black text-slate-800 mb-3">Something went wrong</h1>
            <p className="text-slate-500 mb-2 leading-relaxed">
              An unexpected error occurred in this section of the app.
              Your data is safe. Please try refreshing or go back to the homepage.
            </p>

            {/* Error detail for development */}
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 overflow-auto max-h-40">
                {this.state.error.toString()}
              </pre>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <button
                onClick={this.handleReset}
                className="btn-secondary"
              >
                Try Again
              </button>
              <Link to="/" onClick={this.handleReset} className="btn-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
