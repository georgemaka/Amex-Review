import React from 'react';
import { Box } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CategorySpending } from '../../store/slices/analyticsSlice';

interface CategoryChartProps {
  categories: CategorySpending[];
}

const CategoryChart: React.FC<CategoryChartProps> = ({ categories }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
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
          <Box sx={{ fontWeight: 'bold' }}>{data.category_name}</Box>
          <Box>{formatCurrency(data.total_amount)}</Box>
          <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {data.percentage.toFixed(1)}% • {data.transaction_count} transactions
          </Box>
        </Box>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show label for small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="14"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={categories}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={CustomLabel}
          outerRadius={120}
          fill="#8884d8"
          dataKey="total_amount"
        >
          {categories.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.category_color || '#95A5A6'} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          formatter={(value: any, entry: any) => `${entry.payload.category_name}`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default CategoryChart;