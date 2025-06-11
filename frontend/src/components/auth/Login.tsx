import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  CircularProgress,
} from '@mui/material';
import { RootState, AppDispatch } from '../../store';
import { login, clearError } from '../../store/slices/authSlice';

const validationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user, isLoading, error } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleSubmit = async (values: { email: string; password: string }) => {
    await dispatch(login(values));
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography component="h1" variant="h4" sx={{ mb: 1 }}>
              AMEX Coding Portal
            </Typography>
            <Typography component="h2" variant="h6" color="text.secondary" sx={{ mb: 3 }}>
              Sign in to your account
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, errors, touched, handleChange, handleBlur }) => (
              <Form>
                <TextField
                  fullWidth
                  id="email"
                  name="email"
                  label="Email Address"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.email && Boolean(errors.email)}
                  helperText={touched.email && errors.email}
                  margin="normal"
                  autoComplete="email"
                  autoFocus
                />
                <TextField
                  fullWidth
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.password && Boolean(errors.password)}
                  helperText={touched.password && errors.password}
                  margin="normal"
                  autoComplete="current-password"
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
                </Button>
              </Form>
            )}
          </Formik>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Default Admin: admin@sukut.com / admin123
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;