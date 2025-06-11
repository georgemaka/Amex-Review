import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  Add,
  Visibility,
  Email,
  Download,
  Assignment,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { RootState, AppDispatch } from '../../store';
import { fetchStatements } from '../../store/slices/statementSlice';

const StatementList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { statements, isLoading } = useSelector((state: RootState) => state.statements);
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    dispatch(fetchStatements({ skip: page * rowsPerPage, limit: rowsPerPage }));
  }, [dispatch, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Statements</Typography>
        {user?.role === 'admin' && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/statements/upload')}
          >
            Upload Statement
          </Button>
        )}
      </Box>

      <Paper>
        {isLoading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Closing Date</TableCell>
                <TableCell>PDF File</TableCell>
                <TableCell>Excel File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {statements.map((statement) => (
                <TableRow key={statement.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {statement.month}/{statement.year}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {format(new Date(statement.closing_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>{statement.pdf_filename}</TableCell>
                  <TableCell>{statement.excel_filename}</TableCell>
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
                    <Tooltip title="View Progress">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/statements/${statement.id}`)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    
                    {user?.role === 'coder' && ['distributed', 'in_progress'].includes(statement.status) && (
                      <Tooltip title="Code Transactions">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/coding/${statement.id}`)}
                        >
                          <Assignment />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {user?.role === 'admin' && statement.status === 'split' && (
                      <Tooltip title="Send Emails">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/statements/${statement.id}/send-emails`)}
                        >
                          <Email />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {statement.status === 'completed' && (
                      <Tooltip title="Download CSV">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/statements/${statement.id}/export`)}
                        >
                          <Download />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {statements.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      No statements found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={-1} // We don't know the total count from the API
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default StatementList;