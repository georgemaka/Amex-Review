import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}.lighter`,
              color: `${color}.main`,
              mr: 2,
            }}
          >
            {icon}
          </Box>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
        </Box>
        <Typography color="text.secondary" variant="body2">
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default StatCard;