import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Alert,
  AlertTitle,
  Collapse,
  Button,
  Typography,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Warning,
  PersonAdd,
  Assignment,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import api from '../../services/api';

interface MissingCardholder {
  cardholder_name: string;
  statement_count: number;
  transaction_count: number;
  total_amount: number;
  statement_periods: Array<{ month: number; year: number }>;
}

interface UnassignedCardholder {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  department?: string;
}

const DashboardAlerts: React.FC = () => {
  const navigate = useNavigate();
  const [missingCardholders, setMissingCardholders] = useState<MissingCardholder[]>([]);
  const [unassignedCardholders, setUnassignedCardholders] = useState<UnassignedCardholder[]>([]);
  const [loadingMissing, setLoadingMissing] = useState(true);
  const [loadingUnassigned, setLoadingUnassigned] = useState(true);
  const [expandMissing, setExpandMissing] = useState(false);
  const [expandUnassigned, setExpandUnassigned] = useState(false);

  useEffect(() => {
    fetchMissingCardholders();
    fetchUnassignedCardholders();
  }, []);

  const fetchMissingCardholders = async () => {
    try {
      setLoadingMissing(true);
      const data = await api.getMissingCardholders();
      setMissingCardholders(data);
      // Auto-expand if there are missing cardholders
      if (data.length > 0) {
        setExpandMissing(true);
      }
    } catch (error) {
      console.error('Error fetching missing cardholders:', error);
    } finally {
      setLoadingMissing(false);
    }
  };

  const fetchUnassignedCardholders = async () => {
    try {
      setLoadingUnassigned(true);
      const data = await api.getCardholdersWithAssignments({ is_active: true });
      // Filter cardholders with no assignments
      const unassigned = data.filter((ch: any) => 
        (!ch.assigned_coders || ch.assigned_coders.length === 0) && 
        (!ch.assigned_reviewers || ch.assigned_reviewers.length === 0)
      );
      setUnassignedCardholders(unassigned);
      // Auto-expand if there are unassigned cardholders
      if (unassigned.length > 0) {
        setExpandUnassigned(true);
      }
    } catch (error) {
      console.error('Error fetching unassigned cardholders:', error);
    } finally {
      setLoadingUnassigned(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loadingMissing || loadingUnassigned) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (missingCardholders.length === 0 && unassignedCardholders.length === 0) {
    return null; // Don't show anything if there are no alerts
  }

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      {/* Missing Cardholders Alert */}
      {missingCardholders.length > 0 && (
        <Alert 
          severity="warning" 
          icon={<PersonAdd />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setExpandMissing(!expandMissing)}
              endIcon={expandMissing ? <ExpandLess /> : <ExpandMore />}
            >
              {expandMissing ? 'Hide' : 'Show'}
            </Button>
          }
        >
          <AlertTitle>
            Missing Cardholders ({missingCardholders.length})
          </AlertTitle>
          <Typography variant="body2">
            Found cardholders in statements that are not in the management system
          </Typography>
          
          <Collapse in={expandMissing} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 2 }}>
              {missingCardholders.slice(0, 5).map((missing, index) => (
                <Box 
                  key={index} 
                  sx={{ 
                    p: 1, 
                    mb: 1, 
                    bgcolor: 'rgba(0, 0, 0, 0.03)',
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {missing.cardholder_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {missing.statement_count} statements • {missing.transaction_count} transactions • {formatCurrency(missing.total_amount)}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {missingCardholders.length > 5 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  And {missingCardholders.length - 5} more...
                </Typography>
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={<Assignment />}
                onClick={() => navigate('/admin/assignments')}
                sx={{ mt: 2 }}
              >
                Manage Cardholders
              </Button>
            </Box>
          </Collapse>
        </Alert>
      )}

      {/* Unassigned Cardholders Alert */}
      {unassignedCardholders.length > 0 && (
        <Alert 
          severity="info" 
          icon={<Warning />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setExpandUnassigned(!expandUnassigned)}
              endIcon={expandUnassigned ? <ExpandLess /> : <ExpandMore />}
            >
              {expandUnassigned ? 'Hide' : 'Show'}
            </Button>
          }
        >
          <AlertTitle>
            Unassigned Cardholders ({unassignedCardholders.length})
          </AlertTitle>
          <Typography variant="body2">
            Cardholders without any coder or reviewer assignments
          </Typography>
          
          <Collapse in={expandUnassigned} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 2 }}>
              {unassignedCardholders.slice(0, 5).map((cardholder) => (
                <Box 
                  key={cardholder.id} 
                  sx={{ 
                    p: 1, 
                    mb: 1, 
                    bgcolor: 'rgba(0, 0, 0, 0.03)',
                    borderRadius: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {cardholder.full_name}
                    </Typography>
                    {cardholder.department && (
                      <Typography variant="caption" color="text.secondary">
                        {cardholder.department}
                      </Typography>
                    )}
                  </Box>
                  <Chip 
                    label="No assignments" 
                    size="small" 
                    color="default"
                  />
                </Box>
              ))}
              {unassignedCardholders.length > 5 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  And {unassignedCardholders.length - 5} more...
                </Typography>
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={<Assignment />}
                onClick={() => navigate('/admin/assignments')}
                sx={{ mt: 2 }}
              >
                Assign Users
              </Button>
            </Box>
          </Collapse>
        </Alert>
      )}
    </Stack>
  );
};

export default DashboardAlerts;