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
  Button,
} from '@mui/material';
import { Visibility, Email, People } from '@mui/icons-material';
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
            <TableCell>Statement Name</TableCell>
            <TableCell>Period</TableCell>
            <TableCell>Closing Date</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Cardholders</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {statements.map((statement) => (
            <TableRow key={statement.id} hover>
              <TableCell>
                <Tooltip title={statement.pdf_filename || statement.excel_filename}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      maxWidth: 200, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' 
                    }}
                  >
                    {statement.pdf_filename || statement.excel_filename || 'N/A'}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell>
                {format(new Date(statement.year, statement.month - 1), 'MMMM yyyy')}
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
                <Chip 
                  label={statement.cardholder_count || 0}
                  size="small"
                  color={statement.cardholder_count ? "primary" : "default"}
                  icon={<People />}
                />
              </TableCell>
              <TableCell>
                {format(new Date(statement.created_at), 'MMM dd, yyyy')}
              </TableCell>
              <TableCell align="right">
                <Button
                  variant="contained"
                  size="small"
                  color="info"
                  startIcon={<People />}
                  onClick={() => navigate(`/statements/${statement.id}`)}
                  sx={{ 
                    mr: 1,
                    textTransform: 'none',
                    fontWeight: 500,
                  }}
                >
                  View Cardholders
                </Button>
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