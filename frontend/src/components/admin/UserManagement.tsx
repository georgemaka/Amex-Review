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
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PersonAdd,
  Assignment,
  Notifications,
} from '@mui/icons-material';
import { Autocomplete } from '@mui/material';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { AppDispatch } from '../../store';
import { addNotification } from '../../store/slices/uiSlice';
import api from '../../services/api';
import AssignmentManagement from './AssignmentManagement';
import AlertSettings from './AlertSettings';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  last_login?: string;
  created_at: string;
  assignment_count?: number;
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
  const [activeTab, setActiveTab] = useState(0);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedUserAssignments, setSelectedUserAssignments] = useState<any[]>([]);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [addAssignmentDialogOpen, setAddAssignmentDialogOpen] = useState(false);
  const [availableCardholders, setAvailableCardholders] = useState<any[]>([]);
  const [selectedCardholderId, setSelectedCardholderId] = useState<number | null>(null);

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

  const handleViewAssignments = async (user: User) => {
    setViewingUser(user);
    try {
      // Fetch assignments based on user role
      let response;
      if (user.role === 'coder') {
        // Get cardholder assignments for coder
        response = await api.getUserAssignments(user.id, 'coder');
      } else if (user.role === 'reviewer') {
        // Get cardholder assignments for reviewer
        response = await api.getUserAssignments(user.id, 'reviewer');
      }
      setSelectedUserAssignments(response || []);
      setAssignmentDialogOpen(true);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to fetch user assignments'
      }));
      setSelectedUserAssignments([]);
      setAssignmentDialogOpen(true);
    }
  };

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!viewingUser) return;
    
    if (window.confirm('Are you sure you want to remove this assignment?')) {
      try {
        await api.removeUserAssignment(assignmentId, viewingUser.role);
        dispatch(addNotification({
          type: 'success',
          message: 'Assignment removed successfully'
        }));
        // Refresh assignments
        handleViewAssignments(viewingUser);
        // Refresh users to update counts
        fetchUsers();
      } catch (error) {
        dispatch(addNotification({
          type: 'error',
          message: 'Failed to remove assignment'
        }));
      }
    }
  };

  const handleAddAssignment = async (user: User | null) => {
    if (!user) return;
    
    setViewingUser(user);
    try {
      // Fetch all cardholders
      const allCardholders = await api.getCardholders({ is_active: true });
      
      // Get current assignments to filter out already assigned ones
      const currentAssignments = await api.getUserAssignments(user.id, user.role);
      const assignedIds = currentAssignments.map((a: any) => a.cardholder_id);
      
      // Filter out already assigned cardholders
      const available = allCardholders.filter((ch: any) => !assignedIds.includes(ch.id));
      setAvailableCardholders(available);
      setAddAssignmentDialogOpen(true);
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to load available cardholders'
      }));
    }
  };

  const handleConfirmAddAssignment = async () => {
    if (!viewingUser || !selectedCardholderId) return;
    
    try {
      await api.addUserAssignment(viewingUser.id, selectedCardholderId, viewingUser.role);
      dispatch(addNotification({
        type: 'success',
        message: 'Assignment added successfully'
      }));
      setAddAssignmentDialogOpen(false);
      setSelectedCardholderId(null);
      // Refresh assignments
      handleViewAssignments(viewingUser);
      // Refresh users to update counts
      fetchUsers();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to add assignment'
      }));
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
        {activeTab === 0 && (
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={handleCreateUser}
          >
            Add User
          </Button>
        )}
      </Box>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Users" />
          <Tab label="Assignments" icon={<Assignment />} iconPosition="start" />
          <Tab label="Alert Settings" icon={<Notifications />} iconPosition="start" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Assignments</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
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
                    {user.role !== 'admin' && (
                      <Chip
                        label={user.assignment_count || 0}
                        size="small"
                        variant="outlined"
                        onClick={() => handleViewAssignments(user)}
                        sx={{ cursor: 'pointer' }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={user.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {user.last_login 
                      ? new Date(user.last_login).toLocaleString()
                      : 'Never'
                    }
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
      )}

      {activeTab === 1 && <AssignmentManagement />}
      
      {activeTab === 2 && <AlertSettings />}

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

      {/* Assignment Dialog */}
      <Dialog 
        open={assignmentDialogOpen} 
        onClose={() => setAssignmentDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {viewingUser && (
            <>Assignments for {viewingUser.first_name} {viewingUser.last_name}</>  
          )}
        </DialogTitle>
        <DialogContent>
          {selectedUserAssignments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No cardholders assigned to this user
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Cardholder Name</TableCell>
                    <TableCell>Card Number</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedUserAssignments.map((assignment) => (
                    <TableRow key={assignment.id} hover>
                      <TableCell>{assignment.cardholder_name || 'N/A'}</TableCell>
                      <TableCell>{assignment.card_number || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={assignment.is_active ? 'Active' : 'Inactive'}
                          size="small"
                          color={assignment.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => handleAddAssignment(viewingUser)} 
            startIcon={<Add />}
            variant="outlined"
          >
            Add Assignment
          </Button>
          <Button onClick={() => setAssignmentDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Assignment Dialog */}
      <Dialog 
        open={addAssignmentDialogOpen} 
        onClose={() => {
          setAddAssignmentDialogOpen(false);
          setSelectedCardholderId(null);
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          Add Assignment for {viewingUser?.first_name} {viewingUser?.last_name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Autocomplete
              options={availableCardholders}
              getOptionLabel={(option) => `${option.full_name} (${option.card_last_four || 'N/A'})`}
              value={availableCardholders.find(c => c.id === selectedCardholderId) || null}
              onChange={(event, newValue) => {
                setSelectedCardholderId(newValue?.id || null);
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Select Cardholder" 
                  fullWidth
                  helperText={availableCardholders.length === 0 ? "No available cardholders to assign" : ""}
                />
              )}
              noOptionsText="No cardholders available"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddAssignmentDialogOpen(false);
            setSelectedCardholderId(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmAddAssignment}
            variant="contained"
            disabled={!selectedCardholderId}
          >
            Add Assignment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;