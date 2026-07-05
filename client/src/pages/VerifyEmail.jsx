import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import API from "../services/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying"); // verifying, success, error
  const [message, setMessage] = useState("Verifying your email address...");
  const token = searchParams.get("token");

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Invalid or missing verification token.");
        return;
      }
      try {
        const res = await API.get(`/auth/verify-email/${token}`);
        setStatus("success");
        setMessage(res.data?.message || "Email verified successfully!");
      } catch (err) {
        setStatus("error");
        setMessage(err.response?.data?.message || "Verification failed. The token may be expired.");
      }
    };
    verify();
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-surface px-6">
      <div className="card w-full max-w-md p-8 bg-white border border-slate-200 text-center space-y-6">
        {status === "verifying" && (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-slate-800">Verifying Email...</h1>
            <p className="text-slate-500">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-black text-slate-900">Email Verified!</h1>
            <p className="text-slate-600">{message}</p>
            <Link to="/login" className="btn-primary inline-block w-full py-3 mt-4">
              Go to Login
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-5xl">❌</div>
            <h1 className="text-2xl font-black text-slate-900">Verification Failed</h1>
            <p className="text-red-600 font-medium">{message}</p>
            <Link to="/login" className="btn-primary inline-block w-full py-3 mt-4">
              Return to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
