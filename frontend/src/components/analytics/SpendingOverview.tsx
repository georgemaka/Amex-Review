import React from 'react';
import { Grid, Paper, Typography, Box, Chip } from '@mui/material';
import { 
  TrendingUp, TrendingDown, TrendingFlat, 
  AttachMoney, Receipt, CreditCard, CompareArrows 
} from '@mui/icons-material';
import { AnalyticsDashboard } from '../../store/slices/analyticsSlice';

interface SpendingOverviewProps {
  dashboard: AnalyticsDashboard;
}

const SpendingOverview: React.FC<SpendingOverviewProps> = ({ dashboard }) => {
  const { period_comparison } = dashboard;
  const changePercent = period_comparison.change_percent;
  
  const getTrendIcon = () => {
    if (changePercent > 5) return <TrendingUp color="error" />;
    if (changePercent < -5) return <TrendingDown color="success" />;
    return <TrendingFlat color="action" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const cards = [
    {
      title: 'Total Spending',
      value: formatCurrency(dashboard.total_spending),
      icon: <AttachMoney fontSize="large" />,
      color: '#FF6B6B',
      change: changePercent,
      changeAmount: period_comparison.change_amount,
    },
    {
      title: 'Total Transactions',
      value: formatNumber(dashboard.total_transactions),
      icon: <Receipt fontSize="large" />,
      color: '#4ECDC4',
    },
    {
      title: 'Average Transaction',
      value: formatCurrency(dashboard.average_transaction),
      icon: <CreditCard fontSize="large" />,
      color: '#45B7D1',
    },
    {
      title: 'vs Previous Period',
      value: `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`,
      icon: <CompareArrows fontSize="large" />,
      color: changePercent > 0 ? '#FF6B6B' : '#4ECDC4',
      subtitle: formatCurrency(Math.abs(period_comparison.change_amount)),
    },
  ];

  return (
    <Grid container spacing={3}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Paper
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
              position: 'relative',
              overflow: 'visible',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -10,
                right: 16,
                backgroundColor: card.color,
                borderRadius: '50%',
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: 2,
              }}
            >
              {card.icon}
            </Box>
            
            <Typography color="text.secondary" gutterBottom variant="body2">
              {card.title}
            </Typography>
            
            <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
              {card.value}
            </Typography>
            
            {card.change !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {getTrendIcon()}
                <Typography
                  variant="body2"
                  color={card.change > 0 ? 'error' : 'success'}
                  sx={{ ml: 0.5 }}
                >
                  {formatCurrency(Math.abs(card.changeAmount || 0))}
                </Typography>
              </Box>
            )}
            
            {card.subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {card.subtitle}
              </Typography>
            )}
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};

export default SpendingOverview;