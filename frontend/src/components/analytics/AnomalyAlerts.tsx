import React from 'react';
import { useDispatch } from 'react-redux';
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Box,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  Warning,
  Error,
  Info,
  CheckCircle,
  TrendingUp,
  AttachMoney,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { SpendingAlert, resolveAlert } from '../../store/slices/analyticsSlice';
import { AppDispatch } from '../../store';

interface AnomalyAlertsProps {
  alerts: SpendingAlert[];
}

const AnomalyAlerts: React.FC<AnomalyAlertsProps> = ({ alerts }) => {
  const dispatch = useDispatch<AppDispatch>();

  const getAlertIcon = (severity: string, alertType: string) => {
    if (severity === 'critical') return <Error color="error" />;
    if (severity === 'warning') return <Warning color="warning" />;
    if (alertType === 'budget_exceeded') return <AttachMoney color="error" />;
    if (alertType === 'unusual_spending') return <TrendingUp color="warning" />;
    return <Info color="info" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, h:mm a');
    } catch {
      return dateStr;
    }
  };

  const handleResolve = async (alertId: number) => {
    await dispatch(resolveAlert(alertId));
  };

  if (alerts.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
        <Typography color="text.secondary">
          No active alerts
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ maxHeight: 300, overflow: 'auto' }}>
      {alerts.map((alert) => (
        <ListItem
          key={alert.id}
          sx={{
            borderLeft: 4,
            borderColor: `${getSeverityColor(alert.severity)}.main`,
            mb: 1,
            backgroundColor: 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          secondaryAction={
            !alert.is_resolved && (
              <Tooltip title="Mark as resolved">
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => handleResolve(alert.id)}
                >
                  <CheckCircle />
                </IconButton>
              </Tooltip>
            )
          }
        >
          <ListItemIcon>
            {getAlertIcon(alert.severity, alert.alert_type)}
          </ListItemIcon>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">{alert.description}</Typography>
                <Chip
                  label={alert.severity}
                  size="small"
                  color={getSeverityColor(alert.severity) as any}
                />
              </Box>
            }
            secondary={
              <Typography variant="caption" color="text.secondary">
                {formatDate(alert.created_at)}
              </Typography>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

export default AnomalyAlerts;