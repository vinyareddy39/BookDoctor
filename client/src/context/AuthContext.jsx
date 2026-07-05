import { createContext, useContext, useEffect, useState } from "react";
import API from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);   // { token, role, name, email, _id }
  const [loading, setLoading] = useState(true);

  // Restore session on page refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("userData");
    if (token && userData) {
      setUser({ token, ...JSON.parse(userData) });
    }
    setLoading(false);
  }, []);

  // Persist user data to localStorage
  const persist = (token, data) => {
    localStorage.setItem("token", token);
    localStorage.setItem("userData", JSON.stringify(data));
    setUser({ token, ...data });
  };

  // LOGIN
  const login = async (email, password) => {
    const res = await API.post("/auth/login", { email, password });
    const payload = res.data?.data;
    const token = payload?.token;
    if (token) {
      persist(token, {
        _id: payload._id,
        name: payload.name,
        email: payload.email,
        role: payload.role,
      });
    }
    return res.data;
  };

  // REGISTER
  const register = async (data) => {
    const res = await API.post("/auth/register", data);
    return res.data; // Don't persist yet since email verification is pending
  };

  // LOGOUT
  const logout = async () => {
    try {
      await API.post("/auth/logout");
    } catch (err) {
      console.warn("Logout request failed:", err.message);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("userData");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        loading,
        isLoggedIn: !!user,
        isDoctor: user?.role === "doctor",
        isPatient: user?.role === "patient",
        isAdmin: user?.role === "admin",
        role: user?.role || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
