import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PersonAdd,
} from '@mui/icons-material';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { AppDispatch } from '../../store';
import { addNotification } from '../../store/slices/uiSlice';
import api from '../../services/api';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

const validationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  first_name: Yup.string()
    .required('First name is required'),
  last_name: Yup.string()
    .required('Last name is required'),
  role: Yup.string()
    .required('Role is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .when('$isNew', {
      is: true,
      then: (schema) => schema.required('Password is required'),
    }),
});

const UserManagement: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to fetch users',
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await api.deleteUser(userId);
        dispatch(addNotification({
          type: 'success',
          message: 'User deleted successfully',
        }));
        fetchUsers();
      } catch (error) {
        dispatch(addNotification({
          type: 'error',
          message: 'Failed to delete user',
        }));
      }
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, values);
        dispatch(addNotification({
          type: 'success',
          message: 'User updated successfully',
        }));
      } else {
        await api.createUser(values);
        dispatch(addNotification({
          type: 'success',
          message: 'User created successfully',
        }));
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      dispatch(addNotification({
        type: 'error',
        message: error.response?.data?.detail || 'Failed to save user',
      }));
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'reviewer':
        return 'warning';
      case 'coder':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">User Management</Typography>
        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={handleCreateUser}
        >
          Add User
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    {user.first_name} {user.last_name}
                    {user.is_superuser && (
                      <Chip
                        label="Super"
                        size="small"
                        color="secondary"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.role.toUpperCase()}
                      size="small"
                      color={getRoleColor(user.role)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={user.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEditUser(user)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={user.is_superuser}
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* User Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Create New User'}
        </DialogTitle>
        <Formik
          initialValues={{
            email: editingUser?.email || '',
            first_name: editingUser?.first_name || '',
            last_name: editingUser?.last_name || '',
            role: editingUser?.role || 'coder',
            is_active: editingUser?.is_active ?? true,
            password: '',
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          context={{ isNew: !editingUser }}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form>
              <DialogContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="email"
                      label="Email"
                      value={values.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      name="first_name"
                      label="First Name"
                      value={values.first_name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.first_name && Boolean(errors.first_name)}
                      helperText={touched.first_name && errors.first_name}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      name="last_name"
                      label="Last Name"
                      value={values.last_name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.last_name && Boolean(errors.last_name)}
                      helperText={touched.last_name && errors.last_name}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Role</InputLabel>
                      <Select
                        name="role"
                        value={values.role}
                        onChange={handleChange}
                        label="Role"
                      >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="coder">Coder</MenuItem>
                        <MenuItem value="reviewer">Reviewer</MenuItem>
                        <MenuItem value="viewer">Viewer</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        name="is_active"
                        value={values.is_active ? 'active' : 'inactive'}
                        onChange={(e) => handleChange({
                          target: {
                            name: 'is_active',
                            value: e.target.value === 'active',
                          },
                        })}
                        label="Status"
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {(!editingUser || values.password) && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="password"
                        name="password"
                        label={editingUser ? 'New Password (optional)' : 'Password'}
                        value={values.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.password && Boolean(errors.password)}
                        helperText={touched.password && errors.password}
                      />
                    </Grid>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                >
                  {editingUser ? 'Update' : 'Create'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </Box>
  );
};

export default UserManagement;