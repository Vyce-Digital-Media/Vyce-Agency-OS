import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, type AuthPayload } from "@/api/auth";

type AppRole = "admin" | "manager" | "team_member" | "client";

interface User {
  id: string;
  email: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  internal_label: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  profile: null,
  role: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshSession: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const TOKEN_KEY = "agency_os_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const applyAuthPayload = (payload: AuthPayload, nextToken?: string | null) => {
    setUser(payload.user);
    setProfile(payload.profile as Profile | null);
    setRole(payload.role);
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
    }
  };

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  const refreshSession = async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      clearAuth();
      setLoading(false);
      return;
    }

    setToken(storedToken);
    try {
      const payload = await authApi.me(storedToken);
      applyAuthPayload(payload);
    } catch (_error) {
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const callbackToken = url.searchParams.get("token");
    if (callbackToken) {
      localStorage.setItem(TOKEN_KEY, callbackToken);
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }

    refreshSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    const payload = await authApi.login(email, password);
    if (!payload.token) throw new Error("Login did not return a session token");
    applyAuthPayload(payload, payload.token);
  };

  const signOut = async () => {
    const activeToken = token || localStorage.getItem(TOKEN_KEY);
    
    // Clear local state immediately to ensure responsive UI
    clearAuth();
    navigate("/auth");

    // Attempt backend logout if we had a token
    if (activeToken) {
      try {
        await authApi.logout(activeToken);
      } catch (_error) {
        // Local logout completes even if backend fails
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, profile, role, loading, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
