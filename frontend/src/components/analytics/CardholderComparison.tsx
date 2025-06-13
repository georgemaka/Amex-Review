import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Person,
} from '@mui/icons-material';
import { RootState, AppDispatch } from '../../store';
import { fetchCardholderSpending, CardholderSpending } from '../../store/slices/analyticsSlice';

const CardholderComparison: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { cardholderSpending, filters } = useSelector((state: RootState) => state.analytics);

  useEffect(() => {
    if (filters.month && filters.year) {
      dispatch(fetchCardholderSpending(filters));
    }
  }, [dispatch, filters]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp color="error" fontSize="small" />;
      case 'down':
        return <TrendingDown color="success" fontSize="small" />;
      default:
        return <TrendingFlat color="action" fontSize="small" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'error';
      case 'down':
        return 'success';
      default:
        return 'default';
    }
  };

  const maxAmount = Math.max(...cardholderSpending.map((c: CardholderSpending) => c.total_amount), 1);

  return (
    <TableContainer sx={{ maxHeight: 400 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Cardholder</TableCell>
            <TableCell align="right">Total Spending</TableCell>
            <TableCell align="center">Transactions</TableCell>
            <TableCell align="center">Top Category</TableCell>
            <TableCell align="center">Trend</TableCell>
            <TableCell>Spending Distribution</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cardholderSpending.map((cardholder: CardholderSpending) => (
            <TableRow key={cardholder.cardholder_id} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    <Person fontSize="small" />
                  </Avatar>
                  <Typography variant="body2">
                    {cardholder.cardholder_name}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(cardholder.total_amount)}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Chip
                  label={cardholder.transaction_count}
                  size="small"
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="center">
                <Chip
                  label={cardholder.top_category || 'N/A'}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  {getTrendIcon(cardholder.trend)}
                  <Chip
                    label={cardholder.trend}
                    size="small"
                    color={getTrendColor(cardholder.trend) as any}
                  />
                </Box>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', width: 200 }}>
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={(cardholder.total_amount / maxAmount) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#f0f0f0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#45B7D1',
                        },
                      }}
                    />
                  </Box>
                  <Box sx={{ minWidth: 45 }}>
                    <Typography variant="caption" color="text.secondary">
                      {((cardholder.total_amount / maxAmount) * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default CardholderComparison;