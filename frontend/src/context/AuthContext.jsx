import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase.js';

// Role is determined by Firebase custom claims (idTokenResult.claims.role).
// Fallback: if no claim, we default to 'teacher' so existing faculty accounts still work.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Firebase user object
  const [role, setRole] = useState(null);        // 'admin' | 'teacher' | 'student'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult();
        const claimedRole = tokenResult.claims.role || 'teacher';
        setUser(firebaseUser);
        setRole(claimedRole);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const tokenResult = await cred.user.getIdTokenResult();
      const claimedRole = tokenResult.claims.role || 'teacher';
      setUser(cred.user);
      setRole(claimedRole);
      setLoading(false);
      return { success: true, role: claimedRole };
    } catch (err) {
      const msg = firebaseErrorMessage(err.code);
      setError(msg);
      setLoading(false);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, role, loading, error, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function firebaseErrorMessage(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    default:
      return 'Login failed. Please try again.';
  }
}
