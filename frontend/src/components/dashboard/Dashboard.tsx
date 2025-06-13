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
  Chip,
} from '@mui/material';
import {
  Description,
  Assignment,
  CheckCircle,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { RootState, AppDispatch } from '../../store';
import { fetchStatements } from '../../store/slices/statementSlice';
import StatCard from './StatCard';
import RecentStatements from './RecentStatements';

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
    const pending = statements.filter(s => s.status === 'pending').length;
    const processing = statements.filter(s => s.status === 'processing').length;
    const completed = statements.filter(s => s.status === 'completed').length;
    const inProgress = statements.filter(s => s.status === 'in_progress').length;

    return {
      total,
      pending,
      processing,
      completed,
      inProgress,
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
              title="Pending"
              value={stats.pending}
              icon={<Schedule />}
              color="warning"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="In Progress"
              value={stats.inProgress}
              icon={<TrendingUp />}
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Completed"
              value={stats.completed}
              icon={<CheckCircle />}
              color="success"
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