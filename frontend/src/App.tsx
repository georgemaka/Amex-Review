import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';
import { RootState, AppDispatch } from './store';
import { fetchCurrentUser, logout } from './store/slices/authSlice';
import Layout from './components/common/Layout';
import PrivateRoute from './components/common/PrivateRoute';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import StatementList from './components/statements/StatementList';
import StatementDetail from './components/statements/StatementDetail';
import CodingInterface from './components/coding/CodingInterface';
import CodeTransactions from './components/coding/CodeTransactions';
import CodeTransactionsDebug from './components/coding/CodeTransactionsDebug';
// import CodeTransactionsSimple from './components/coding/CodeTransactionsSimple';
import UserManagement from './components/admin/UserManagement';
import CardholderManagement from './components/admin/CardholderManagement';
import EmailHub from './components/admin/EmailHub';
import NotificationSnackbar from './components/common/NotificationSnackbar';
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard';
import ErrorBoundary from './components/common/ErrorBoundary';
import api from './services/api';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { token, isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Configure API service with auth handlers
    api.setAuthHandlers(
      () => token || localStorage.getItem('token'),
      () => dispatch(logout())
    );
    
    if (token) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, token]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/statements" element={<StatementList />} />
            <Route path="/statements/:id" element={<StatementDetail />} />
            <Route path="/coding/:statementId" element={<CodingInterface />} />
            <Route path="/coding" element={<ErrorBoundary><CodeTransactions /></ErrorBoundary>} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/cardholders" element={<CardholderManagement />} />
            <Route path="/admin/emails" element={<EmailHub />} />
          </Route>
        </Route>
      </Routes>
      <NotificationSnackbar />
    </>
  );
}

export default App;