import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Grid,
  Alert,
  Divider,
  InputAdornment,
  Slider,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Save, RestartAlt } from '@mui/icons-material';
import api from '../../services/api';

interface AlertConfig {
  largeTransactionThreshold: number;
  weekendTransactionEnabled: boolean;
  unusualSpendingIncreasePercent: number;
  duplicateDetectionEnabled: boolean;
  duplicateTimeWindowHours: number;
}

const AlertSettings: React.FC = () => {
  // Default values from backend config
  const defaultConfig: AlertConfig = {
    largeTransactionThreshold: 2000,
    weekendTransactionEnabled: true,
    unusualSpendingIncreasePercent: 50,
    duplicateDetectionEnabled: true,
    duplicateTimeWindowHours: 24,
  };

  const [config, setConfig] = useState<AlertConfig>(defaultConfig);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await api.getAlertConfig();
      setConfig(response);
    } catch (err) {
      console.error('Error fetching alert config:', err);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      const response = await api.updateAlertConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
      
      // Show success with note about restart
      if (response.note) {
        setTimeout(() => {
          alert(response.note);
        }, 500);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save configuration');
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Alert Configuration Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure thresholds and rules for automatic alert generation
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Configuration saved successfully! Restart the backend service to apply changes.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Transaction Alerts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Transaction Alerts
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Large Transaction Threshold
              </Typography>
              <TextField
                fullWidth
                type="number"
                value={config.largeTransactionThreshold}
                onChange={(e) => setConfig({ ...config, largeTransactionThreshold: Number(e.target.value) })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                helperText="Transactions above this amount will trigger an alert"
              />
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Chip label="$1,000" size="small" onClick={() => setConfig({ ...config, largeTransactionThreshold: 1000 })} />
                <Chip label="$2,000" size="small" onClick={() => setConfig({ ...config, largeTransactionThreshold: 2000 })} />
                <Chip label="$5,000" size="small" onClick={() => setConfig({ ...config, largeTransactionThreshold: 5000 })} />
                <Chip label="$10,000" size="small" onClick={() => setConfig({ ...config, largeTransactionThreshold: 10000 })} />
              </Box>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={config.weekendTransactionEnabled}
                  onChange={(e) => setConfig({ ...config, weekendTransactionEnabled: e.target.checked })}
                />
              }
              label="Weekend Transaction Alerts"
            />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
              Alert when transactions occur on weekends
            </Typography>
          </Paper>
        </Grid>

        {/* Spending Pattern Alerts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Spending Pattern Alerts
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Unusual Spending Increase: {config.unusualSpendingIncreasePercent}%
              </Typography>
              <Slider
                value={config.unusualSpendingIncreasePercent}
                onChange={(e, value) => setConfig({ ...config, unusualSpendingIncreasePercent: value as number })}
                min={10}
                max={200}
                step={10}
                marks={[
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                  { value: 100, label: '100%' },
                  { value: 150, label: '150%' },
                ]}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Alert when spending exceeds historical average by this percentage
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={config.duplicateDetectionEnabled}
                  onChange={(e) => setConfig({ ...config, duplicateDetectionEnabled: e.target.checked })}
                />
              }
              label="Duplicate Transaction Detection"
            />
            
            {config.duplicateDetectionEnabled && (
              <Box sx={{ mt: 2, ml: 4 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Time Window (hours)
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={config.duplicateTimeWindowHours}
                  onChange={(e) => setConfig({ ...config, duplicateTimeWindowHours: Number(e.target.value) })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">hours</InputAdornment>,
                  }}
                  helperText="Check for duplicates within this time period"
                />
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Alert Examples */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Example Alerts (Based on Current Settings)
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Alert severity="info">
                  <strong>Large Transaction</strong><br />
                  Transaction of ${(config.largeTransactionThreshold * 1.5).toFixed(2)} at Amazon.com
                </Alert>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Alert severity="warning">
                  <strong>Unusual Spending</strong><br />
                  Travel spending is {config.unusualSpendingIncreasePercent}% higher than average
                </Alert>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Alert severity="error">
                  <strong>Budget Exceeded</strong><br />
                  Monthly budget exceeded by $500.00
                </Alert>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<RestartAlt />}
          onClick={handleReset}
        >
          Reset to Defaults
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
        >
          Save Configuration
        </Button>
      </Box>
    </Box>
  );
};

export default AlertSettings;