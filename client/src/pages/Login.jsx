import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Sparkles, Lock, User, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
  };

  /* ─── Inline styles ─── */
  const s = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: '24px',
      overflow: 'hidden',
      background: '#060d18',
    },
    orb1: {
      position: 'absolute',
      top: '15%',
      left: '10%',
      width: 480,
      height: 480,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(30,80,180,0.18) 0%, transparent 70%)',
      pointerEvents: 'none',
      filter: 'blur(0px)',
    },
    orb2: {
      position: 'absolute',
      bottom: '10%',
      right: '8%',
      width: 420,
      height: 420,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(212,175,55,0.09) 0%, transparent 70%)',
      pointerEvents: 'none',
    },
    orb3: {
      position: 'absolute',
      top: '55%',
      left: '55%',
      width: 300,
      height: 300,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(30,80,180,0.08) 0%, transparent 70%)',
      pointerEvents: 'none',
    },
    card: {
      position: 'relative',
      zIndex: 10,
      width: '100%',
      maxWidth: 420,
      background: 'rgba(255,255,255,0.028)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 24,
      padding: '40px 36px',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 40px 100px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      background: 'linear-gradient(135deg, #d4af37, #f0c040)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 18px',
      boxShadow: '0 8px 28px rgba(212,175,55,0.35)',
    },
    heading: {
      margin: 0,
      fontSize: 22,
      fontWeight: 800,
      color: '#f1f5f9',
      letterSpacing: '-0.02em',
      textAlign: 'center',
    },
    subheading: {
      margin: '6px 0 0',
      fontSize: 13,
      color: '#6b7280',
      textAlign: 'center',
    },
    divider: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '28px 0',
    },
    dividerLine: {
      flex: 1,
      height: 1,
      background: 'rgba(255,255,255,0.07)',
    },
    dividerText: {
      fontSize: 11,
      color: '#4b5563',
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    },
    label: {
      display: 'block',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#6b7280',
      marginBottom: 7,
    },
    inputWrap: {
      position: 'relative',
    },
    iconInInput: {
      position: 'absolute',
      left: 14,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#4b5563',
      pointerEvents: 'none',
      display: 'flex',
    },
    input: {
      width: '100%',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 12,
      padding: '11px 14px 11px 42px',
      fontSize: 13,
      color: '#e2e8f0',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s',
    },
    errorBox: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 9,
      background: 'rgba(248,113,113,0.08)',
      border: '1px solid rgba(248,113,113,0.2)',
      borderRadius: 12,
      padding: '11px 14px',
      marginBottom: 22,
      color: '#f87171',
      fontSize: 13,
    },
    submitBtn: {
      width: '100%',
      padding: '13px',
      borderRadius: 13,
      border: 'none',
      background: 'linear-gradient(135deg, #d4af37, #f0c040)',
      color: '#0d1b2a',
      fontSize: 14,
      fontWeight: 800,
      cursor: 'pointer',
      letterSpacing: '0.01em',
      boxShadow: '0 6px 24px rgba(212,175,55,0.3)',
      transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    spinner: {
      width: 16,
      height: 16,
      borderRadius: '50%',
      border: '2.5px solid rgba(13,27,42,0.3)',
      borderTopColor: '#0d1b2a',
      animation: 'spin 0.8s linear infinite',
    },
    footer: {
      marginTop: 24,
      textAlign: 'center',
      fontSize: 11,
      color: '#374151',
      fontWeight: 500,
    },
  };

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #0d1b2a inset !important;
          -webkit-text-fill-color: #e2e8f0 !important;
        }
      `}</style>

      {/* Background orbs */}
      <div style={s.orb1} />
      <div style={s.orb2} />
      <div style={s.orb3} />

      {/* Subtle grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%)',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={s.card}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={s.iconWrap}>
            <Sparkles size={22} color="#0d1b2a" />
          </div>
          <h1 style={s.heading}>Takaful Analytics</h1>
          <p style={s.subheading}>Sign in to your admin dashboard</p>
        </div>

        {/* Divider */}
        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>credentials</span>
          <div style={s.dividerLine} />
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={s.errorBox}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={s.label}>Username</label>
            <div style={s.inputWrap}>
              <span style={s.iconInInput}><User size={15} /></span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                style={s.input}
                onFocus={e => e.target.style.borderColor = 'rgba(212,175,55,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
              />
            </div>
          </div>

          <div>
            <label style={s.label}>Password</label>
            <div style={s.inputWrap}>
              <span style={s.iconInInput}><Lock size={15} /></span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={s.input}
                onFocus={e => e.target.style.borderColor = 'rgba(212,175,55,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...s.submitBtn,
              opacity: loading ? 0.8 : 1,
              marginTop: 6,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 8px 32px rgba(212,175,55,0.45)'; e.currentTarget.style.transform = 'scale(1.01)'; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(212,175,55,0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.99)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.01)'; }}
          >
            {loading ? (
              <>
                <div style={s.spinner} />
                Authenticating…
              </>
            ) : 'Sign in'}
          </button>
        </form>

        {/* Footer note */}
        <p style={s.footer}>Takaful Management System · Secured access</p>
      </motion.div>
    </div>
  );
};

export default Login;