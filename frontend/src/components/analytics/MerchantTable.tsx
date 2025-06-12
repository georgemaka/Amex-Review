import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  LinearProgress,
  Typography,
} from '@mui/material';
import { MerchantSpending } from '../../store/slices/analyticsSlice';

interface MerchantTableProps {
  merchants: MerchantSpending[];
}

const MerchantTable: React.FC<MerchantTableProps> = ({ merchants }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const maxAmount = Math.max(...merchants.map(m => m.total_amount));

  return (
    <TableContainer sx={{ maxHeight: 400 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Merchant</TableCell>
            <TableCell align="right">Total Spent</TableCell>
            <TableCell align="center">Transactions</TableCell>
            <TableCell align="right">Avg Amount</TableCell>
            <TableCell>Spending</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {merchants.map((merchant, index) => (
            <TableRow key={index} hover>
              <TableCell>
                <Box>
                  <Typography variant="body2">{merchant.merchant_name}</Typography>
                  {merchant.category_name && (
                    <Typography variant="caption" color="text.secondary">
                      {merchant.category_name}
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(merchant.total_amount)}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Chip 
                  label={merchant.transaction_count} 
                  size="small" 
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">
                  {formatCurrency(merchant.average_amount)}
                </Typography>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', width: 150 }}>
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={(merchant.total_amount / maxAmount) * 100}
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: '#f0f0f0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#4ECDC4',
                        }
                      }}
                    />
                  </Box>
                  <Box sx={{ minWidth: 35 }}>
                    <Typography variant="caption" color="text.secondary">
                      {((merchant.total_amount / maxAmount) * 100).toFixed(0)}%
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

export default MerchantTable;