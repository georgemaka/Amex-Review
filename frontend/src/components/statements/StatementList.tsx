import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {
  Add,
  Visibility,
  Email,
  Download,
  Assignment,
  Delete,
  Refresh,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { RootState, AppDispatch } from '../../store';
import { fetchStatements, deleteStatement } from '../../store/slices/statementSlice';
import { addNotification } from '../../store/slices/uiSlice';
import StatementUploadModal from './StatementUploadModal';

const StatementList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { statements, isLoading } = useSelector((state: RootState) => state.statements);
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statementToDelete, setStatementToDelete] = useState<number | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [processingStatements, setProcessingStatements] = useState<Set<number>>(new Set());
  const [pollErrorCount, setPollErrorCount] = useState(0);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const refreshStatements = async () => {
    try {
      await dispatch(fetchStatements({ skip: page * rowsPerPage, limit: rowsPerPage })).unwrap();
      setPollErrorCount(0);
    } catch (error) {
      console.error('Failed to fetch statements:', error);
      setPollErrorCount(prev => prev + 1);
    }
  };

  useEffect(() => {
    refreshStatements();
  }, [dispatch, page, rowsPerPage]);

  // Set up polling for processing statements
  useEffect(() => {
    // Track current processing statements
    const currentProcessing = new Set<number>();
    statements.forEach(stmt => {
      if (stmt.status === 'processing' || stmt.status === 'pending') {
        currentProcessing.add(stmt.id);
      }
    });

    // Check if any statements just finished processing
    processingStatements.forEach(id => {
      const stmt = statements.find(s => s.id === id);
      if (!stmt) {
        // Statement no longer exists (was deleted)
        console.warn(`Statement ${id} no longer exists, stopping tracking`);
        return;
      }
      if (stmt && stmt.status !== 'processing' && stmt.status !== 'pending') {
        // Statement finished processing
        if (stmt.status === 'split') {
          dispatch(addNotification({
            message: `Statement for ${stmt.month}/${stmt.year} has been processed successfully!`,
            type: 'success',
          }));
        } else if (stmt.status === 'error') {
          dispatch(addNotification({
            message: `Statement for ${stmt.month}/${stmt.year} failed to process. Check logs for details.`,
            type: 'error',
          }));
        }
      }
    });

    // Update tracking set
    setProcessingStatements(currentProcessing);

    // Set up polling
    if (currentProcessing.size > 0 && !pollingInterval) {
      // Start polling every 3 seconds
      const interval = setInterval(async () => {
        try {
          await refreshStatements();
        } catch (error) {
          console.error('Polling error:', error);
          // Stop polling after 5 consecutive errors
          if (pollErrorCount >= 5) {
            clearInterval(interval);
            setPollingInterval(null);
            dispatch(addNotification({
              message: 'Statement polling stopped due to errors. Please refresh the page.',
              type: 'error',
            }));
          }
        }
      }, 3000);
      setPollingInterval(interval);
    } else if (currentProcessing.size === 0 && pollingInterval) {
      // Stop polling when no statements are processing
      clearInterval(pollingInterval);
      setPollingInterval(null);
      setPollErrorCount(0);
    }

    // Cleanup on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [statements, pollingInterval, dispatch, page, rowsPerPage, pollErrorCount]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'processing':
        return 'info';
      case 'split':
        return 'primary';
      case 'distributed':
        return 'secondary';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleDeleteClick = (id: number) => {
    setStatementToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (statementToDelete) {
      console.log('=== DELETE DEBUG START ===');
      console.log('Statement ID:', statementToDelete);
      console.log('User:', user);
      console.log('User role:', user?.role);
      console.log('Token from Redux state:', localStorage.getItem('token'));
      
      try {
        const result = await dispatch(deleteStatement(statementToDelete)).unwrap();
        console.log('Delete successful, result:', result);
        dispatch(addNotification({
          message: 'Statement deleted successfully',
          type: 'success',
        }));
        // Refresh the statements list
        dispatch(fetchStatements({ skip: page * rowsPerPage, limit: rowsPerPage }));
      } catch (error: any) {
        console.error('=== DELETE FAILED ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Full error object:', error);
        
        // Extract specific error message if available
        let errorMessage = 'Failed to delete statement';
        if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response?.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (error.response?.status === 403) {
          errorMessage = 'You do not have permission to delete statements.';
        } else if (error.response?.status === 404) {
          errorMessage = 'Statement not found.';
        } else if (error.response?.status === 500) {
          errorMessage = 'Server error. Please check the backend logs.';
        }
        
        dispatch(addNotification({
          message: errorMessage,
          type: 'error',
        }));
      }
    }
    setDeleteDialogOpen(false);
    setStatementToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setStatementToDelete(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Statements</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={async () => {
              setIsManualRefreshing(true);
              await refreshStatements();
              setIsManualRefreshing(false);
              dispatch(addNotification({
                message: 'Statements refreshed',
                type: 'info',
              }));
            }}
            disabled={isManualRefreshing}
          >
            {isManualRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          {user?.role === 'admin' && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setUploadModalOpen(true)}
            >
              Upload Statement
            </Button>
          )}
        </Box>
      </Box>

      <Paper>
        {isLoading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Closing Date</TableCell>
                <TableCell>PDF File</TableCell>
                <TableCell>Excel File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {statements.map((statement) => (
                <TableRow key={statement.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {statement.month}/{statement.year}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {format(new Date(statement.closing_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>{statement.pdf_filename}</TableCell>
                  <TableCell>{statement.excel_filename}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={statement.status.replace('_', ' ').toUpperCase()}
                        size="small"
                        color={getStatusColor(statement.status)}
                        icon={
                          (statement.status === 'processing' || statement.status === 'pending') ? 
                          <Refresh sx={{ animation: 'spin 2s linear infinite' }} /> : 
                          undefined
                        }
                      />
                      {(statement.status === 'processing' || statement.status === 'pending') && (
                        <Typography variant="caption" color="text.secondary">
                          Auto-updating...
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {format(new Date(statement.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Progress">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/statements/${statement.id}`)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    
                    {user?.role === 'coder' && ['distributed', 'in_progress'].includes(statement.status) && (
                      <Tooltip title="Code Transactions">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/coding/${statement.id}`)}
                        >
                          <Assignment />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {user?.role === 'admin' && statement.status === 'split' && (
                      <Tooltip title="Send Emails">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/statements/${statement.id}/send-emails`)}
                        >
                          <Email />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {statement.status === 'completed' && (
                      <Tooltip title="Download CSV">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/statements/${statement.id}/export`)}
                        >
                          <Download />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {user?.role === 'admin' && (
                      <Tooltip title="Delete Statement">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(statement.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {statements.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      No statements found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={-1} // We don't know the total count from the API
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Statement
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this statement? This will permanently delete:
            <ul>
              <li>The statement record</li>
              <li>All cardholder splits and PDFs</li>
              <li>All transaction records</li>
              <li>All analytics data</li>
              <li>All uploaded files</li>
            </ul>
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Statement Modal */}
      <StatementUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          // Refresh the statements list after successful upload
          dispatch(fetchStatements({ skip: page * rowsPerPage, limit: rowsPerPage }));
        }}
      />
    </Box>
  );
};

export default StatementList;