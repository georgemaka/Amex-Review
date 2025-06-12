import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import Split from 'react-split';
import { RootState, AppDispatch } from '../../store';
import { fetchStatementProgress } from '../../store/slices/statementSlice';
import { fetchTransactions, setFilters } from '../../store/slices/transactionSlice';
import PDFViewer from './PDFViewer';
import TransactionCodingForm from './TransactionCodingForm';
import CodingProgress from './CodingProgress';

const CodingInterface: React.FC = () => {
  const { statementId } = useParams<{ statementId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { currentProgress } = useSelector((state: RootState) => state.statements);
  const { transactions, filters } = useSelector((state: RootState) => state.transactions);
  const [selectedCardholder, setSelectedCardholder] = useState<number | ''>('');
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);

  useEffect(() => {
    if (statementId) {
      dispatch(fetchStatementProgress(parseInt(statementId)));
    }
  }, [dispatch, statementId]);

  useEffect(() => {
    if (selectedCardholder) {
      dispatch(setFilters({ cardholder_statement_id: selectedCardholder }));
      dispatch(fetchTransactions({ 
        cardholder_statement_id: selectedCardholder,
        limit: 100 
      }));
    }
  }, [dispatch, selectedCardholder]);

  const handleCardholderChange = (event: SelectChangeEvent<number>) => {
    const value = event.target.value;
    setSelectedCardholder(value as number);
    setCurrentTransactionIndex(0);
  };

  const handleTransactionNavigation = (direction: 'next' | 'prev') => {
    if (direction === 'next' && currentTransactionIndex < transactions.length - 1) {
      setCurrentTransactionIndex(currentTransactionIndex + 1);
    } else if (direction === 'prev' && currentTransactionIndex > 0) {
      setCurrentTransactionIndex(currentTransactionIndex - 1);
    }
  };

  const currentTransaction = transactions[currentTransactionIndex];
  const cardholderProgress = currentProgress?.cardholder_progress.find(
    (cp: any) => cp.cardholder_statement_id === selectedCardholder
  );

  if (!currentProgress) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading statement data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Typography variant="h5">
              Code Transactions - {currentProgress.statement_id}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Cardholder</InputLabel>
              <Select
                value={selectedCardholder}
                onChange={handleCardholderChange}
                label="Select Cardholder"
              >
                <MenuItem value="">
                  <em>Choose a cardholder</em>
                </MenuItem>
                {currentProgress.cardholder_progress.map((cp: any) => (
                  <MenuItem key={cp.cardholder_statement_id} value={cp.cardholder_statement_id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <span>{cp.cardholder_name}</span>
                      <Chip
                        size="small"
                        label={`${cp.coded_transactions}/${cp.total_transactions}`}
                        color={cp.progress_percentage === 100 ? 'success' : 'default'}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            {cardholderProgress && (
              <CodingProgress
                total={cardholderProgress.total_transactions}
                coded={cardholderProgress.coded_transactions}
                reviewed={cardholderProgress.reviewed_transactions}
                rejected={cardholderProgress.rejected_transactions}
              />
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content */}
      {selectedCardholder ? (
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <Split
            className="split"
            sizes={[50, 50]}
            minSize={400}
            gutterSize={10}
            style={{ display: 'flex', height: '100%' }}
          >
            {/* PDF Viewer */}
            <Box sx={{ height: '100%', overflow: 'auto', bgcolor: 'grey.100' }}>
              <PDFViewer
                pdfUrl={`/api/v1/statements/${statementId}/cardholder/${cardholderProgress?.cardholder_id}/pdf`}
                currentPage={1} // This would be calculated based on transaction
              />
            </Box>

            {/* Coding Form */}
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              {currentTransaction ? (
                <TransactionCodingForm
                  transaction={currentTransaction}
                  onNext={() => handleTransactionNavigation('next')}
                  onPrev={() => handleTransactionNavigation('prev')}
                  hasNext={currentTransactionIndex < transactions.length - 1}
                  hasPrev={currentTransactionIndex > 0}
                  currentIndex={currentTransactionIndex + 1}
                  totalCount={transactions.length}
                />
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No transactions to code for this cardholder
                  </Typography>
                </Box>
              )}
            </Box>
          </Split>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Please select a cardholder to begin coding
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CodingInterface;