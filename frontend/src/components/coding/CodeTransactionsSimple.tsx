import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const CodeTransactionsSimple: React.FC = () => {
  console.log('CodeTransactionsSimple rendering');
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Code Transactions (Simple)
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography>
          This is a test to see if the component renders.
        </Typography>
      </Paper>
    </Box>
  );
};

export default CodeTransactionsSimple;