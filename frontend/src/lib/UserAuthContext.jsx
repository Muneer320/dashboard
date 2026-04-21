/**
 * UserAuthContext — wraps user login/logout/me for the main user app.
 * Uses /auth/login + /auth/me endpoints via api.js.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi, token } from '../lib/api';

const UserAuthContext = createContext(null);

export function UserAuthProvider({ children }) {
  const [user, setUser]     = useState(null);   // { id, username, name, is_attending }
  const [ready, setReady]   = useState(false);  // true once we've checked token
  const [error, setError]   = useState('');

  // On mount: if there's a stored token, hydrate user from /auth/me
  useEffect(() => {
    const stored = token.getUser();
    if (!stored) { setReady(true); return; }
    authApi.me()
      .then(setUser)
      .catch(() => token.clearUser())  // stale/invalid token — clear it
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    setError('');
    try {
      const res = await authApi.login({ email, password });
      token.setUser(res.access_token);
      const me = await authApi.me();
      setUser(me);
      return true;
    } catch (e) {
      setError(e.message || 'Login failed');
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    token.clearUser();
    setUser(null);
  }, []);

  return (
    <UserAuthContext.Provider value={{ user, ready, error, setError, login, logout }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  return useContext(UserAuthContext);
}
