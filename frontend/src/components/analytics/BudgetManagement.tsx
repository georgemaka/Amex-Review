import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Fab,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  Settings,
  AttachMoney,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import api from '../../services/api';

interface BudgetLimit {
  id: number;
  cardholder_id?: number;
  cardholder?: { full_name: string };
  category_id?: number;
  category?: { name: string; color: string };
  limit_amount: number;
  alert_threshold: number;
  month?: number;
  year?: number;
  is_active: boolean;
}

interface BudgetFormData {
  cardholder_id?: number;
  category_id?: number;
  limit_amount: number;
  alert_threshold: number;
  month?: number;
  year?: number;
}

const BudgetManagement: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [budgets, setBudgets] = useState<BudgetLimit[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cardholders, setCardholders] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetLimit | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>({
    limit_amount: 5000,
    alert_threshold: 0.8,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Alert threshold presets
  const thresholdPresets = [
    { value: 0.7, label: '70%' },
    { value: 0.75, label: '75%' },
    { value: 0.8, label: '80%' },
    { value: 0.85, label: '85%' },
    { value: 0.9, label: '90%' },
  ];

  // Common budget amount presets
  const amountPresets = [
    { value: 2000, label: '$2,000' },
    { value: 5000, label: '$5,000' },
    { value: 10000, label: '$10,000' },
    { value: 15000, label: '$15,000' },
    { value: 20000, label: '$20,000' },
    { value: 25000, label: '$25,000' },
  ];

  useEffect(() => {
    if (open) {
      fetchBudgets();
      fetchCategories();
      fetchCardholders();
    }
  }, [open]);

  const fetchBudgets = async () => {
    try {
      const response = await api.getBudgetLimits({ is_active: true });
      setBudgets(response);
    } catch (err) {
      console.error('Error fetching budgets:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.getSpendingCategories(true);
      setCategories(response);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchCardholders = async () => {
    try {
      const response = await api.getCardholders({ is_active: true });
      setCardholders(response);
    } catch (err) {
      console.error('Error fetching cardholders:', err);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setEditMode(false);
    setSelectedBudget(null);
    setFormData({
      limit_amount: 5000,
      alert_threshold: 0.8,
    });
    setError('');
  };

  const handleClose = () => {
    setOpen(false);
    setEditMode(false);
    setSelectedBudget(null);
    setError('');
  };

  const handleEdit = (budget: BudgetLimit) => {
    setEditMode(true);
    setSelectedBudget(budget);
    setFormData({
      cardholder_id: budget.cardholder_id,
      category_id: budget.category_id,
      limit_amount: budget.limit_amount,
      alert_threshold: budget.alert_threshold,
      month: budget.month,
      year: budget.year,
    });
    setError('');
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this budget limit?')) {
      try {
        await api.deleteBudgetLimit(id);
        fetchBudgets();
      } catch (err) {
        console.error('Error deleting budget:', err);
      }
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      if (editMode && selectedBudget) {
        await api.updateBudgetLimit(selectedBudget.id, formData);
      } else {
        await api.createBudgetLimit(formData);
      }
      fetchBudgets();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error saving budget limit');
    } finally {
      setLoading(false);
    }
  };

  const getBudgetScope = (budget: BudgetLimit) => {
    if (budget.cardholder && budget.category) {
      return `${budget.cardholder.full_name} - ${budget.category.name}`;
    } else if (budget.cardholder) {
      return `${budget.cardholder.full_name} - All Categories`;
    } else if (budget.category) {
      return `All Cardholders - ${budget.category.name}`;
    }
    return 'Company-wide';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <>
      <Tooltip title="Manage Budget Limits">
        <Fab
          color="primary"
          size="small"
          onClick={handleOpen}
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
        >
          <Settings />
        </Fab>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AttachMoney />
            Budget Management
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Budget Form */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              {editMode ? 'Edit Budget Limit' : 'Create New Budget Limit'}
            </Typography>
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
              <FormControl fullWidth>
                <InputLabel>Cardholder (Optional)</InputLabel>
                <Select
                  value={formData.cardholder_id || ''}
                  onChange={(e) => setFormData({ ...formData, cardholder_id: e.target.value as number || undefined })}
                  label="Cardholder (Optional)"
                >
                  <MenuItem value="">All Cardholders</MenuItem>
                  {cardholders.map((ch) => (
                    <MenuItem key={ch.id} value={ch.id}>
                      {ch.full_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Category (Optional)</InputLabel>
                <Select
                  value={formData.category_id || ''}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value as number || undefined })}
                  label="Category (Optional)"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: cat.color,
                          }}
                        />
                        {cat.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box>
                <TextField
                  fullWidth
                  label="Budget Limit"
                  type="number"
                  value={formData.limit_amount}
                  onChange={(e) => setFormData({ ...formData, limit_amount: parseFloat(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
                <Box display="flex" gap={1} mt={1}>
                  {amountPresets.map((preset) => (
                    <Chip
                      key={preset.value}
                      label={preset.label}
                      size="small"
                      onClick={() => setFormData({ ...formData, limit_amount: preset.value })}
                      variant={formData.limit_amount === preset.value ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Box>

              <Box>
                <TextField
                  fullWidth
                  label="Alert Threshold"
                  type="number"
                  value={formData.alert_threshold}
                  onChange={(e) => setFormData({ ...formData, alert_threshold: parseFloat(e.target.value) })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  inputProps={{ min: 0, max: 1, step: 0.05 }}
                />
                <Box display="flex" gap={1} mt={1}>
                  {thresholdPresets.map((preset) => (
                    <Chip
                      key={preset.value}
                      label={preset.label}
                      size="small"
                      onClick={() => setFormData({ ...formData, alert_threshold: preset.value })}
                      variant={formData.alert_threshold === preset.value ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Box>
            </Box>

            <Box mt={2} display="flex" gap={2} justifyContent="flex-end">
              <Button onClick={() => {
                setEditMode(false);
                setSelectedBudget(null);
                setFormData({ limit_amount: 5000, alert_threshold: 0.8 });
              }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading || !formData.limit_amount}
              >
                {editMode ? 'Update' : 'Create'} Budget
              </Button>
            </Box>
          </Box>

          {/* Budget List */}
          <Typography variant="h6" gutterBottom>
            Active Budget Limits
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Scope</TableCell>
                  <TableCell align="right">Limit</TableCell>
                  <TableCell align="center">Alert At</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {budgets.map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell>{getBudgetScope(budget)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight="bold">
                        {formatCurrency(budget.limit_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${(budget.alert_threshold * 100).toFixed(0)}%`}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(budget)}
                        color="primary"
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(budget.id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {budgets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        No budget limits set. Create one to start monitoring spending.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Alert Threshold Settings */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Alert Threshold Settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You can also update the transaction alert thresholds in the system configuration:
            </Typography>
            <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Alert severity="info">
                <strong>Large Transaction Alert:</strong> Currently set at $500
              </Alert>
              <Alert severity="info">
                <strong>Unusual Spending Alert:</strong> Triggers at 50% above average
              </Alert>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BudgetManagement;