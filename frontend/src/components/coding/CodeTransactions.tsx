import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Checkbox,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from '@mui/material';
import {
  Save,
  Search,
  Clear,
  BatchPrediction,
  Business,
  Work,
  Build,
  Edit,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import api from '../../services/api';
import { RootState } from '../../store';
import { extractMerchantName } from '../../utils/merchantParser';

interface Transaction {
  id: number;
  transaction_date: string;
  posting_date: string;
  description: string;
  amount: number;
  merchant_name?: string;
  status: string;
  cardholder_statement_id: number;
  cardholder_statement: {
    cardholder: {
      id: number;
      full_name: string;
    };
  };
  company?: any;
  gl_account_rel?: any;
  job?: any;
  job_phase?: any;
  job_cost_type?: any;
  equipment?: any;
  equipment_cost_code?: any;
  equipment_cost_type?: any;
  coding_type?: string;
  notes?: string;
}

const CodeTransactions: React.FC = () => {
  // Early return test
  // return <Typography>CodeTransactions component is rendering</Typography>;
  
  const { user } = useSelector((state: RootState) => state.auth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filters
  const [selectedCardholder, setSelectedCardholder] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Reference data
  const [cardholders, setCardholders] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobPhases, setJobPhases] = useState<any[]>([]);
  const [jobCostTypes, setJobCostTypes] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [equipmentCostCodes, setEquipmentCostCodes] = useState<any[]>([]);
  const [equipmentCostTypes, setEquipmentCostTypes] = useState<any[]>([]);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Sorting
  const [orderBy, setOrderBy] = useState<string>('transaction_date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  
  // Selection
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [codingDialogOpen, setCodingDialogOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  const [bulkCodingDialogOpen, setBulkCodingDialogOpen] = useState(false);
  
  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null);
  const [inlineCoding, setInlineCoding] = useState<{[key: number]: any}>({});
  const [highlightedMerchant, setHighlightedMerchant] = useState<string | null>(null);
  const [selectedCodingTypes, setSelectedCodingTypes] = useState<{[key: number]: string}>({});
  
  
  // Coding form
  const [codingType, setCodingType] = useState<string>('gl_account');
  const [selectedCompany, setSelectedCompany] = useState<number | ''>('');
  const [selectedGlAccount, setSelectedGlAccount] = useState<number | ''>('');
  const [selectedJob, setSelectedJob] = useState<number | ''>('');
  const [selectedJobPhase, setSelectedJobPhase] = useState<number | ''>('');
  const [selectedJobCostType, setSelectedJobCostType] = useState<number | ''>('');
  const [selectedEquipment, setSelectedEquipment] = useState<number | ''>('');
  const [selectedEquipmentCostCode, setSelectedEquipmentCostCode] = useState<number | ''>('');
  const [selectedEquipmentCostType, setSelectedEquipmentCostType] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Load reference data on mount
  useEffect(() => {
    loadReferenceData();
  }, []);

  // Load transactions when filters change
  useEffect(() => {
    loadTransactions();
  }, [selectedCardholder, dateFrom, dateTo, statusFilter, page, rowsPerPage]);

  // Load job phases when job changes
  useEffect(() => {
    if (selectedJob) {
      loadJobPhases(selectedJob as number);
    } else {
      setJobPhases([]);
      setSelectedJobPhase('');
    }
  }, [selectedJob]);

  // Load GL accounts when company changes
  useEffect(() => {
    if (selectedCompany) {
      loadGlAccounts(selectedCompany as number);
    } else {
      setGlAccounts([]);
      setSelectedGlAccount('');
    }
  }, [selectedCompany]);

  const loadReferenceData = async () => {
    try {
      const [
        cardholderRes,
        companyRes,
        jobRes,
        jobCostTypeRes,
        equipmentRes,
        equipmentCostCodeRes,
        equipmentCostTypeRes,
      ] = await Promise.all([
        api.getCardholders(),
        api.getCompanies(),
        api.getJobs(),
        api.getJobCostTypes(),
        api.getEquipment(),
        api.getEquipmentCostCodes(),
        api.getEquipmentCostTypes(),
      ]);

      setCardholders(cardholderRes);
      setCompanies(companyRes);
      setJobs(jobRes);
      setJobCostTypes(jobCostTypeRes);
      setEquipment(equipmentRes);
      setEquipmentCostCodes(equipmentCostCodeRes);
      setEquipmentCostTypes(equipmentCostTypeRes);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  const loadGlAccounts = async (companyId: number) => {
    try {
      const res = await api.getGLAccounts({ company_id: companyId });
      setGlAccounts(res);
    } catch (err) {
      console.error('Failed to load GL accounts:', err);
    }
  };

  const loadJobPhases = async (jobId: number) => {
    try {
      const res = await api.getJobPhases(jobId);
      setJobPhases(res);
    } catch (err) {
      console.error('Failed to load job phases:', err);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: any = {
        skip: page * rowsPerPage,
        limit: rowsPerPage,
      };
      
      // Only add status if it's not 'all'
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      if (selectedCardholder) params.cardholder_id = selectedCardholder;
      if (dateFrom) params.date_from = format(dateFrom, 'yyyy-MM-dd');
      if (dateTo) params.date_to = format(dateTo, 'yyyy-MM-dd');
      
      console.log('Loading transactions with params:', params);
      console.log('Date from:', dateFrom, 'formatted:', params.date_from);
      console.log('Date to:', dateTo, 'formatted:', params.date_to);
      
      const res = await api.getCodingTransactions(params);
      console.log('Transactions loaded:', res);
      
      // Ensure we have an array
      const transactionArray = Array.isArray(res) ? res : [];
      if (transactionArray.length > 0) {
        console.log('First transaction structure:', transactionArray[0]);
        console.log('Cardholder statement:', transactionArray[0].cardholder_statement);
      }
      
      setTransactions(transactionArray);
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
      console.error('Error response:', err.response);
      // Show more detailed error message
      const errorMessage = typeof err.response?.data?.detail === 'string' 
        ? err.response.data.detail 
        : err.message || 'Failed to load transactions';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions based on search term
  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const merchantName = extractMerchantName(transaction.description).toLowerCase();
    const description = transaction.description.toLowerCase();
    const amount = transaction.amount.toString();
    const date = format(new Date(transaction.transaction_date), 'MM/dd/yyyy');
    const cardholder = transaction.cardholder_statement?.cardholder?.full_name?.toLowerCase() || '';
    
    return (
      merchantName.includes(searchLower) ||
      description.includes(searchLower) ||
      amount.includes(searchLower) ||
      date.includes(searchLower) ||
      cardholder.includes(searchLower)
    );
  });

  // Sort filtered transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (orderBy) {
      case 'transaction_date':
        aValue = new Date(a.transaction_date).getTime();
        bValue = new Date(b.transaction_date).getTime();
        break;
      case 'cardholder':
        aValue = a.cardholder_statement?.cardholder?.full_name || '';
        bValue = b.cardholder_statement?.cardholder?.full_name || '';
        break;
      case 'description':
        aValue = extractMerchantName(a.description);
        bValue = extractMerchantName(b.description);
        break;
      case 'amount':
        aValue = a.amount;
        bValue = b.amount;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      default:
        return 0;
    }
    
    if (order === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedTransactions(sortedTransactions.map(t => t.id));
    } else {
      setSelectedTransactions([]);
    }
  };

  const handleSelectTransaction = (id: number) => {
    setSelectedTransactions(prev => {
      if (prev.includes(id)) {
        return prev.filter(tid => tid !== id);
      }
      return [...prev, id];
    });
  };

  const handleOpenCodingDialog = (transaction?: Transaction) => {
    if (transaction) {
      setCurrentTransaction(transaction);
      setSelectedTransactions([transaction.id]);
      
      // Pre-fill form if transaction is already coded
      if (transaction.coding_type) {
        setCodingType(transaction.coding_type);
        setSelectedCompany(transaction.company?.id || '');
        setSelectedGlAccount(transaction.gl_account_rel?.id || '');
        setSelectedJob(transaction.job?.id || '');
        setSelectedJobPhase(transaction.job_phase?.id || '');
        setSelectedJobCostType(transaction.job_cost_type?.id || '');
        setSelectedEquipment(transaction.equipment?.id || '');
        setSelectedEquipmentCostCode(transaction.equipment_cost_code?.id || '');
        setSelectedEquipmentCostType(transaction.equipment_cost_type?.id || '');
        setNotes(transaction.notes || '');
      }
    } else {
      setCurrentTransaction(null);
    }
    
    setCodingDialogOpen(true);
  };

  const handleCloseCodingDialog = () => {
    setCodingDialogOpen(false);
    setCurrentTransaction(null);
    resetCodingForm();
  };

  const resetCodingForm = () => {
    setCodingType('gl_account');
    setSelectedCompany('');
    setSelectedGlAccount('');
    setSelectedJob('');
    setSelectedJobPhase('');
    setSelectedJobCostType('');
    setSelectedEquipment('');
    setSelectedEquipmentCostCode('');
    setSelectedEquipmentCostType('');
    setNotes('');
  };

  const handleSaveInlineCoding = async (transactionId: number) => {
    const coding = inlineCoding[transactionId];
    if (!coding) return;
    
    setLoading(true);
    try {
      await api.put(`/api/v1/coding/transactions/${transactionId}/code`, {
        coding_type: coding.codingType,
        company_id: coding.selectedCompany || null,
        gl_account_id: coding.selectedGlAccount || null,
        job_id: coding.selectedJob || null,
        job_phase_id: coding.selectedJobPhase || null,
        job_cost_type_id: coding.selectedJobCostType || null,
        equipment_id: coding.selectedEquipment || null,
        equipment_cost_code_id: coding.selectedEquipmentCostCode || null,
        equipment_cost_type_id: coding.selectedEquipmentCostType || null,
        notes: coding.notes || ''
      });
      
      setSuccess('Transaction coded successfully');
      setInlineEditingId(null);
      setInlineCoding(prev => {
        const updated = {...prev};
        delete updated[transactionId];
        return updated;
      });
      await loadTransactions();
    } catch (err: any) {
      const errorMessage = typeof err.response?.data?.detail === 'string' 
        ? err.response.data.detail 
        : err.message || 'Failed to save coding';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCoding = async () => {
    try {
      const codingData: any = {
        coding_type: codingType,
        notes,
      };

      if (selectedCompany) codingData.company_id = selectedCompany;

      if (codingType === 'gl_account') {
        if (!selectedGlAccount) {
          setError('Please select a GL account');
          return;
        }
        codingData.gl_account_id = selectedGlAccount;
      } else if (codingType === 'job') {
        if (!selectedJob) {
          setError('Please select a job');
          return;
        }
        codingData.job_id = selectedJob;
        if (selectedJobPhase) codingData.job_phase_id = selectedJobPhase;
        if (selectedJobCostType) codingData.job_cost_type_id = selectedJobCostType;
      } else if (codingType === 'equipment') {
        if (!selectedEquipment) {
          setError('Please select equipment');
          return;
        }
        codingData.equipment_id = selectedEquipment;
        if (selectedEquipmentCostCode) codingData.equipment_cost_code_id = selectedEquipmentCostCode;
        if (selectedEquipmentCostType) codingData.equipment_cost_type_id = selectedEquipmentCostType;
      }

      if (currentTransaction) {
        // Single transaction
        await api.codeTransaction(currentTransaction.id, codingData);
        setSuccess('Transaction coded successfully');
      } else {
        // Batch coding
        await api.batchCodeTransactions({
          transaction_ids: selectedTransactions,
          ...codingData,
        });
        setSuccess(`${selectedTransactions.length} transactions coded successfully`);
      }

      handleCloseCodingDialog();
      loadTransactions();
      setSelectedTransactions([]);
    } catch (err: any) {
      const errorMessage = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : err.message || 'Failed to save coding';
      setError(errorMessage);
      console.error(err);
    }
  };

  const getStatusChip = (status: string) => {
    const statusConfig: any = {
      uncoded: { color: 'default', label: 'Uncoded' },
      coded: { color: 'primary', label: 'Coded' },
      reviewed: { color: 'success', label: 'Reviewed' },
      rejected: { color: 'error', label: 'Rejected' },
    };

    const config = statusConfig[status] || statusConfig.uncoded;
    return <Chip size="small" color={config.color} label={config.label} />;
  };

  const getCodingTypeIcon = (type: string) => {
    switch (type) {
      case 'gl_account':
        return <Business fontSize="small" />;
      case 'job':
        return <Work fontSize="small" />;
      case 'equipment':
        return <Build fontSize="small" />;
      default:
        return null;
    }
  };


  return (
    <Box sx={{ pb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mt: 0 }}>
        Code Transactions
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ 
        p: 2, 
        mb: 2,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'background.paper',
        boxShadow: 2
      }}>
        <Grid container spacing={2}>
          {/* First Row */}
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small"
              options={cardholders}
              getOptionLabel={(option) => option.full_name || ''}
              value={cardholders.find(c => c.id === selectedCardholder) || null}
              onChange={(_, newValue) => {
                setSelectedCardholder(newValue?.id || '');
              }}
              renderInput={(params) => (
                <TextField {...params} label="Cardholder" placeholder="Type to search..." />
              )}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date From"
                value={dateFrom}
                onChange={setDateFrom}
                slotProps={{
                  textField: { size: 'small', fullWidth: true }
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date To"
                value={dateTo}
                onChange={setDateTo}
                slotProps={{
                  textField: { size: 'small', fullWidth: true }
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} md={3}>
            <Button
              variant="outlined"
              startIcon={<Clear />}
              onClick={() => {
                setSelectedCardholder('');
                setDateFrom(null);
                setDateTo(null);
                setStatusFilter('all');
                setSearchTerm('');
              }}
              fullWidth
              sx={{ height: '40px' }}
            >
              Clear Filters
            </Button>
          </Grid>

          {/* Second Row */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="uncoded">Uncoded</MenuItem>
                <MenuItem value="coded">Coded</MenuItem>
                <MenuItem value="reviewed">Reviewed</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={9}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by merchant, cardholder, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />,
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Actions */}
      {selectedTransactions.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">
              {selectedTransactions.length} transaction{selectedTransactions.length > 1 ? 's' : ''} selected
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<BatchPrediction />}
              onClick={() => handleOpenCodingDialog()}
            >
              Batch Code
            </Button>
          </Box>
        </Paper>
      )}

      {/* Results count and help text */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {searchTerm && !loading && (
          <Typography variant="body2" color="text.secondary">
            Showing {sortedTransactions.length} of {transactions.length} transactions
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          Click merchant name to highlight similar transactions • Select GL/Job/Equipment to start coding
        </Typography>
      </Box>

      {/* Transactions Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedTransactions.length > 0 && selectedTransactions.length < filteredTransactions.length}
                        checked={filteredTransactions.length > 0 && selectedTransactions.length === filteredTransactions.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell sx={{ width: 100 }}>
                      <TableSortLabel
                        active={orderBy === 'transaction_date'}
                        direction={orderBy === 'transaction_date' ? order : 'asc'}
                        onClick={() => handleRequestSort('transaction_date')}
                      >
                        Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ width: 150 }}>
                      <TableSortLabel
                        active={orderBy === 'cardholder'}
                        direction={orderBy === 'cardholder' ? order : 'asc'}
                        onClick={() => handleRequestSort('cardholder')}
                      >
                        Cardholder
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'description'}
                        direction={orderBy === 'description' ? order : 'asc'}
                        onClick={() => handleRequestSort('description')}
                      >
                        Description
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ width: 100 }}>
                      <TableSortLabel
                        active={orderBy === 'amount'}
                        direction={orderBy === 'amount' ? order : 'asc'}
                        onClick={() => handleRequestSort('amount')}
                      >
                        Amount
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ width: 100 }}>
                      <TableSortLabel
                        active={orderBy === 'status'}
                        direction={orderBy === 'status' ? order : 'asc'}
                        onClick={() => handleRequestSort('status')}
                      >
                        Status
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Coding</TableCell>
                    <TableCell align="center" sx={{ width: 80 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      hover
                      selected={selectedTransactions.includes(transaction.id)}
                      sx={{
                        backgroundColor: highlightedMerchant && extractMerchantName(transaction.description) === highlightedMerchant
                          ? 'action.hover'
                          : 'inherit'
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedTransactions.includes(transaction.id)}
                          onChange={() => handleSelectTransaction(transaction.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {format(new Date(transaction.transaction_date), 'MM/dd/yyyy')}
                      </TableCell>
                      <TableCell>
                        {transaction.cardholder_statement?.cardholder?.full_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ maxWidth: 400 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 500,
                              cursor: 'pointer',
                              '&:hover': { textDecoration: 'underline' }
                            }}
                            onClick={() => {
                              const merchant = extractMerchantName(transaction.description);
                              if (highlightedMerchant === merchant) {
                                setHighlightedMerchant(null);
                              } else {
                                setHighlightedMerchant(merchant);
                                // Auto-select all transactions with the same merchant
                                const samemerchantTransactions = sortedTransactions
                                  .filter(t => extractMerchantName(t.description) === merchant)
                                  .map(t => t.id);
                                setSelectedTransactions(prev => {
                                  const newSelection = [...new Set([...prev, ...samemerchantTransactions])];
                                  return newSelection;
                                });
                              }
                            }}
                          >
                            {extractMerchantName(transaction.description)}
                          </Typography>
                          <Tooltip title={transaction.description}>
                            <Typography 
                              variant="caption" 
                              color="text.secondary" 
                              sx={{ 
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {transaction.description}
                            </Typography>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        ${transaction.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getStatusChip(transaction.status)}
                      </TableCell>
                      <TableCell>
                        {!transaction.coding_type || selectedCodingTypes[transaction.id] ? (
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <ToggleButtonGroup
                              value={selectedCodingTypes[transaction.id] || null}
                              exclusive
                              onChange={(e, newType) => {
                                if (newType) {
                                  setSelectedCodingTypes(prev => ({...prev, [transaction.id]: newType}));
                                  setInlineCoding(prev => ({
                                    ...prev,
                                    [transaction.id]: {
                                      ...prev[transaction.id],
                                      codingType: newType
                                    }
                                  }));
                                }
                              }}
                              size="small"
                            >
                              <ToggleButton value="gl_account" sx={{ px: 0.75, py: 0.25, fontSize: '0.75rem' }}>
                                <Business sx={{ fontSize: 16, mr: 0.25 }} />
                                GL
                              </ToggleButton>
                              <ToggleButton value="job" sx={{ px: 0.75, py: 0.25, fontSize: '0.75rem' }}>
                                <Work sx={{ fontSize: 16, mr: 0.25 }} />
                                Job
                              </ToggleButton>
                              <ToggleButton value="equipment" sx={{ px: 0.75, py: 0.25, fontSize: '0.75rem' }}>
                                <Build sx={{ fontSize: 16, mr: 0.25 }} />
                                Equip
                              </ToggleButton>
                            </ToggleButtonGroup>
                            
                            {selectedCodingTypes[transaction.id] === 'gl_account' && (
                              <>
                                <FormControl size="small" sx={{ minWidth: 90 }}>
                                  <Select
                                    value={inlineCoding[transaction.id]?.selectedCompany || ''}
                                    onChange={(e) => {
                                      setInlineCoding(prev => ({
                                        ...prev,
                                        [transaction.id]: {
                                          ...prev[transaction.id],
                                          selectedCompany: e.target.value,
                                          codingType: 'gl_account'
                                        }
                                      }));
                                    }}
                                    displayEmpty
                                    size="small"
                                  >
                                    <MenuItem value="">Company</MenuItem>
                                    {companies.map(company => (
                                      <MenuItem key={company.id} value={company.id}>
                                        {company.code} - {company.name}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                {inlineCoding[transaction.id]?.selectedCompany && (
                                  <FormControl size="small" sx={{ minWidth: 110 }}>
                                    <Select
                                      value={inlineCoding[transaction.id]?.selectedGlAccount || ''}
                                      onChange={(e) => {
                                        setInlineCoding(prev => ({
                                          ...prev,
                                          [transaction.id]: {
                                            ...prev[transaction.id],
                                            selectedGlAccount: e.target.value
                                          }
                                        }));
                                      }}
                                      displayEmpty
                                      size="small"
                                    >
                                      <MenuItem value="">GL Account</MenuItem>
                                      {glAccounts
                                        .filter(gl => gl.company_id === inlineCoding[transaction.id]?.selectedCompany)
                                        .map(gl => (
                                          <MenuItem key={gl.id} value={gl.id}>
                                            {gl.account_code} - {gl.description}
                                          </MenuItem>
                                        ))}
                                    </Select>
                                  </FormControl>
                                )}
                              </>
                            )}
                            
                            {selectedCodingTypes[transaction.id] === 'job' && (
                              <FormControl size="small" sx={{ minWidth: 140 }}>
                                <Select
                                  value={inlineCoding[transaction.id]?.selectedJob || ''}
                                  onChange={(e) => {
                                    setInlineCoding(prev => ({
                                      ...prev,
                                      [transaction.id]: {
                                        ...prev[transaction.id],
                                        selectedJob: e.target.value
                                      }
                                    }));
                                  }}
                                  displayEmpty
                                  size="small"
                                >
                                  <MenuItem value="">Select Job</MenuItem>
                                  {jobs.map(job => (
                                    <MenuItem key={job.id} value={job.id}>
                                      {job.job_number} - {job.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                            
                            {selectedCodingTypes[transaction.id] === 'equipment' && (
                              <FormControl size="small" sx={{ minWidth: 140 }}>
                                <Select
                                  value={inlineCoding[transaction.id]?.selectedEquipment || ''}
                                  onChange={(e) => {
                                    setInlineCoding(prev => ({
                                      ...prev,
                                      [transaction.id]: {
                                        ...prev[transaction.id],
                                        selectedEquipment: e.target.value
                                      }
                                    }));
                                  }}
                                  displayEmpty
                                  size="small"
                                >
                                  <MenuItem value="">Select Equipment</MenuItem>
                                  {equipment.map(eq => (
                                    <MenuItem key={eq.id} value={eq.id}>
                                      {eq.equipment_number} - {eq.description}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                          </Box>
                        ) : (
                          transaction.coding_type && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {getCodingTypeIcon(transaction.coding_type)}
                              <Typography variant="caption">
                                {transaction.coding_type === 'gl_account' && `${transaction.company?.name || ''} - ${transaction.gl_account_rel?.account_code || ''}`}
                                {transaction.coding_type === 'job' && transaction.job?.job_number}
                                {transaction.coding_type === 'equipment' && transaction.equipment?.equipment_number}
                              </Typography>
                            </Box>
                          )
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          {(selectedCodingTypes[transaction.id] && 
                            ((selectedCodingTypes[transaction.id] === 'gl_account' && inlineCoding[transaction.id]?.selectedGlAccount) ||
                             (selectedCodingTypes[transaction.id] === 'job' && inlineCoding[transaction.id]?.selectedJob) ||
                             (selectedCodingTypes[transaction.id] === 'equipment' && inlineCoding[transaction.id]?.selectedEquipment))) ? (
                            <>
                              <Tooltip title="Save">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleSaveInlineCoding(transaction.id)}
                                  disabled={!inlineCoding[transaction.id]?.selectedCompany && !inlineCoding[transaction.id]?.selectedJob && !inlineCoding[transaction.id]?.selectedEquipment}
                                >
                                  <Save />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Cancel">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setInlineEditingId(null);
                                    setSelectedCodingTypes(prev => {
                                      const updated = {...prev};
                                      delete updated[transaction.id];
                                      return updated;
                                    });
                                    setInlineCoding(prev => {
                                      const updated = {...prev};
                                      delete updated[transaction.id];
                                      return updated;
                                    });
                                  }}
                                >
                                  <Clear />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <>
                              {transaction.coding_type ? (
                                <Tooltip title="Edit Coding">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => {
                                      setSelectedCodingTypes(prev => ({...prev, [transaction.id]: transaction.coding_type}));
                                      setInlineCoding(prev => ({
                                        ...prev,
                                        [transaction.id]: {
                                          codingType: transaction.coding_type,
                                          selectedCompany: transaction.company_id || '',
                                          selectedGlAccount: transaction.gl_account_id || '',
                                          selectedJob: transaction.job_id || '',
                                          selectedEquipment: transaction.equipment_id || '',
                                          notes: transaction.notes || ''
                                        }
                                      }));
                                    }}
                                  >
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          {searchTerm 
                            ? `No transactions found matching "${searchTerm}"`
                            : 'No transactions found'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={-1}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Paper>

      {/* Coding Dialog */}
      <Dialog open={codingDialogOpen} onClose={handleCloseCodingDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {currentTransaction ? 'Code Transaction' : `Code ${selectedTransactions.length} Transactions`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Coding Type</InputLabel>
                  <Select
                    value={codingType}
                    onChange={(e) => setCodingType(e.target.value)}
                    label="Coding Type"
                  >
                    <MenuItem value="gl_account">GL Account</MenuItem>
                    <MenuItem value="job">Job</MenuItem>
                    <MenuItem value="equipment">Equipment</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value as number | '')}
                    label="Company"
                  >
                    <MenuItem value="">Select Company</MenuItem>
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.code} - {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {codingType === 'gl_account' && (
                <Grid item xs={12}>
                  <FormControl fullWidth disabled={!selectedCompany}>
                    <InputLabel>GL Account</InputLabel>
                    <Select
                      value={selectedGlAccount}
                      onChange={(e) => setSelectedGlAccount(e.target.value as number | '')}
                      label="GL Account"
                    >
                      <MenuItem value="">Select GL Account</MenuItem>
                      {glAccounts.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          {account.account_code} - {account.description}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {codingType === 'job' && (
                <>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Job</InputLabel>
                      <Select
                        value={selectedJob}
                        onChange={(e) => setSelectedJob(e.target.value as number | '')}
                        label="Job"
                      >
                        <MenuItem value="">Select Job</MenuItem>
                        {jobs.map((job) => (
                          <MenuItem key={job.id} value={job.id}>
                            {job.job_number} - {job.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth disabled={!selectedJob}>
                      <InputLabel>Phase</InputLabel>
                      <Select
                        value={selectedJobPhase}
                        onChange={(e) => setSelectedJobPhase(e.target.value as number | '')}
                        label="Phase"
                      >
                        <MenuItem value="">Select Phase</MenuItem>
                        {jobPhases.map((phase) => (
                          <MenuItem key={phase.id} value={phase.id}>
                            {phase.phase_code} - {phase.description}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Cost Type</InputLabel>
                      <Select
                        value={selectedJobCostType}
                        onChange={(e) => setSelectedJobCostType(e.target.value as number | '')}
                        label="Cost Type"
                      >
                        <MenuItem value="">Select Cost Type</MenuItem>
                        {jobCostTypes.map((type) => (
                          <MenuItem key={type.id} value={type.id}>
                            {type.code} - {type.description}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}

              {codingType === 'equipment' && (
                <>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Equipment</InputLabel>
                      <Select
                        value={selectedEquipment}
                        onChange={(e) => setSelectedEquipment(e.target.value as number | '')}
                        label="Equipment"
                      >
                        <MenuItem value="">Select Equipment</MenuItem>
                        {equipment.map((eq) => (
                          <MenuItem key={eq.id} value={eq.id}>
                            {eq.equipment_number} - {eq.description}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Cost Code</InputLabel>
                      <Select
                        value={selectedEquipmentCostCode}
                        onChange={(e) => setSelectedEquipmentCostCode(e.target.value as number | '')}
                        label="Cost Code"
                      >
                        <MenuItem value="">Select Cost Code</MenuItem>
                        {equipmentCostCodes.map((code) => (
                          <MenuItem key={code.id} value={code.id}>
                            {code.code} - {code.description}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Cost Type</InputLabel>
                      <Select
                        value={selectedEquipmentCostType}
                        onChange={(e) => setSelectedEquipmentCostType(e.target.value as number | '')}
                        label="Cost Type"
                      >
                        <MenuItem value="">Select Cost Type</MenuItem>
                        {equipmentCostTypes.map((type) => (
                          <MenuItem key={type.id} value={type.id}>
                            {type.code} - {type.description}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCodingDialog}>Cancel</Button>
          <Button onClick={handleSaveCoding} variant="contained" color="primary">
            Save Coding
          </Button>
        </DialogActions>
      </Dialog>


      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CodeTransactions;