import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Fees from './pages/Fees';
import FeeReports from './pages/FeeReports';
import Exams from './pages/Exams';
import SubjectMaster from './pages/SubjectMaster';
// import Hostel from './pages/Hostel';
// import Attendance from './pages/Attendance';
// import Medical from './pages/Medical';
// import FoodWallet from './pages/FoodWallet';

import Reports from './pages/Reports';
import AdminSettings from './pages/AdminSettings';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useAuth();
  if (!isReady) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading...</div>;
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady, user } = useAuth();
  if (!isReady) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/students" element={
            <PrivateRoute>
              <Layout>
                <Students />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/exams" element={
            <PrivateRoute>
              <Layout>
                <Exams />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/exams/subjects" element={
            <PrivateRoute>
              <Layout>
                <SubjectMaster />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/fees" element={
            <PrivateRoute>
              <Layout>
                <Fees />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/fees/reports" element={
            <PrivateRoute>
              <Layout>
                <FeeReports />
              </Layout>
            </PrivateRoute>
          } />
          {/* <Route path="/hostel" element={
            <PrivateRoute>
              <Layout>
                <Hostel />
              </Layout>
            </PrivateRoute>
          } /> */}
          {/* <Route path="/attendance" element={
            <PrivateRoute>
              <Layout>
                <Attendance />
              </Layout>
            </PrivateRoute>
          } /> */}
          {/* <Route path="/medical" element={
            <PrivateRoute>
              <Layout>
                <Medical />
              </Layout>
            </PrivateRoute>
          } /> */}
          {/* <Route path="/food-wallet" element={
            <PrivateRoute>
              <Layout>
                <FoodWallet />
              </Layout>
            </PrivateRoute>
          } /> */}
          <Route path="/reports" element={
            <PrivateRoute>
              <Layout>
                <Reports />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/admin-settings" element={
            <AdminRoute>
              <Layout>
                <AdminSettings />
              </Layout>
            </AdminRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
