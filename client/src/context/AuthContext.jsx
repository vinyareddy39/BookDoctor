import { createContext, useContext, useEffect, useState } from "react";
import API from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Synchronously restore session from localStorage so there's zero auth flicker or accidental redirect
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("userData");
      if (token && userData) {
        return { token, ...JSON.parse(userData) };
      }
    } catch (err) {
      console.warn("Failed to restore session from localStorage:", err);
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  // Persist user data to localStorage
  const persist = (token, data, refreshToken) => {
    localStorage.setItem("token", token);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
    localStorage.setItem("userData", JSON.stringify(data));
    setUser({ token, ...data });
  };

  // LOGIN
  const login = async (email, password, expectedRole) => {
    const res = await API.post("/auth/login", { email, password });
    const payload = res.data?.data;
    const token = payload?.token;
    const refreshToken = payload?.refreshToken;
    
    // Check role before persisting the token
    if (expectedRole && payload?.role !== expectedRole) {
      throw new Error(`Access denied. Please use the ${payload?.role === 'doctor' ? 'Doctor' : 'Patient'} portal.`);
    }

    if (token) {
      persist(
        token,
        {
          _id: payload._id,
          name: payload.name,
          email: payload.email,
          role: payload.role,
        },
        refreshToken
      );
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
      const refreshToken = localStorage.getItem("refreshToken");
      await API.post("/auth/logout", { refreshToken });
    } catch (err) {
      console.warn("Logout request failed:", err.message);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("userData");
      setUser(null);
    }
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
