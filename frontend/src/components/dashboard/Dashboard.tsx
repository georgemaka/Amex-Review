import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  Description,
  Assignment,
  People,
  CalendarToday,
  Warning,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { RootState, AppDispatch } from '../../store';
import { fetchStatements } from '../../store/slices/statementSlice';
import StatCard from './StatCard';
import RecentStatements from './RecentStatements';
import DashboardAlerts from './DashboardAlerts';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { statements, isLoading } = useSelector((state: RootState) => state.statements);

  useEffect(() => {
    dispatch(fetchStatements({ limit: 10 }));
  }, [dispatch]);

  const stats = React.useMemo(() => {
    const total = statements.length;
    
    // Calculate total cardholders across all statements
    const totalCardholders = statements.reduce((sum, s) => sum + (s.cardholder_count || 0), 0);
    
    // Calculate statements by actual status
    const split = statements.filter(s => s.status === 'split').length;
    const distributed = statements.filter(s => s.status === 'distributed').length;
    const needsAttention = statements.filter(s => 
      s.status === 'pending' || s.status === 'processing' || s.status === 'error'
    ).length;
    
    // Get current month's statements
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const currentMonthStatements = statements.filter(s => 
      s.month === currentMonth && s.year === currentYear
    ).length;

    return {
      total,
      totalCardholders,
      split,
      currentMonthStatements,
      needsAttention,
    };
  }, [statements]);

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mt: 0 }}>
        {getWelcomeMessage()}, {user?.first_name}!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {format(new Date(), 'EEEE, MMMM d, yyyy')}
      </Typography>

      {/* Admin alerts for missing and unassigned cardholders */}
      {user?.role === 'admin' && (
        <DashboardAlerts />
      )}

      {user?.role === 'admin' && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Statements"
              value={stats.total}
              icon={<Description />}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Cardholders"
              value={stats.totalCardholders}
              icon={<People />}
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Current Month"
              value={stats.currentMonthStatements}
              icon={<CalendarToday />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Needs Attention"
              value={stats.needsAttention}
              icon={<Warning />}
              color={stats.needsAttention > 0 ? "warning" : "info"}
            />
          </Grid>
        </Grid>
      )}

      {user?.role === 'coder' && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Your Assignments
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You have active coding assignments to complete.
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => navigate('/statements')}
                  startIcon={<Assignment />}
                >
                  View Assignments
                </Button>
              </CardActions>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/coding')}
                  >
                    Start Coding
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/statements')}
                  >
                    View Statements
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Statements
            </Typography>
            {isLoading ? (
              <LinearProgress />
            ) : (
              <RecentStatements statements={statements.slice(0, 5)} />
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;