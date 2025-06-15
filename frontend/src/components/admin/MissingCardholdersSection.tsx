import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  PersonAdd,
  ExpandMore,
  ExpandLess,
  Warning,
} from '@mui/icons-material';
import api from '../../services/api';

interface MissingCardholder {
  full_name: string;
  first_name: string;
  last_name: string;
  statement_count: number;
  total_transactions: number;
  total_amount: number;
  statements: Array<{
    id: number;
    statement_id: number;
    month: number;
    year: number;
    transaction_count: number;
    amount: number;
  }>;
  is_orphaned?: boolean;
  cardholder_id?: number;
}

interface MissingCardholdersSectionProps {
  onCardholderAdded: () => void;
}

const MissingCardholdersSection: React.FC<MissingCardholdersSectionProps> = ({ onCardholderAdded }) => {
  const [missingCardholders, setMissingCardholders] = useState<MissingCardholder[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedCardholder, setSelectedCardholder] = useState<MissingCardholder | null>(null);
  const [newCardholderData, setNewCardholderData] = useState({
    full_name: '',
    first_name: '',
    last_name: '',
    employee_id: '',
    department: '',
  });

  useEffect(() => {
    fetchMissingCardholders();
  }, []);

  const fetchMissingCardholders = async () => {
    try {
      setLoading(true);
      const response = await api.getMissingCardholders();
      setMissingCardholders(response);
    } catch (error) {
      console.error('Error fetching missing cardholders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = (cardholder: MissingCardholder) => {
    setSelectedCardholder(cardholder);
    setNewCardholderData({
      full_name: cardholder.full_name,
      first_name: cardholder.first_name,
      last_name: cardholder.last_name,
      employee_id: '',
      department: '',
    });
    setAddDialogOpen(true);
  };

  const handleAddCardholder = async () => {
    try {
      await api.createCardholder(newCardholderData);
      setAddDialogOpen(false);
      fetchMissingCardholders(); // Refresh missing list
      onCardholderAdded(); // Refresh parent component
    } catch (error: any) {
      console.error('Error adding cardholder:', error);
      alert(error.response?.data?.detail || 'Failed to add cardholder');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      </Paper>
    );
  }

  if (missingCardholders.length === 0) {
    return null;
  }

  return (
    <>
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Warning sx={{ mr: 1 }} />
            <Typography variant="h6">
              Missing Cardholders ({missingCardholders.length})
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ color: 'inherit' }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        
        <Collapse in={expanded}>
          <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
            The following cardholders appear in processed statements but are not in the cardholder management system:
          </Typography>
          
          <List>
            {missingCardholders.map((cardholder, index) => (
              <ListItem
                key={index}
                sx={{
                  bgcolor: 'background.paper',
                  mb: 1,
                  borderRadius: 1,
                  color: 'text.primary',
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {cardholder.full_name}
                      </Typography>
                      {cardholder.is_orphaned && (
                        <Chip
                          label="Orphaned"
                          size="small"
                          color="error"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {cardholder.statement_count} statement{cardholder.statement_count !== 1 ? 's' : ''} • 
                        {cardholder.total_transactions} transaction{cardholder.total_transactions !== 1 ? 's' : ''} • 
                        {formatCurrency(cardholder.total_amount)}
                      </Typography>
                      {cardholder.statements.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Statements: {cardholder.statements.map(s => `${s.month}/${s.year}`).join(', ')}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Button
                    startIcon={<PersonAdd />}
                    variant="contained"
                    size="small"
                    onClick={() => handleAddClick(cardholder)}
                  >
                    Add to Management
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </Paper>

      {/* Add Cardholder Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add Cardholder to Management System
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Full Name"
              value={newCardholderData.full_name}
              onChange={(e) => setNewCardholderData({
                ...newCardholderData,
                full_name: e.target.value
              })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="First Name"
              value={newCardholderData.first_name}
              onChange={(e) => setNewCardholderData({
                ...newCardholderData,
                first_name: e.target.value
              })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Last Name"
              value={newCardholderData.last_name}
              onChange={(e) => setNewCardholderData({
                ...newCardholderData,
                last_name: e.target.value
              })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Employee ID (Optional)"
              value={newCardholderData.employee_id}
              onChange={(e) => setNewCardholderData({
                ...newCardholderData,
                employee_id: e.target.value
              })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Department (Optional)"
              value={newCardholderData.department}
              onChange={(e) => setNewCardholderData({
                ...newCardholderData,
                department: e.target.value
              })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCardholder}
            disabled={!newCardholderData.full_name || !newCardholderData.first_name || !newCardholderData.last_name}
          >
            Add Cardholder
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MissingCardholdersSection;