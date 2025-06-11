import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Box,
  Typography,
} from '@mui/material';
import { Visibility, Email } from '@mui/icons-material';
import { format } from 'date-fns';
import { Statement } from '../../store/slices/statementSlice';

interface RecentStatementsProps {
  statements: Statement[];
}

const RecentStatements: React.FC<RecentStatementsProps> = ({ statements }) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'processing':
        return 'info';
      case 'split':
        return 'primary';
      case 'distributed':
        return 'secondary';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  if (statements.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">No statements found</Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell>Closing Date</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {statements.map((statement) => (
            <TableRow key={statement.id} hover>
              <TableCell>
                {statement.month}/{statement.year}
              </TableCell>
              <TableCell>
                {format(new Date(statement.closing_date), 'MMM dd, yyyy')}
              </TableCell>
              <TableCell>
                <Chip
                  label={statement.status.replace('_', ' ').toUpperCase()}
                  size="small"
                  color={getStatusColor(statement.status)}
                />
              </TableCell>
              <TableCell>
                {format(new Date(statement.created_at), 'MMM dd, yyyy')}
              </TableCell>
              <TableCell align="right">
                <Tooltip title="View Details">
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/statements/${statement.id}`)}
                  >
                    <Visibility />
                  </IconButton>
                </Tooltip>
                {statement.status === 'split' && (
                  <Tooltip title="Send Emails">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/statements/${statement.id}/send-emails`)}
                    >
                      <Email />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default RecentStatements;