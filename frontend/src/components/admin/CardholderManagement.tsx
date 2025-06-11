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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Upload,
  Person,
  Assignment,
  Group,
} from '@mui/icons-material';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { AppDispatch } from '../../store';
import { addNotification } from '../../store/slices/uiSlice';
import api from '../../services/api';

interface Cardholder {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  employee_id?: string;
  department?: string;
  is_active: boolean;
  created_at: string;
}

interface Assignment {
  id: number;
  coder_id: number;
  coder?: any;
  cc_emails: string[];
  is_active: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const validationSchema = Yup.object({
  full_name: Yup.string().required('Full name is required'),
  first_name: Yup.string().required('First name is required'),
  last_name: Yup.string().required('Last name is required'),
  employee_id: Yup.string(),
  department: Yup.string(),
});

const CardholderManagement: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCardholder, setEditingCardholder] = useState<Cardholder | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedCardholder, setSelectedCardholder] = useState<Cardholder | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchCardholders();
    fetchUsers();
  }, []);

  const fetchCardholders = async () => {
    try {
      const data = await api.getCardholders({ is_active: true });
      setCardholders(data);
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to fetch cardholders',
      }));
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data.filter((u: any) => u.role === 'coder' || u.role === 'reviewer'));
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const fetchAssignments = async (cardholderId: number) => {
    try {
      const data = await api.getCardholderAssignments(cardholderId);
      setAssignments(data);
    } catch (error) {
      console.error('Failed to fetch assignments');
    }
  };

  const handleCreateCardholder = () => {
    setEditingCardholder(null);
    setDialogOpen(true);
  };

  const handleEditCardholder = (cardholder: Cardholder) => {
    setEditingCardholder(cardholder);
    setDialogOpen(true);
  };

  const handleDeleteCardholder = async (cardholderId: number) => {
    if (window.confirm('Are you sure you want to deactivate this cardholder?')) {
      try {
        await api.deleteCardholder(cardholderId);
        dispatch(addNotification({
          type: 'success',
          message: 'Cardholder deactivated successfully',
        }));
        fetchCardholders();
      } catch (error) {
        dispatch(addNotification({
          type: 'error',
          message: 'Failed to deactivate cardholder',
        }));
      }
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingCardholder) {
        await api.updateCardholder(editingCardholder.id, values);
        dispatch(addNotification({
          type: 'success',
          message: 'Cardholder updated successfully',
        }));
      } else {
        await api.createCardholder(values);
        dispatch(addNotification({
          type: 'success',
          message: 'Cardholder created successfully',
        }));
      }
      setDialogOpen(false);
      fetchCardholders();
    } catch (error: any) {
      dispatch(addNotification({
        type: 'error',
        message: error.response?.data?.detail || 'Failed to save cardholder',
      }));
    }
  };

  const handleManageAssignments = async (cardholder: Cardholder) => {
    setSelectedCardholder(cardholder);
    await fetchAssignments(cardholder.id);
    setAssignmentDialogOpen(true);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await api.importCardholders(file);
      dispatch(addNotification({
        type: 'success',
        message: `Imported ${result.imported} cardholders successfully`,
      }));
      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
      }
      setImportDialogOpen(false);
      fetchCardholders();
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to import cardholders',
      }));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Cardholder Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Upload />}
            onClick={() => setImportDialogOpen(true)}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateCardholder}
          >
            Add Cardholder
          </Button>
        </Box>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Employee ID</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cardholders.map((cardholder) => (
                <TableRow key={cardholder.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {cardholder.full_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {cardholder.first_name} {cardholder.last_name}
                    </Typography>
                  </TableCell>
                  <TableCell>{cardholder.employee_id || '-'}</TableCell>
                  <TableCell>{cardholder.department || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={cardholder.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={cardholder.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(cardholder.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEditCardholder(cardholder)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleManageAssignments(cardholder)}
                    >
                      <Group />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteCardholder(cardholder.id)}
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

      {/* Cardholder Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCardholder ? 'Edit Cardholder' : 'Create New Cardholder'}
        </DialogTitle>
        <Formik
          initialValues={{
            full_name: editingCardholder?.full_name || '',
            first_name: editingCardholder?.first_name || '',
            last_name: editingCardholder?.last_name || '',
            employee_id: editingCardholder?.employee_id || '',
            department: editingCardholder?.department || '',
            is_active: editingCardholder?.is_active ?? true,
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form>
              <DialogContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="full_name"
                      label="Full Name"
                      value={values.full_name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.full_name && Boolean(errors.full_name)}
                      helperText={touched.full_name && errors.full_name}
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
                    <TextField
                      fullWidth
                      name="employee_id"
                      label="Employee ID"
                      value={values.employee_id}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      name="department"
                      label="Department"
                      value={values.department}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                >
                  {editingCardholder ? 'Update' : 'Create'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}>
        <DialogTitle>Import Cardholders from Excel</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Upload an Excel file with cardholder information. The file should have columns for
            PDF name, CSV name, coder email, and CC email.
          </Typography>
          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={<Upload />}
          >
            Choose Excel File
            <input
              type="file"
              hidden
              accept=".xlsx,.xls"
              onChange={handleImportFile}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CardholderManagement;