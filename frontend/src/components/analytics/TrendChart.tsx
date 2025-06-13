import React from 'react';
import { Box } from '@mui/material';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { SpendingTrend } from '../../store/slices/analyticsSlice';

interface TrendChartProps {
  data: SpendingTrend[];
}

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'white',
            p: 1.5,
            border: '1px solid #ccc',
            borderRadius: 1,
            boxShadow: 1,
          }}
        >
          <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>{formatDate(label)}</Box>
          <Box sx={{ color: '#4ECDC4' }}>
            Amount: {formatCurrency(payload[0].value)}
          </Box>
          <Box sx={{ color: '#95A5A6', fontSize: '0.875rem' }}>
            Transactions: {payload[0].payload.transaction_count}
          </Box>
        </Box>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
          style={{ fontSize: '12px' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <defs>
          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ECDC4" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#4ECDC4" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#4ECDC4"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorAmount)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default TrendChart;