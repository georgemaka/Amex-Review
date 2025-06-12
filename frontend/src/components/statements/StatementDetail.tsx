import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Grid, Button, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, LinearProgress,
  Chip, IconButton, Tooltip, CircularProgress
} from '@mui/material';
import { 
  Email, Download, Assignment, ArrowBack, GetApp, Archive, Description, TableChart 
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../services/api';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface StatementDetail {
  id: number;
  month: number;
  year: number;
  closing_date: string;
  status: string;
  pdf_filename: string;
  excel_filename: string;
  created_at: string;
}

interface CardholderProgress {
  cardholder_id: number;
  cardholder_statement_id: number;
  cardholder_name: string;
  total_transactions: number;
  coded_transactions: number;
  reviewed_transactions: number;
  rejected_transactions: number;
  progress_percentage: number;
  pdf_filename?: string;
}

interface StatementProgress {
  statement_id: number;
  status: string;
  total_cardholders: number;
  processed_cardholders: number;
  total_transactions: number;
  coded_transactions: number;
  progress_percentage: number;
  cardholder_progress: CardholderProgress[];
}

const StatementDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [statement, setStatement] = useState<StatementDetail | null>(null);
  const [progress, setProgress] = useState<StatementProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  useEffect(() => {
    loadStatementData();
  }, [id]);

  const loadStatementData = async () => {
    try {
      setLoading(true);
      const [statementData, progressData] = await Promise.all([
        api.getStatement(parseInt(id!)),
        api.getStatementProgress(parseInt(id!))
      ]);
      setStatement(statementData);
      setProgress(progressData);
    } catch (error) {
      console.error('Failed to load statement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmails = async () => {
    try {
      setSendingEmails(true);
      await api.sendStatementEmails(parseInt(id!));
      // Reload to update status
      await loadStatementData();
    } catch (error) {
      console.error('Failed to send emails:', error);
    } finally {
      setSendingEmails(false);
    }
  };

  const handleDownloadPDF = async (cardholderId: number, cardholderName: string) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/statements/${id}/cardholder/${cardholderId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cardholderName}_${statement?.month}_${statement?.year}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  const handleDownloadCSV = async (cardholderId: number, cardholderName: string) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/statements/${id}/cardholder/${cardholderId}/csv`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cardholderName}_${statement?.month}_${statement?.year}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV:', error);
    }
  };

  const handleDownloadAllPDFs = async () => {
    try {
      setDownloadingZip(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/statements/${id}/download-all-pdfs`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement_${statement?.month}_${statement?.year}_all_pdfs.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF ZIP:', error);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadAllCSVs = async () => {
    try {
      setDownloadingZip(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/statements/${id}/download-all-csvs`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement_${statement?.month}_${statement?.year}_all_csvs.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CSV ZIP:', error);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadAll = async () => {
    try {
      setDownloadingZip(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/statements/${id}/download-all`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `statement_${statement?.month}_${statement?.year}_all_files.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download all files ZIP:', error);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const cardholderStatementIds = progress?.cardholder_progress.map(cp => cp.cardholder_id) || [];
      const blob = await api.exportTransactionsCSV(cardholderStatementIds, false);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export_${statement?.month}_${statement?.year}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!statement || !progress) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Statement not found</Typography>
      </Box>
    );
  }

  const canSendEmails = user?.role === 'admin' && statement.status === 'split';
  const canExport = statement.status === 'completed';
  const showCodingButton = user?.role === 'coder' && ['distributed', 'in_progress'].includes(statement.status);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate('/statements')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">
          Statement - {statement.month}/{statement.year}
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={2.4}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>Status</Typography>
            <Chip 
              label={statement.status.replace('_', ' ').toUpperCase()} 
              color="primary"
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>Closing Date</Typography>
            <Typography variant="h6">
              {format(new Date(statement.closing_date), 'MMM dd, yyyy')}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>Total Cardholders</Typography>
            <Typography variant="h4" color="primary">
              {progress.total_cardholders}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>Progress</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">{progress.progress_percentage.toFixed(1)}%</Typography>
              <LinearProgress 
                variant="determinate" 
                value={progress.progress_percentage} 
                sx={{ flex: 1 }}
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary" gutterBottom>Transactions</Typography>
            <Typography variant="h6">
              {progress.coded_transactions} / {progress.total_transactions}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {canSendEmails && (
          <Button
            variant="contained"
            startIcon={<Email />}
            onClick={handleSendEmails}
            disabled={sendingEmails}
          >
            {sendingEmails ? 'Sending...' : 'Send Emails to Coders'}
          </Button>
        )}
        {showCodingButton && (
          <Button
            variant="contained"
            startIcon={<Assignment />}
            onClick={() => navigate(`/coding/${statement.id}`)}
          >
            Start Coding
          </Button>
        )}
        {statement.status !== 'pending' && (
          <>
            <Button
              variant="outlined"
              startIcon={<Description />}
              onClick={handleDownloadAllPDFs}
              disabled={downloadingZip}
            >
              Download All PDFs
            </Button>
            <Button
              variant="outlined"
              startIcon={<TableChart />}
              onClick={handleDownloadAllCSVs}
              disabled={downloadingZip}
            >
              Download All CSVs
            </Button>
            <Button
              variant="outlined"
              startIcon={<Archive />}
              onClick={handleDownloadAll}
              disabled={downloadingZip}
            >
              Download All Files
            </Button>
          </>
        )}
        {canExport && (
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExportCSV}
          >
            Export Coded Data
          </Button>
        )}
      </Box>

      {/* Cardholder Progress Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Cardholder</TableCell>
                <TableCell align="center">Transactions</TableCell>
                <TableCell align="center">Coded</TableCell>
                <TableCell align="center">Reviewed</TableCell>
                <TableCell align="center">Rejected</TableCell>
                <TableCell align="center">Progress</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {progress.cardholder_progress.map((cp) => (
                <TableRow key={cp.cardholder_id}>
                  <TableCell>{cp.cardholder_name}</TableCell>
                  <TableCell align="center">{cp.total_transactions}</TableCell>
                  <TableCell align="center">{cp.coded_transactions}</TableCell>
                  <TableCell align="center">{cp.reviewed_transactions}</TableCell>
                  <TableCell align="center">{cp.rejected_transactions}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={cp.progress_percentage}
                        sx={{ flex: 1, height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="body2">
                        {cp.progress_percentage.toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {statement.status !== 'pending' && (
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Tooltip title="Download PDF">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadPDF(cp.cardholder_id, cp.cardholder_name)}
                            color="error"
                          >
                            <Description />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download CSV">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadCSV(cp.cardholder_id, cp.cardholder_name)}
                            color="success"
                          >
                            <TableChart />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default StatementDetail;