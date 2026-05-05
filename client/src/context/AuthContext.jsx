import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { authStorage } from "../utils/api";

const USER_STORAGE_KEY = "commerce-user-v2";
const AuthContext = createContext(null);

const normalizeUser = (user) => {
  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return {
    ...user,
    name: name || user.name || user.email,
  };
};

const readStoredUser = () => {
  try {
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);
    return savedUser ? normalizeUser(JSON.parse(savedUser)) : null;
  } catch {
    return null;
  }
};

const persistUser = (user) => {
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }

  const nextUser = normalizeUser(user);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
  return nextUser;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [isLoading, setIsLoading] = useState(Boolean(authStorage.getAccessToken()));

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      if (!authStorage.getAccessToken()) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.get("/auth/me");
        if (!isMounted) return;
        setUser(persistUser(data.user));
      } catch {
        authStorage.clearTokens();
        if (isMounted) setUser(persistUser(null));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const commitSession = useCallback((data) => {
    authStorage.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    const nextUser = persistUser(data.user);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const data = await api.post("/auth/login", { email, password });
      return commitSession(data);
    },
    [commitSession],
  );

  const register = useCallback(
    async ({ firstName, lastName, email, password, phone }) => {
      const data = await api.post("/auth/register", {
        firstName,
        lastName,
        email,
        password,
        phone,
      });
      return commitSession(data);
    },
    [commitSession],
  );

  const logout = useCallback(async () => {
    const refreshToken = authStorage.getRefreshToken();

    try {
      if (refreshToken) await api.post("/auth/logout", { refreshToken });
    } finally {
      authStorage.clearTokens();
      setUser(persistUser(null));
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const data = await api.put("/auth/me", updates);
    const nextUser = persistUser(data.user);
    setUser(nextUser);
    return nextUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "ADMIN",
      login,
      register,
      logout,
      updateProfile,
    }),
    [isLoading, login, logout, register, updateProfile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
