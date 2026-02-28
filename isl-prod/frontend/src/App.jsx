import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import useAuthStore from './store/authStore';
import LoginPage  from './pages/LoginPage';
import Dashboard  from './components/Dashboard';
import CustomCursor from './components/CustomCursor';
import './styles/globals.css';

export default function App() {
  const { user, accessToken, hydrate } = useAuthStore();

  useEffect(() => { hydrate(); }, []);

  const isLoggedIn = !!(user && accessToken);

  return (
    <div className="noise">
      <CustomCursor />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--surface2, #1c1f28)',
            color: 'var(--text, #e2e8f0)',
            border: '1px solid var(--border, #252a35)',
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13,
            borderRadius: 10,
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <AnimatePresence mode="wait">
        {isLoggedIn ? (
          <motion.div key="dashboard"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.3 }}>
            <Dashboard />
          </motion.div>
        ) : (
          <motion.div key="login"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.3 }}>
            <LoginPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
