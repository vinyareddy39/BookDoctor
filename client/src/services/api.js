import axios from "axios";

let baseURL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "/api";
if (baseURL && baseURL.startsWith("http") && !baseURL.endsWith("/api")) {
  baseURL = baseURL.replace(/\/$/, "") + "/api";
}

const API = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // critical for cookie support
});

// Attach token automatically to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for automatic token refresh
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      originalRequest._retry = true;
      try {
        const storedRefreshToken = localStorage.getItem("refreshToken");
        const res = await axios.post(
          `${baseURL}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          {
            withCredentials: true,
            headers: storedRefreshToken ? { "x-refresh-token": storedRefreshToken } : {},
          }
        );
        const newToken = res.data?.data?.token;
        const newRefreshToken = res.data?.data?.refreshToken;
        if (newToken) {
          localStorage.setItem("token", newToken);
          if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken);
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return API(originalRequest);
        }
      } catch (refreshErr) {
        console.warn("Token refresh attempt failed:", refreshErr?.message);
        // Do not aggressively wipe session on transient network or server errors.
        // User remains logged in until they explicitly click Logout.
      }
    }
    return Promise.reject(error);
  }
);

export default API;
