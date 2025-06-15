import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Search,
  Assignment,
  Refresh,
} from '@mui/icons-material';
import api from '../../services/api';
import MissingCardholdersSection from './MissingCardholdersSection';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  assignment_count: number;
}

interface Cardholder {
  id: number;
  full_name: string;
  is_active: boolean;
  card_last_four?: string;
  email?: string;
  department?: string;
}

interface Assignment {
  id: number;
  name: string;
  assignment_id: number;
}

interface CardholderWithAssignments extends Cardholder {
  assigned_coders: Assignment[];
  assigned_reviewers: Assignment[];
}

interface AssignmentData {
  cardholder_id: number;
  coder_id?: number;
  reviewer_id?: number;
}

const AssignmentManagement: React.FC = () => {
  const [cardholders, setCardholders] = useState<CardholderWithAssignments[]>([]);
  const [coders, setCoders] = useState<User[]>([]);
  const [reviewers, setReviewers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCardholder, setSelectedCardholder] = useState<CardholderWithAssignments | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentData, setAssignmentData] = useState<AssignmentData>({ cardholder_id: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch all data in parallel
      const [cardholdersWithAssignmentsRes, usersRes] = await Promise.all([
        api.getCardholdersWithAssignments({ is_active: true }),
        api.getUsers()
      ]);

      // Separate users by role
      const codersList = usersRes.filter((u: User) => u.role === 'coder');
      const reviewersList = usersRes.filter((u: User) => u.role === 'reviewer');
      
      setCoders(codersList);
      setReviewers(reviewersList);
      setCardholders(cardholdersWithAssignmentsRes);
      
      // Log cardholder 38 specifically
      const cardholder38 = cardholdersWithAssignmentsRes.find((ch: any) => ch.id === 38);
      if (cardholder38) {
        console.log('Cardholder 38 data:', cardholder38);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignClick = (cardholder: CardholderWithAssignments) => {
    setSelectedCardholder(cardholder);
    setAssignmentData({
      cardholder_id: cardholder.id,
      coder_id: undefined,
      reviewer_id: undefined,
    });
    setAssignmentDialogOpen(true);
    console.log('Selected cardholder:', cardholder);
    console.log('Assigned coders:', cardholder.assigned_coders);
    console.log('Assigned reviewers:', cardholder.assigned_reviewers);
  };

  const handleRemoveAssignment = async (assignmentId: number, type: 'coder' | 'reviewer') => {
    try {
      await api.removeUserAssignment(assignmentId, type);
      setSuccessMessage('Assignment removed successfully');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error removing assignment:', error);
      setErrorMessage('Failed to remove assignment');
    }
  };

  const handleAssignmentSave = async () => {
    try {
      // Update coder assignment
      if (assignmentData.coder_id) {
        const payload = {
          coder_id: assignmentData.coder_id,
          is_active: true
        };
        console.log('Sending coder assignment payload:', payload);
        console.log('To cardholder ID:', assignmentData.cardholder_id);
        await api.createCardholderAssignment(assignmentData.cardholder_id, payload);
      }

      // Update reviewer assignment
      if (assignmentData.reviewer_id) {
        await api.createCardholderReviewer(assignmentData.cardholder_id, {
          reviewer_id: assignmentData.reviewer_id,
          review_order: 1,
          is_active: true
        });
      }

      setAssignmentDialogOpen(false);
      setSuccessMessage('Assignment added successfully');
      await fetchData(); // Refresh data
    } catch (error: any) {
      console.error('Error saving assignments:', error);
      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage('An error occurred while saving the assignment');
      }
    }
  };

  const filteredCardholders = cardholders.filter(ch =>
    ch.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate workload statistics
  const getWorkloadStats = () => {
    const coderWorkload = coders.map(c => ({
      ...c,
      workload: cardholders.filter(ch => 
        ch.assigned_coders && ch.assigned_coders.some(coder => coder.id === c.id)
      ).length
    }));

    const reviewerWorkload = reviewers.map(r => ({
      ...r,
      workload: cardholders.filter(ch => 
        ch.assigned_reviewers && ch.assigned_reviewers.some(reviewer => reviewer.id === r.id)
      ).length
    }));

    return { coderWorkload, reviewerWorkload };
  };

  const { coderWorkload, reviewerWorkload } = getWorkloadStats();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Assignment Management
        </Typography>
        <Button
          startIcon={<Refresh />}
          onClick={fetchData}
          disabled={loading}
          variant="outlined"
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {/* Missing Cardholders Section */}
      <MissingCardholdersSection onCardholderAdded={fetchData} />

      {/* Search Bar */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search cardholders..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
        }}
        sx={{ mb: 3 }}
      />

      <Grid container spacing={3}>
        {/* Cardholders List */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Cardholders
            </Typography>
            {filteredCardholders.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searchTerm ? 'No cardholders found matching your search' : 'No cardholders available'}
                </Typography>
              </Box>
            ) : (
            <List>
              {filteredCardholders.map((cardholder) => (
                <React.Fragment key={cardholder.id}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box>
                          {cardholder.full_name}
                          {cardholder.card_last_four && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              •••• {cardholder.card_last_four}
                            </Typography>
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          {cardholder.assigned_coders && cardholder.assigned_coders.map((coder) => (
                            <Chip
                              key={coder.assignment_id}
                              label={`Coder: ${coder.name}`}
                              size="small"
                              color="primary"
                              sx={{ mr: 1, mb: 0.5 }}
                              onDelete={() => handleRemoveAssignment(coder.assignment_id, 'coder')}
                            />
                          ))}
                          {cardholder.assigned_reviewers && cardholder.assigned_reviewers.map((reviewer) => (
                            <Chip
                              key={reviewer.assignment_id}
                              label={`Reviewer: ${reviewer.name}`}
                              size="small"
                              color="secondary"
                              sx={{ mr: 1, mb: 0.5 }}
                              onDelete={() => handleRemoveAssignment(reviewer.assignment_id, 'reviewer')}
                            />
                          ))}
                          {(!cardholder.assigned_coders || cardholder.assigned_coders.length === 0) && 
                           (!cardholder.assigned_reviewers || cardholder.assigned_reviewers.length === 0) && (
                            <Typography variant="caption" color="error">
                              Unassigned
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleAssignClick(cardholder)}
                      >
                        <Assignment />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
            )}
          </Paper>
        </Grid>

        {/* Workload Statistics */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Coder Workload
            </Typography>
            <List dense>
              {coderWorkload.map((coder) => (
                <ListItem key={coder.id}>
                  <ListItemText
                    primary={`${coder.first_name} ${coder.last_name}`}
                    secondary={`${coder.workload} cardholders`}
                  />
                  <Chip
                    label={coder.workload}
                    size="small"
                    color={coder.workload > 10 ? 'error' : 'default'}
                  />
                </ListItem>
              ))}
              {coderWorkload.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No coders available
                </Typography>
              )}
            </List>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Reviewer Workload
            </Typography>
            <List dense>
              {reviewerWorkload.map((reviewer) => (
                <ListItem key={reviewer.id}>
                  <ListItemText
                    primary={`${reviewer.first_name} ${reviewer.last_name}`}
                    secondary={`${reviewer.workload} cardholders`}
                  />
                  <Chip
                    label={reviewer.workload}
                    size="small"
                    color={reviewer.workload > 10 ? 'error' : 'default'}
                  />
                </ListItem>
              ))}
              {reviewerWorkload.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No reviewers available
                </Typography>
              )}
            </List>
          </Paper>

          {/* Quick Stats */}
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Total Cardholders:</Typography>
              <Typography variant="body2" fontWeight="bold">
                {cardholders.length}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Assigned:</Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">
                {cardholders.filter(ch => 
                  (ch.assigned_coders && ch.assigned_coders.length > 0) || 
                  (ch.assigned_reviewers && ch.assigned_reviewers.length > 0)
                ).length}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Unassigned:</Typography>
              <Typography variant="body2" fontWeight="bold" color="error.main">
                {cardholders.filter(ch => 
                  (!ch.assigned_coders || ch.assigned_coders.length === 0) && 
                  (!ch.assigned_reviewers || ch.assigned_reviewers.length === 0)
                ).length}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Assignment Dialog */}
      <Dialog
        open={assignmentDialogOpen}
        onClose={() => setAssignmentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Add Assignment for {selectedCardholder?.full_name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Current assignments:
              {selectedCardholder && (
                <Box sx={{ mt: 1 }}>
                  {selectedCardholder.assigned_coders?.map((coder) => (
                    <Chip
                      key={coder.assignment_id}
                      label={`Coder: ${coder.name}`}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  ))}
                  {selectedCardholder.assigned_reviewers?.map((reviewer) => (
                    <Chip
                      key={reviewer.assignment_id}
                      label={`Reviewer: ${reviewer.name}`}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  ))}
                  {(!selectedCardholder.assigned_coders || selectedCardholder.assigned_coders.length === 0) && 
                   (!selectedCardholder.assigned_reviewers || selectedCardholder.assigned_reviewers.length === 0) && 
                   <Typography variant="caption" color="text.secondary">No current assignments</Typography>
                  }
                </Box>
              )}
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Add Coder</InputLabel>
              <Select
                value={assignmentData.coder_id || ''}
                onChange={(e) => setAssignmentData({
                  ...assignmentData,
                  coder_id: e.target.value as number
                })}
                label="Add Coder"
              >
                <MenuItem value="">Select a coder...</MenuItem>
                {coders
                  .filter(coder => {
                    const isAssigned = selectedCardholder?.assigned_coders?.some(ac => ac.id === coder.id);
                    console.log(`Coder ${coder.first_name} ${coder.last_name} (ID: ${coder.id}) - Assigned: ${isAssigned}`);
                    console.log('Assigned coders:', selectedCardholder?.assigned_coders);
                    return !isAssigned;
                  })
                  .map((coder) => (
                    <MenuItem key={coder.id} value={coder.id}>
                      {coder.first_name} {coder.last_name} ({coder.assignment_count} assigned)
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Add Reviewer</InputLabel>
              <Select
                value={assignmentData.reviewer_id || ''}
                onChange={(e) => setAssignmentData({
                  ...assignmentData,
                  reviewer_id: e.target.value as number
                })}
                label="Add Reviewer"
              >
                <MenuItem value="">Select a reviewer...</MenuItem>
                {reviewers
                  .filter(reviewer => 
                    !selectedCardholder?.assigned_reviewers?.some(ar => ar.id === reviewer.id)
                  )
                  .map((reviewer) => (
                    <MenuItem key={reviewer.id} value={reviewer.id}>
                      {reviewer.first_name} {reviewer.last_name} ({reviewer.assignment_count} assigned)
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignmentDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssignmentSave}
          >
            Add Assignment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setErrorMessage(null)} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessMessage(null)} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AssignmentManagement;