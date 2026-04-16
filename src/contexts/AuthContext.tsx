import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, AuthUser, AppRole, clearAuthTokens, getAccessToken, setAuthTokens } from "@/lib/api";

interface AuthSession {
  accessToken: string;
  refreshToken: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ emailVerificationRequired: boolean }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const applyUser = (nextUser: AuthUser | null) => {
    setUser(nextUser);
    setRoles(nextUser?.roles || []);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const hash = window.location.hash.startsWith("#")
        ? new URLSearchParams(window.location.hash.slice(1))
        : null;
      const hashAccessToken = hash?.get("access_token");
      const hashRefreshToken = hash?.get("refresh_token");
      const hashType = hash?.get("type");

      if (hashAccessToken) {
        setAuthTokens(hashAccessToken, hashRefreshToken);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }

      const accessToken = getAccessToken();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const me = await api.get<AuthUser>("/auth/me");
        setSession({ accessToken, refreshToken: null });
        applyUser(me);

        if (hashType === "signup" || hashType === "recovery") {
          // No-op: token from hash is now persisted and user is loaded.
        }
      } catch {
        clearAuthTokens();
        setSession(null);
        applyUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await api.post<{
      access_token: string;
      refresh_token: string;
      user: AuthUser;
    }>("/auth/sign-in", { email, password }, { auth: false });

    setAuthTokens(data.access_token, data.refresh_token);
    setSession({ accessToken: data.access_token, refreshToken: data.refresh_token || null });
    applyUser(data.user);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const data = await api.post<{
      email_verification_required: boolean;
      access_token: string | null;
      refresh_token: string | null;
      user: AuthUser;
    }>("/auth/sign-up", {
      email,
      password,
      display_name: displayName,
    }, { auth: false });

    if (data.access_token) {
      setAuthTokens(data.access_token, data.refresh_token);
      setSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
      });
      applyUser(data.user);
    }

    return {
      emailVerificationRequired: data.email_verification_required,
    };
  };

  const signOut = async () => {
    try {
      if (getAccessToken()) {
        await api.post("/auth/sign-out");
      }
    } finally {
      clearAuthTokens();
      setSession(null);
      applyUser(null);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signIn, signUp, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
