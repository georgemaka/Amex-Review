import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Grid, Paper, Typography, Button } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { RootState, AppDispatch } from '../../store';
import { fetchAnalyticsDashboard, setFilters } from '../../store/slices/analyticsSlice';
import SpendingOverview from './SpendingOverview';
import CategoryChart from './CategoryChart';
import TrendChart from './TrendChart';
import MerchantTable from './MerchantTable';
import CardholderComparison from './CardholderComparison';
import AnomalyAlerts from './AnomalyAlerts';
import AnalyticsFilters from './AnalyticsFilters';

const AnalyticsDashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { dashboard, loading, error, filters } = useSelector((state: RootState) => state.analytics);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    // Set initial filters to current month/year
    const month = selectedDate.getMonth() + 1;
    const year = selectedDate.getFullYear();
    dispatch(setFilters({ month, year }));
  }, []);

  useEffect(() => {
    // Fetch dashboard data when filters change
    if (filters.month && filters.year) {
      dispatch(fetchAnalyticsDashboard(filters));
    }
  }, [dispatch, filters]);

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      dispatch(setFilters({ month, year }));
    }
  };

  const handleFilterChange = (newFilters: any) => {
    dispatch(setFilters(newFilters));
  };

  if (loading && !dashboard) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading analytics...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Spending Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Analyze credit card spending patterns and trends
        </Typography>
      </Box>

      {/* Filters */}
      <AnalyticsFilters 
        onFilterChange={handleFilterChange}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
      />

      {/* Overview Cards */}
      {dashboard && (
        <>
          <SpendingOverview dashboard={dashboard} />

          {/* Charts Grid */}
          <Grid container spacing={3} sx={{ mt: 2 }}>
            {/* Category Breakdown */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Spending by Category
                </Typography>
                <CategoryChart categories={dashboard.top_categories} />
              </Paper>
            </Grid>

            {/* Spending Trend */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Spending Trend
                </Typography>
                <TrendChart data={dashboard.spending_trend} />
              </Paper>
            </Grid>

            {/* Top Merchants */}
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Top Merchants
                </Typography>
                <MerchantTable merchants={dashboard.top_merchants} />
              </Paper>
            </Grid>

            {/* Alerts */}
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Recent Alerts
                </Typography>
                <AnomalyAlerts alerts={dashboard.recent_alerts} />
              </Paper>
            </Grid>

            {/* Cardholder Comparison */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Cardholder Spending
                </Typography>
                <CardholderComparison />
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default AnalyticsDashboard;