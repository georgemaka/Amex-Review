import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, Alert } from '@mui/material';
import api from '../../services/api';

const CodeTransactionsDebug: React.FC = () => {
  const [testData, setTestData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Testing companies endpoint...');
      const companies = await api.getCompanies();
      console.log('Companies response:', companies);
      setTestData({ companies });
    } catch (err: any) {
      console.error('API test failed:', err);
      setError(err.message || 'API call failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Code Transactions Debug
      </Typography>
      
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Debug Information
        </Typography>
        <Typography>
          This page is for testing the API connection.
        </Typography>
        
        <Button 
          variant="contained" 
          onClick={testAPI} 
          sx={{ mt: 2 }}
          disabled={loading}
        >
          {loading ? 'Testing...' : 'Test API'}
        </Button>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        
        {testData && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              API Response: {JSON.stringify(testData, null, 2)}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default CodeTransactionsDebug;