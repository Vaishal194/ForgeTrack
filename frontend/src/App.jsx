import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import DevTokens from './pages/DevTokens';
import Login from './pages/Login';
import Forbidden from './pages/Forbidden';
import RoleGuard from './components/RoleGuard';
import MainLayout from './components/Layout/Main';

import Dashboard from './pages/mentor/Dashboard';
import MarkAttendance from './pages/mentor/MarkAttendance';
import StudentHistory from './pages/mentor/StudentHistory';
import Materials from './pages/mentor/Materials';
import UploadCSV from './pages/mentor/UploadCSV';

import {
  MyAttendance,
  Upcoming,
  StudentMaterials
} from './pages/Stubs';

function RootRedirect() {
  const [target, setTarget] = useState(null);

  const inferRoleFromUser = (user) => {
    const metaRole = user?.user_metadata?.role;
    if (metaRole === 'mentor' || metaRole === 'student') return metaRole;
    if (user?.email?.toLowerCase().endsWith('@forge.com')) return 'student';
    return 'mentor';
  };

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted && !target) {
        console.warn("Auth mapping taking too long, falling back to login");
        setTarget('/login');
      }
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        setTarget('/login');
        return;
      }
      supabase.from('users').select('role').eq('id', session.user.id).single()
        .then(({ data, error }) => {
          if (!mounted) return;
          const role = (!error && (data?.role === 'mentor' || data?.role === 'student'))
            ? data.role
            : inferRoleFromUser(session.user);
          if (role === 'mentor') setTarget('/dashboard');
          else if (role === 'student') setTarget('/me/attendance');
          else setTarget('/403');
        })
        .catch(() => {
          if (!mounted) return;
          const role = inferRoleFromUser(session.user);
          if (role === 'mentor') setTarget('/dashboard');
          else if (role === 'student') setTarget('/me/attendance');
          else setTarget('/403');
        });
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  if (!target) {
    return (
      <div className="flex w-full h-screen items-center justify-center app-main">
        <p className="text-fg-secondary font-body">Loading ForgeTrack...</p>
      </div>
    );
  }
  return <Navigate to={target} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Unauthenticated Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="/dev-tokens" element={<DevTokens />} />

        {/* Global Root Interceptor */}
        <Route path="/" element={<RootRedirect />} />

        {/* Guarded Structural Routes */}
        <Route element={<RoleGuard allowedRoles={['mentor', 'student']} />}>
          <Route element={<MainLayout />}>

            {/* Mentor specific routes */}
            <Route element={<RoleGuard allowedRoles={['mentor']} />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="attendance" element={<MarkAttendance />} />
              <Route path="history" element={<StudentHistory />} />
              <Route path="materials" element={<Materials />} />
              <Route path="upload" element={<UploadCSV />} />
            </Route>

            {/* Student specific routes */}
            <Route element={<RoleGuard allowedRoles={['student']} />}>
              <Route path="me/attendance" element={<MyAttendance />} />
              <Route path="me/upcoming" element={<Upcoming />} />
              <Route path="me/materials" element={<StudentMaterials />} />
            </Route>
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
