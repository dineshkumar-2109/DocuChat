import { useCallback, useEffect, useState } from "react";
import { auth } from "./api.js";
import { useTheme } from "./theme.js";
import { useToast } from "./toast.jsx";
import AuthPage from "./AuthPage.jsx";
import Workspace from "./Workspace.jsx";

export default function App() {
  const [user, setUser] = useState(() => (auth.token ? JSON.parse(localStorage.getItem("user") || "null") : null));
  const [theme, toggleTheme] = useTheme();
  const toast = useToast();

  const signIn = ({ token, user }) => {
    auth.set(token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
  };

  const signOut = useCallback((message) => {
    auth.set(null);
    localStorage.removeItem("user");
    setUser(null);
    if (message) toast(message);
  }, [toast]);

  useEffect(() => {
    auth.onUnauthorized(() => signOut("Your session expired. Please sign in again."));
  }, [signOut]);

  return user
    ? <Workspace user={user} onSignOut={() => signOut()} theme={theme} onToggleTheme={toggleTheme} />
    : <AuthPage onSignedIn={signIn} theme={theme} onToggleTheme={toggleTheme} />;
}
