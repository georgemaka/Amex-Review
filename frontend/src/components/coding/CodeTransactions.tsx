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
  LinearProgress,
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
  ContentCopy,
  CallSplit,
  Add,
  Remove,
  ChevronLeft,
  ChevronRight,
  Lock,
  Refresh,
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
    statement?: {
      id: number;
      is_locked: boolean;
      lock_reason?: string;
    };
  };
  // Coding fields with IDs
  company_id?: number;
  gl_account_id?: number;
  job_id?: number;
  job_phase_id?: number;
  job_cost_type_id?: number;
  equipment_id?: number;
  equipment_cost_code_id?: number;
  equipment_cost_type_id?: number;
  // Relationships
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
  const [totalStats, setTotalStats] = useState<{
    total_count: number;
    total_amount: number;
    coded_count: number;
    coded_amount: number;
  }>({
    total_count: 0,
    total_amount: 0,
    coded_count: 0,
    coded_amount: 0
  });
  
  // Filters
  const [selectedCardholder, setSelectedCardholder] = useState<number | ''>('');
  const [selectedStatement, setSelectedStatement] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Reference data
  const [cardholders, setCardholders] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
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
  
  // Recently used items tracking
  const [recentlyUsedCompanies, setRecentlyUsedCompanies] = useState<number[]>([]);
  const [recentlyUsedGlAccounts, setRecentlyUsedGlAccounts] = useState<number[]>([]);
  
  // Check if current statement is locked
  const currentStatement = statements.find(s => s.id === selectedStatement);
  const isStatementLocked = currentStatement?.is_locked || false;
  
  // Debug logging
  useEffect(() => {
    console.log('Current statement:', currentStatement);
    console.log('Is statement locked?', isStatementLocked);
    console.log('All statements:', statements);
  }, [currentStatement, isStatementLocked, statements]);
  
  // Split transaction
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitTransaction, setSplitTransaction] = useState<Transaction | null>(null);
  const [splitLines, setSplitLines] = useState<any[]>([]);
  const [recentlyUsedJobs, setRecentlyUsedJobs] = useState<number[]>([]);
  const [recentlyUsedEquipment, setRecentlyUsedEquipment] = useState<number[]>([]);
  
  
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

  // Load reference data on mount and when window gains focus
  useEffect(() => {
    loadReferenceData();
    
    // Reload when window gains focus (e.g., switching tabs or returning to page)
    const handleFocus = () => {
      console.log('Window focused, reloading reference data...');
      loadReferenceData();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Debug cardholders
  useEffect(() => {
    console.log('Cardholders state updated:', cardholders);
  }, [cardholders]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedCardholder, dateFrom, dateTo, statusFilter, searchTerm]);

  // Load transactions when filters change
  useEffect(() => {
    loadTransactions();
  }, [selectedCardholder, selectedStatement, dateFrom, dateTo, statusFilter, page, rowsPerPage]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+S or Cmd+S - Save current transaction
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const editingTransactionId = Object.keys(inlineCoding)[0];
        if (editingTransactionId) {
          handleSaveInlineCoding(parseInt(editingTransactionId));
        }
      }

      // Escape - Cancel current editing
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedCodingTypes({});
        setInlineCoding({});
        setInlineEditingId(null);
      }

      // 1, 2, 3 - Quick coding type selection
      if (inlineEditingId) {
        if (e.key === '1') {
          e.preventDefault();
          setSelectedCodingTypes(prev => ({...prev, [inlineEditingId]: 'gl_account'}));
        } else if (e.key === '2') {
          e.preventDefault();
          setSelectedCodingTypes(prev => ({...prev, [inlineEditingId]: 'job'}));
        } else if (e.key === '3') {
          e.preventDefault();
          setSelectedCodingTypes(prev => ({...prev, [inlineEditingId]: 'equipment'}));
        }
      }

      // Ctrl+A or Cmd+A - Select all visible transactions
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault();
        // We'll handle this in the component since sortedTransactions isn't available here
        document.dispatchEvent(new CustomEvent('selectAllTransactions'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inlineCoding, inlineEditingId]);

  const loadReferenceData = async () => {
    try {
      const [
        cardholderRes,
        statementRes,
        companyRes,
        jobRes,
        jobCostTypeRes,
        equipmentRes,
        equipmentCostCodeRes,
        equipmentCostTypeRes,
      ] = await Promise.all([
        api.getCardholders(), // Temporarily using regular endpoint to test
        api.getStatements(),
        api.getCompanies(),
        api.getJobs(),
        api.getJobCostTypes(),
        api.getEquipment(),
        api.getEquipmentCostCodes(),
        api.getEquipmentCostTypes(),
      ]);

      console.log('Cardholder response:', cardholderRes);
      setCardholders(cardholderRes);
      setStatements(statementRes);
      setCompanies(companyRes);
      setJobs(jobRes);
      setJobCostTypes(jobCostTypeRes);
      setEquipment(equipmentRes);
      setEquipmentCostCodes(equipmentCostCodeRes);
      setEquipmentCostTypes(equipmentCostTypeRes);
      
      // Set most recent unlocked statement as default
      const unlockedStatements = statementRes.filter((s: any) => !s.is_locked);
      if (unlockedStatements.length > 0 && !selectedStatement) {
        setSelectedStatement(unlockedStatements[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load reference data:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError('Failed to load dropdown data. Please refresh the page.');
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
      if (selectedStatement) params.statement_id = selectedStatement;
      if (dateFrom) params.date_from = format(dateFrom, 'yyyy-MM-dd');
      if (dateTo) params.date_to = format(dateTo, 'yyyy-MM-dd');
      
      console.log('Loading transactions with params:', params);
      console.log('Date from:', dateFrom, 'formatted:', params.date_from);
      console.log('Date to:', dateTo, 'formatted:', params.date_to);
      console.log('Selected cardholder state value:', selectedCardholder);
      console.log('Type of selectedCardholder:', typeof selectedCardholder);
      
      const res = await api.getCodingTransactions(params);
      console.log('Transactions loaded:', res);
      
      // Handle new paginated response format
      if (res.transactions) {
        console.log('Number of transactions received:', res.transactions.length);
        console.log('Total stats:', {
          total_count: res.total_count,
          total_amount: res.total_amount,
          coded_count: res.coded_count,
          coded_amount: res.coded_amount
        });
        
        setTransactions(res.transactions);
        setTotalStats({
          total_count: res.total_count,
          total_amount: res.total_amount,
          coded_count: res.coded_count,
          coded_amount: res.coded_amount
        });
      } else {
        // Fallback for old response format
        const transactionArray = Array.isArray(res) ? res : [];
        setTransactions(transactionArray);
      }
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

  // Calculate coding progress - use total stats if available
  const codedCount = totalStats.coded_count || filteredTransactions.filter(t => t.status === 'coded' || t.status === 'reviewed').length;
  const totalCount = totalStats.total_count || filteredTransactions.length;
  const progressPercentage = totalCount > 0 ? (codedCount / totalCount) * 100 : 0;

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
        // First sort by cardholder name
        aValue = a.cardholder_statement?.cardholder?.full_name || '';
        bValue = b.cardholder_statement?.cardholder?.full_name || '';
        
        // If same cardholder, sort by transaction date (newest first)
        if (aValue === bValue) {
          const aDate = new Date(a.transaction_date).getTime();
          const bDate = new Date(b.transaction_date).getTime();
          return bDate - aDate; // Always descending for date within same cardholder
        }
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
    
    // Skip the normal comparison if we already handled it (cardholder case with same name)
    if (orderBy === 'cardholder' && aValue === bValue) {
      return 0; // Already handled above
    }
    
    if (order === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue > bValue ? -1 : 1;
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
      await api.codeTransaction(transactionId, {
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
      
      // Track recently used items
      if (coding.selectedCompany) trackRecentlyUsed('company', coding.selectedCompany);
      if (coding.selectedGlAccount) trackRecentlyUsed('gl_account', coding.selectedGlAccount);
      if (coding.selectedJob) trackRecentlyUsed('job', coding.selectedJob);
      if (coding.selectedEquipment) trackRecentlyUsed('equipment', coding.selectedEquipment);
      
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

  // Find previously coded transaction with same merchant
  const findPreviouslyCodedTransaction = (currentTransaction: Transaction) => {
    const currentMerchant = extractMerchantName(currentTransaction.description);
    return transactions.find(t => 
      t.id !== currentTransaction.id &&
      t.status !== 'uncoded' &&
      t.coding_type &&
      extractMerchantName(t.description) === currentMerchant
    );
  };

  // Copy coding from another transaction
  const copyFromTransaction = (fromTransaction: Transaction, toTransactionId: number) => {
    setSelectedCodingTypes(prev => ({...prev, [toTransactionId]: fromTransaction.coding_type || ''}));
    setInlineCoding(prev => ({
      ...prev,
      [toTransactionId]: {
        codingType: fromTransaction.coding_type || '',
        selectedCompany: fromTransaction.company_id || '',
        selectedGlAccount: fromTransaction.gl_account_id || '',
        selectedJob: fromTransaction.job_id || '',
        selectedJobPhase: fromTransaction.job_phase_id || '',
        selectedJobCostType: fromTransaction.job_cost_type_id || '',
        selectedEquipment: fromTransaction.equipment_id || '',
        selectedEquipmentCostCode: fromTransaction.equipment_cost_code_id || '',
        selectedEquipmentCostType: fromTransaction.equipment_cost_type_id || '',
        notes: fromTransaction.notes || ''
      }
    }));
  };

  // Split transaction functions
  const openSplitDialog = (transaction: Transaction) => {
    setSplitTransaction(transaction);
    // Initialize with 2 split lines by default
    setSplitLines([
      {
        id: 1,
        amount: transaction.amount / 2,
        percentage: 50,
        codingType: transaction.coding_type || '',
        selectedCompany: transaction.company_id || '',
        selectedGlAccount: transaction.gl_account_id || '',
        selectedJob: transaction.job_id || '',
        selectedJobPhase: transaction.job_phase_id || '',
        selectedJobCostType: transaction.job_cost_type_id || '',
        selectedEquipment: transaction.equipment_id || '',
        selectedEquipmentCostCode: transaction.equipment_cost_code_id || '',
        selectedEquipmentCostType: transaction.equipment_cost_type_id || '',
        notes: ''
      },
      {
        id: 2,
        amount: transaction.amount / 2,
        percentage: 50,
        codingType: '',
        selectedCompany: '',
        selectedGlAccount: '',
        selectedJob: '',
        selectedJobPhase: '',
        selectedJobCostType: '',
        selectedEquipment: '',
        selectedEquipmentCostCode: '',
        selectedEquipmentCostType: '',
        notes: ''
      }
    ]);
    setSplitDialogOpen(true);
  };

  const addSplitLine = () => {
    if (!splitTransaction) return;
    const newId = Math.max(...splitLines.map(l => l.id)) + 1;
    const remainingAmount = splitTransaction.amount - splitLines.reduce((sum, line) => sum + line.amount, 0);
    setSplitLines([...splitLines, {
      id: newId,
      amount: remainingAmount > 0 ? remainingAmount : 0,
      percentage: 0,
      codingType: '',
      selectedCompany: '',
      selectedGlAccount: '',
      selectedJob: '',
      selectedJobPhase: '',
      selectedJobCostType: '',
      selectedEquipment: '',
      selectedEquipmentCostCode: '',
      selectedEquipmentCostType: '',
      notes: ''
    }]);
  };

  const removeSplitLine = (id: number) => {
    if (splitLines.length <= 2) return; // Keep minimum 2 lines
    setSplitLines(splitLines.filter(line => line.id !== id));
  };

  const updateSplitLine = (id: number, field: string, value: any) => {
    setSplitLines(splitLines.map(line => {
      if (line.id === id) {
        const updatedLine = { ...line, [field]: value };
        
        // Update percentage if amount changed
        if (field === 'amount' && splitTransaction) {
          updatedLine.percentage = (value / splitTransaction.amount) * 100;
        }
        
        // Update amount if percentage changed
        if (field === 'percentage' && splitTransaction) {
          updatedLine.amount = (value / 100) * splitTransaction.amount;
        }
        
        // Reset GL account when company changes
        if (field === 'selectedCompany') {
          updatedLine.selectedGlAccount = '';
          // Load GL accounts for the selected company
          if (value) {
            loadGlAccounts(value as number);
          }
        }
        
        return updatedLine;
      }
      return line;
    }));
  };

  const handleSaveSplit = async () => {
    if (!splitTransaction) return;
    
    try {
      setLoading(true);
      
      // Validate that amounts sum to original amount
      const totalAmount = splitLines.reduce((sum, line) => sum + line.amount, 0);
      if (Math.abs(totalAmount - splitTransaction.amount) > 0.01) {
        setError(`Split amounts must equal original amount ($${splitTransaction.amount.toFixed(2)})`);
        return;
      }
      
      // Validate that all lines have coding
      const invalidLines = splitLines.filter(line => !line.codingType);
      if (invalidLines.length > 0) {
        setError('All split lines must have a coding type selected');
        return;
      }
      
      // TODO: Call API to save split transactions
      // For now, we'll just close the dialog
      setSuccess(`Transaction split into ${splitLines.length} parts`);
      setSplitDialogOpen(false);
      setSplitTransaction(null);
      setSplitLines([]);
      
      // Reload transactions
      await loadTransactions();
    } catch (err) {
      setError('Failed to split transaction');
    } finally {
      setLoading(false);
    }
  };

  // Track recently used items
  const trackRecentlyUsed = (type: string, id: number) => {
    const maxRecent = 5;
    switch (type) {
      case 'company':
        setRecentlyUsedCompanies(prev => [id, ...prev.filter(i => i !== id)].slice(0, maxRecent));
        break;
      case 'gl_account':
        setRecentlyUsedGlAccounts(prev => [id, ...prev.filter(i => i !== id)].slice(0, maxRecent));
        break;
      case 'job':
        setRecentlyUsedJobs(prev => [id, ...prev.filter(i => i !== id)].slice(0, maxRecent));
        break;
      case 'equipment':
        setRecentlyUsedEquipment(prev => [id, ...prev.filter(i => i !== id)].slice(0, maxRecent));
        break;
    }
  };

  // Sort items with recently used at the top
  const sortWithRecentlyUsed = <T extends { id: number }>(items: T[], recentIds: number[]): T[] => {
    const recentItems = recentIds
      .map(id => items.find(item => item.id === id))
      .filter(Boolean) as T[];
    const otherItems = items.filter(item => !recentIds.includes(item.id));
    return [...recentItems, ...otherItems];
  };

  // Handle select all event after sortedTransactions is available
  useEffect(() => {
    const handleSelectAll = () => {
      const visibleIds = sortedTransactions.map(t => t.id);
      setSelectedTransactions(visibleIds);
    };

    document.addEventListener('selectAllTransactions', handleSelectAll);
    return () => document.removeEventListener('selectAllTransactions', handleSelectAll);
  }, [sortedTransactions]);

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ mt: 0 }}>
          Code Transactions
        </Typography>
        <Tooltip title="Refresh data">
          <IconButton 
            onClick={() => {
              loadReferenceData();
              loadTransactions();
            }}
            color="primary"
            sx={{ ml: 2 }}
          >
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Locked Statement Warning */}
      {isStatementLocked && (
        <Alert 
          severity="warning" 
          icon={<Lock />}
          sx={{ 
            mb: 2,
            borderLeft: '4px solid',
            borderLeftColor: 'warning.main',
            backgroundColor: 'warning.lighter',
            '& .MuiAlert-icon': {
              color: 'warning.main'
            }
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              This statement is locked
            </Typography>
            <Typography variant="body2">
              {user?.role === 'admin' 
                ? 'You can view transactions but coding is disabled. To make changes, unlock the statement from the Statements page.'
                : 'This statement has been finalized. You can view transactions but cannot make any changes.'}
            </Typography>
            {currentStatement?.lock_reason && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                Reason: {currentStatement.lock_reason}
              </Typography>
            )}
          </Box>
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
          <Grid item xs={12} md={2}>
            <Autocomplete
              size="small"
              options={cardholders}
              getOptionLabel={(option) => option.full_name || ''}
              value={cardholders.find(c => c.id === selectedCardholder) || null}
              onChange={(_, newValue) => {
                console.log('Selected cardholder:', newValue);
                console.log('Setting cardholder ID:', newValue?.id);
                setSelectedCardholder(newValue?.id || '');
              }}
              renderInput={(params) => (
                <TextField {...params} label="Cardholder" placeholder="Type to search..." />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Typography>{option.full_name}</Typography>
                </Box>
              )}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Autocomplete
              size="small"
              options={statements}
              getOptionLabel={(option) => {
                const filename = option.pdf_filename || option.excel_filename || `${option.month}/${option.year}`;
                const displayName = filename.replace(/\.(pdf|xlsx?)$/i, '');
                return `${displayName}${option.is_locked ? ' (Locked)' : ''}`;
              }}
              value={statements.find(s => s.id === selectedStatement) || null}
              onChange={(_, newValue) => {
                setSelectedStatement(newValue?.id || '');
              }}
              renderInput={(params) => (
                <TextField {...params} label="Statement" placeholder="Select statement..." />
              )}
              renderOption={(props, option) => {
                const filename = option.pdf_filename || option.excel_filename || `${option.month}/${option.year}`;
                const displayName = filename.replace(/\.(pdf|xlsx?)$/i, '');
                return (
                  <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <span>{displayName}</span>
                      {option.is_locked && (
                        <Chip 
                          label="LOCKED" 
                          size="small" 
                          color="warning" 
                          icon={<Lock />}
                          sx={{ ml: 'auto' }}
                        />
                      )}
                    </Box>
                  </Box>
                );
              }}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
            />
          </Grid>

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              startIcon={<Clear />}
              onClick={() => {
                setSelectedCardholder('');
                setDateFrom(null);
                setDateTo(null);
                setStatusFilter('all');
                setSearchTerm('');
                // Don't clear statement selection
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

      {/* Progress Bar */}
      {totalCount > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Coding Progress: {codedCount} of {totalCount} transactions ({progressPercentage.toFixed(0)}%)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Uncoded: {totalCount - codedCount}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progressPercentage} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              backgroundColor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: progressPercentage === 100 ? 'success.main' : 'primary.main'
              }
            }} 
          />
        </Paper>
      )}

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
              disabled={isStatementLocked}
            >
              Batch Code
            </Button>
          </Box>
        </Paper>
      )}

      {/* Results count and help text */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {!loading && (
              <>
                <Typography variant="body2" color="text.secondary">
                  {totalStats.total_count > 0 
                    ? `${transactions.length} of ${totalStats.total_count} transactions`
                    : `${transactions.length} transactions`}
                </Typography>
                {transactions.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ 
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    pl: 2,
                    fontWeight: 500
                  }}>
                    Page total: ${sortedTransactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {totalStats.total_amount > 0 && ` of $${totalStats.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </Typography>
                )}
              </>
            )}
          </Box>
          
          {/* Top Pagination Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {transactions.length === 0 
                ? 'No transactions' 
                : transactions.length < rowsPerPage && page === 0
                  ? `Page 1 of 1`
                  : `Page ${page + 1}`}
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => setPage(page - 1)} 
              disabled={page === 0}
              sx={{ border: '1px solid rgba(0, 0, 0, 0.12)' }}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={() => setPage(page + 1)} 
              disabled={transactions.length === 0 || transactions.length < rowsPerPage}
              sx={{ border: '1px solid rgba(0, 0, 0, 0.12)' }}
            >
              <ChevronRight />
            </IconButton>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Click merchant name to highlight similar transactions • Select GL/Job/Equipment to start coding
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Shortcuts: Ctrl+S Save • Esc Cancel • 1/2/3 Quick type • Ctrl+A Select all
          </Typography>
        </Box>
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
                        disabled={isStatementLocked}
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
                  {sortedTransactions.map((transaction) => {
                    const isTransactionLocked = transaction.cardholder_statement?.statement?.is_locked || false;
                    return (
                    <TableRow
                      key={transaction.id}
                      hover
                      selected={selectedTransactions.includes(transaction.id)}
                      sx={{
                        backgroundColor: highlightedMerchant && extractMerchantName(transaction.description) === highlightedMerchant
                          ? 'action.hover'
                          : transaction.status === 'coded'
                          ? 'rgba(25, 118, 210, 0.04)'  // Light blue for coded
                          : transaction.status === 'reviewed'
                          ? 'rgba(76, 175, 80, 0.04)'   // Light green for reviewed
                          : transaction.status === 'rejected'
                          ? 'rgba(244, 67, 54, 0.04)'   // Light red for rejected
                          : 'inherit',
                        borderLeft: transaction.status === 'uncoded' 
                          ? '3px solid #ff9800'  // Orange border for uncoded
                          : transaction.status === 'coded'
                          ? '3px solid #1976d2'  // Blue border for coded
                          : transaction.status === 'reviewed'
                          ? '3px solid #4caf50'  // Green border for reviewed
                          : transaction.status === 'rejected'
                          ? '3px solid #f44336'  // Red border for rejected
                          : 'none'
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedTransactions.includes(transaction.id)}
                          onChange={() => handleSelectTransaction(transaction.id)}
                          disabled={isStatementLocked || isTransactionLocked}
                        />
                      </TableCell>
                      <TableCell>
                        {format(new Date(transaction.transaction_date), 'MM/dd/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {transaction.cardholder_statement?.cardholder?.full_name || 'Unknown'}
                          {isTransactionLocked && (
                            <Tooltip title="This transaction's statement is locked">
                              <Lock sx={{ fontSize: 16, color: 'warning.main' }} />
                            </Tooltip>
                          )}
                        </Box>
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
                                  const combined = [...prev, ...samemerchantTransactions];
                                  const uniqueIds = combined.filter((id, index) => combined.indexOf(id) === index);
                                  return uniqueIds;
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
                                if (newType && !isStatementLocked && !isTransactionLocked) {
                                  setSelectedCodingTypes(prev => ({...prev, [transaction.id]: newType}));
                                  
                                  // Find company 01 - Sukut Construction, LLC
                                  const defaultCompany = companies.find(c => c.code === '01' && c.name.includes('Sukut Construction'));
                                  
                                  setInlineCoding(prev => ({
                                    ...prev,
                                    [transaction.id]: {
                                      ...prev[transaction.id],
                                      codingType: newType,
                                      // Default to company 01 when Job is selected
                                      selectedCompany: newType === 'job' && defaultCompany ? defaultCompany.id : prev[transaction.id]?.selectedCompany || ''
                                    }
                                  }));
                                  
                                  // Load GL accounts if Job is selected and company is set
                                  if (newType === 'job' && defaultCompany) {
                                    loadGlAccounts(defaultCompany.id);
                                  }
                                }
                              }}
                              size="small"
                              disabled={isStatementLocked || isTransactionLocked}
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
                                {/* Company Selection for GL */}
                                <Autocomplete
                                  size="small"
                                  options={sortWithRecentlyUsed(companies, recentlyUsedCompanies)}
                                  getOptionLabel={(option) => `${option.code} - ${option.name}`}
                                  value={companies.find(c => c.id === inlineCoding[transaction.id]?.selectedCompany) || null}
                                  onChange={(e, newValue) => {
                                    const companyId = newValue?.id || '';
                                    setInlineCoding(prev => ({
                                      ...prev,
                                      [transaction.id]: {
                                        ...prev[transaction.id],
                                        selectedCompany: companyId,
                                        codingType: 'gl_account',
                                        selectedGlAccount: '' // Reset GL account when company changes
                                      }
                                    }));
                                    // Load GL accounts for the selected company
                                    if (companyId) {
                                      loadGlAccounts(companyId);
                                    }
                                  }}
                                  renderOption={(props, option) => (
                                    <li {...props}>
                                      {recentlyUsedCompanies.includes(option.id) && <span style={{ marginRight: 4 }}>★</span>}
                                      {option.code} - {option.name}
                                    </li>
                                  )}
                                  renderInput={(params) => (
                                    <TextField {...params} placeholder="Company" variant="outlined" />
                                  )}
                                  sx={{ minWidth: 200 }}
                                />
                                
                                {/* GL Account Selection - only show if company is selected */}
                                {inlineCoding[transaction.id]?.selectedCompany && (
                                  <Autocomplete
                                    size="small"
                                    options={sortWithRecentlyUsed(
                                      glAccounts.filter(gl => gl.company_id === inlineCoding[transaction.id]?.selectedCompany),
                                      recentlyUsedGlAccounts
                                    )}
                                    getOptionLabel={(option) => `${option.account_code} - ${option.description}`}
                                    value={glAccounts.find(gl => gl.id === inlineCoding[transaction.id]?.selectedGlAccount) || null}
                                    onChange={(e, newValue) => {
                                      setInlineCoding(prev => ({
                                        ...prev,
                                        [transaction.id]: {
                                          ...prev[transaction.id],
                                          selectedGlAccount: newValue?.id || ''
                                        }
                                      }));
                                    }}
                                    renderOption={(props, option) => (
                                      <li {...props}>
                                        {recentlyUsedGlAccounts.includes(option.id) && <span style={{ marginRight: 4 }}>★</span>}
                                        {option.account_code} - {option.description}
                                      </li>
                                    )}
                                    renderInput={(params) => (
                                      <TextField {...params} placeholder="GL Account" variant="outlined" />
                                    )}
                                    sx={{ minWidth: 250 }}
                                  />
                                )}
                              </>
                            )}
                            
                            {selectedCodingTypes[transaction.id] === 'job' && (
                              <>
                                {/* Company Selection for Job */}
                                <Autocomplete
                                  size="small"
                                  options={sortWithRecentlyUsed(companies, recentlyUsedCompanies)}
                                  getOptionLabel={(option) => `${option.code} - ${option.name}`}
                                  value={companies.find(c => c.id === inlineCoding[transaction.id]?.selectedCompany) || null}
                                  onChange={(e, newValue) => {
                                    setInlineCoding(prev => ({
                                      ...prev,
                                      [transaction.id]: {
                                        ...prev[transaction.id],
                                        selectedCompany: newValue?.id || '',
                                        selectedGlAccount: '' // Reset GL account when company changes
                                      }
                                    }));
                                    if (newValue?.id) {
                                      loadGlAccounts(newValue.id);
                                    }
                                  }}
                                  renderOption={(props, option) => (
                                    <li {...props}>
                                      {recentlyUsedCompanies.includes(option.id) && <span style={{ marginRight: 4 }}>★</span>}
                                      {option.code} - {option.name}
                                    </li>
                                  )}
                                  renderInput={(params) => (
                                    <TextField {...params} placeholder="Company" variant="outlined" />
                                  )}
                                  sx={{ minWidth: 200 }}
                                />
                                
                                {/* Job Selection */}
                                <Autocomplete
                                  size="small"
                                  options={sortWithRecentlyUsed(jobs, recentlyUsedJobs)}
                                  getOptionLabel={(option) => `${option.job_number} - ${option.name}`}
                                  value={jobs.find(j => j.id === inlineCoding[transaction.id]?.selectedJob) || null}
                                  onChange={(e, newValue) => {
                                    const jobId = newValue?.id || '';
                                    setInlineCoding(prev => ({
                                      ...prev,
                                      [transaction.id]: {
                                        ...prev[transaction.id],
                                        selectedJob: jobId,
                                        selectedJobPhase: '' // Reset phase when job changes
                                      }
                                    }));
                                    // Load phases for the selected job
                                    if (jobId) {
                                      loadJobPhases(jobId);
                                    }
                                  }}
                                  renderOption={(props, option) => (
                                    <li {...props}>
                                      {recentlyUsedJobs.includes(option.id) && <span style={{ marginRight: 4 }}>★</span>}
                                      {option.job_number} - {option.name}
                                    </li>
                                  )}
                                  renderInput={(params) => (
                                    <TextField {...params} placeholder="Select Job" variant="outlined" />
                                  )}
                                  sx={{ minWidth: 180 }}
                                />
                                
                                {/* Phase Selection - only show if job is selected */}
                                {inlineCoding[transaction.id]?.selectedJob && (
                                  <Autocomplete
                                    size="small"
                                    options={jobPhases}
                                    getOptionLabel={(option) => `${option.phase_number} - ${option.description}`}
                                    value={jobPhases.find(p => p.id === inlineCoding[transaction.id]?.selectedJobPhase) || null}
                                    onChange={(e, newValue) => {
                                      setInlineCoding(prev => ({
                                        ...prev,
                                        [transaction.id]: {
                                          ...prev[transaction.id],
                                          selectedJobPhase: newValue?.id || ''
                                        }
                                      }));
                                    }}
                                    renderInput={(params) => (
                                      <TextField {...params} placeholder="Select Phase" variant="outlined" />
                                    )}
                                    sx={{ minWidth: 150 }}
                                  />
                                )}
                              </>
                            )}
                            
                            {selectedCodingTypes[transaction.id] === 'equipment' && (
                              <>
                                <Autocomplete
                                  size="small"
                                  options={sortWithRecentlyUsed(equipment.length > 0 ? equipment : [
                                    { id: 1, equipment_number: 'EQ001', description: 'CAT 320 Excavator' },
                                    { id: 2, equipment_number: 'EQ002', description: 'D6 Dozer' },
                                    { id: 3, equipment_number: 'EQ003', description: 'Water Truck 4000' },
                                    { id: 4, equipment_number: 'EQ004', description: 'Loader 950H' },
                                    { id: 5, equipment_number: 'EQ005', description: 'Compactor CS56' },
                                  ], recentlyUsedEquipment)}
                                  getOptionLabel={(option) => `${option.equipment_number} - ${option.description}`}
                                  value={equipment.find(eq => eq.id === inlineCoding[transaction.id]?.selectedEquipment) || null}
                                  onChange={(e, newValue) => {
                                    setInlineCoding(prev => ({
                                      ...prev,
                                      [transaction.id]: {
                                        ...prev[transaction.id],
                                        selectedEquipment: newValue?.id || '',
                                        selectedEquipmentCostCode: '', // Reset cost code when equipment changes
                                        selectedEquipmentCostType: '' // Reset cost type when equipment changes
                                      }
                                    }));
                                  }}
                                  renderOption={(props, option) => (
                                    <li {...props}>
                                      {recentlyUsedEquipment.includes(option.id) && <span style={{ marginRight: 4 }}>★</span>}
                                      {option.equipment_number} - {option.description}
                                    </li>
                                  )}
                                  renderInput={(params) => (
                                    <TextField {...params} placeholder="Select Equipment" variant="outlined" />
                                  )}
                                  sx={{ minWidth: 250 }}
                                />
                                
                                {/* Cost Code Selection - only show if equipment is selected */}
                                {inlineCoding[transaction.id]?.selectedEquipment && (
                                  <>
                                    <Autocomplete
                                      size="small"
                                      options={equipmentCostCodes.length > 0 ? equipmentCostCodes : [
                                        { id: 1, code: 'FUEL', description: 'Fuel & Lubricants' },
                                        { id: 2, code: 'MAINT', description: 'Maintenance & Repairs' },
                                        { id: 3, code: 'OPER', description: 'Operation' },
                                        { id: 4, code: 'RENT', description: 'Rental' },
                                        { id: 5, code: 'TRANS', description: 'Transportation' },
                                      ]}
                                      getOptionLabel={(option) => `${option.code} - ${option.description}`}
                                      value={equipmentCostCodes.find(cc => cc.id === inlineCoding[transaction.id]?.selectedEquipmentCostCode) || null}
                                      onChange={(e, newValue) => {
                                        setInlineCoding(prev => ({
                                          ...prev,
                                          [transaction.id]: {
                                            ...prev[transaction.id],
                                            selectedEquipmentCostCode: newValue?.id || ''
                                          }
                                        }));
                                      }}
                                      renderInput={(params) => (
                                        <TextField {...params} placeholder="Cost Code" variant="outlined" />
                                      )}
                                      sx={{ minWidth: 200 }}
                                    />
                                    
                                    <Autocomplete
                                      size="small"
                                      options={equipmentCostTypes.length > 0 ? equipmentCostTypes : [
                                        { id: 1, code: 'LAB', description: 'Labor' },
                                        { id: 2, code: 'MAT', description: 'Materials' },
                                        { id: 3, code: 'SUB', description: 'Subcontractor' },
                                        { id: 4, code: 'EQUIP', description: 'Equipment' },
                                        { id: 5, code: 'OTHER', description: 'Other' },
                                      ]}
                                      getOptionLabel={(option) => `${option.code} - ${option.description}`}
                                      value={equipmentCostTypes.find(ct => ct.id === inlineCoding[transaction.id]?.selectedEquipmentCostType) || null}
                                      onChange={(e, newValue) => {
                                        setInlineCoding(prev => ({
                                          ...prev,
                                          [transaction.id]: {
                                            ...prev[transaction.id],
                                            selectedEquipmentCostType: newValue?.id || ''
                                          }
                                        }));
                                      }}
                                      renderInput={(params) => (
                                        <TextField {...params} placeholder="Cost Type" variant="outlined" />
                                      )}
                                      sx={{ minWidth: 180 }}
                                    />
                                  </>
                                )}
                              </>
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
                             (selectedCodingTypes[transaction.id] === 'equipment' && inlineCoding[transaction.id]?.selectedEquipment && 
                              inlineCoding[transaction.id]?.selectedEquipmentCostCode && inlineCoding[transaction.id]?.selectedEquipmentCostType))) ? (
                            <>
                              <Tooltip title={isStatementLocked || isTransactionLocked ? "Statement is locked" : "Save"}>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleSaveInlineCoding(transaction.id)}
                                  disabled={isStatementLocked || isTransactionLocked || (
                                    (selectedCodingTypes[transaction.id] === 'gl_account' && (!inlineCoding[transaction.id]?.selectedCompany || !inlineCoding[transaction.id]?.selectedGlAccount)) ||
                                    (selectedCodingTypes[transaction.id] === 'job' && !inlineCoding[transaction.id]?.selectedJob) ||
                                    (selectedCodingTypes[transaction.id] === 'equipment' && (!inlineCoding[transaction.id]?.selectedEquipment || 
                                      !inlineCoding[transaction.id]?.selectedEquipmentCostCode || !inlineCoding[transaction.id]?.selectedEquipmentCostType))
                                  )}
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
                                      setSelectedCodingTypes(prev => ({...prev, [transaction.id]: transaction.coding_type || ''}));
                                      setInlineCoding(prev => ({
                                        ...prev,
                                        [transaction.id]: {
                                          codingType: transaction.coding_type || '',
                                          selectedCompany: transaction.company_id || '',
                                          selectedGlAccount: transaction.gl_account_id || '',
                                          selectedJob: transaction.job_id || '',
                                          selectedJobPhase: transaction.job_phase_id || '',
                                          selectedJobCostType: transaction.job_cost_type_id || '',
                                          selectedEquipment: transaction.equipment_id || '',
                                          selectedEquipmentCostCode: transaction.equipment_cost_code_id || '',
                                          selectedEquipmentCostType: transaction.equipment_cost_type_id || '',
                                          notes: transaction.notes || ''
                                        }
                                      }));
                                    }}
                                  >
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                              {/* Copy from previous button */}
                              {!transaction.coding_type && (() => {
                                const previouslyCoded = findPreviouslyCodedTransaction(transaction);
                                return previouslyCoded ? (
                                  <Tooltip title={`Copy coding from previous ${extractMerchantName(transaction.description)} transaction`}>
                                    <IconButton
                                      size="small"
                                      color="info"
                                      onClick={() => {
                                        copyFromTransaction(previouslyCoded, transaction.id);
                                        setInlineEditingId(transaction.id);
                                      }}
                                    >
                                      <ContentCopy />
                                    </IconButton>
                                  </Tooltip>
                                ) : null;
                              })()}
                              <Tooltip title={isStatementLocked || isTransactionLocked ? "Statement is locked" : "Split transaction into multiple lines"}>
                                <IconButton
                                  size="small"
                                  color="secondary"
                                  onClick={() => openSplitDialog(transaction)}
                                  disabled={isStatementLocked || isTransactionLocked}
                                >
                                  <CallSplit />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {sortedTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Box>
                          <Typography color="text.secondary" gutterBottom>
                            {searchTerm 
                              ? `No transactions found matching "${searchTerm}"`
                              : selectedCardholder
                                ? 'No transactions found for this cardholder'
                                : 'No transactions found'}
                          </Typography>
                          {selectedCardholder && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              Please ensure statements have been uploaded for this cardholder.
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={transactions.length === 0 ? 0 : (transactions.length < rowsPerPage ? transactions.length : -1)}
              page={page}
              onPageChange={(_, newPage) => {
                // Don't allow navigating to next page if current page has fewer items than rowsPerPage
                if (transactions.length < rowsPerPage && newPage > page) {
                  return;
                }
                setPage(newPage);
              }}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              // Disable next button when there are no transactions or fewer than rowsPerPage
              nextIconButtonProps={{
                disabled: transactions.length === 0 || transactions.length < rowsPerPage
              }}
              labelDisplayedRows={({ from, to, count }) => {
                if (transactions.length === 0) {
                  return 'No transactions';
                }
                // If we have fewer items than rowsPerPage, we're on the last page
                if (transactions.length < rowsPerPage) {
                  const start = page * rowsPerPage + 1;
                  const end = start + transactions.length - 1;
                  return `${start}-${end} of ${end}`;
                }
                // Otherwise show the standard "of more than" text
                return `${from}-${to} of more than ${to}`;
              }}
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

      {/* Split Transaction Dialog */}
      <Dialog open={splitDialogOpen} onClose={() => setSplitDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Split Transaction
          {splitTransaction && (
            <Typography variant="body2" color="text.secondary">
              Original Amount: ${splitTransaction.amount.toFixed(2)} | {splitTransaction.description}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Even split helper */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>
                    Quick Even Split
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Split transaction evenly across multiple lines
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    type="number"
                    label="Number of Lines"
                    defaultValue={2}
                    inputProps={{ min: 2, max: 20 }}
                    size="small"
                    fullWidth
                    id="even-split-lines"
                  />
                </Grid>
                <Grid item xs={12} md={5}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      const numLines = parseInt((document.getElementById('even-split-lines') as HTMLInputElement)?.value || '2');
                      if (splitTransaction && numLines >= 2 && numLines <= 20) {
                        const evenAmount = splitTransaction.amount / numLines;
                        const evenPercentage = 100 / numLines;
                        
                        const newLines = Array.from({ length: numLines }, (_, index) => ({
                          id: index + 1,
                          amount: evenAmount,
                          percentage: evenPercentage,
                          codingType: index === 0 && splitTransaction.coding_type ? splitTransaction.coding_type : '',
                          selectedCompany: index === 0 ? (splitTransaction.company_id || '') : '',
                          selectedGlAccount: index === 0 ? (splitTransaction.gl_account_id || '') : '',
                          selectedJob: index === 0 ? (splitTransaction.job_id || '') : '',
                          selectedJobPhase: index === 0 ? (splitTransaction.job_phase_id || '') : '',
                          selectedJobCostType: index === 0 ? (splitTransaction.job_cost_type_id || '') : '',
                          selectedEquipment: index === 0 ? (splitTransaction.equipment_id || '') : '',
                          selectedEquipmentCostCode: index === 0 ? (splitTransaction.equipment_cost_code_id || '') : '',
                          selectedEquipmentCostType: index === 0 ? (splitTransaction.equipment_cost_type_id || '') : '',
                          notes: ''
                        }));
                        
                        setSplitLines(newLines);
                      }
                    }}
                  >
                    Apply Even Split
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ ml: 1 }}
                    onClick={() => {
                      if (splitTransaction) {
                        // Copy coding from first line to all other lines
                        const firstLine = splitLines[0];
                        if (firstLine) {
                          setSplitLines(splitLines.map(line => ({
                            ...line,
                            codingType: firstLine.codingType,
                            selectedCompany: firstLine.selectedCompany,
                            selectedGlAccount: firstLine.selectedGlAccount,
                            selectedJob: firstLine.selectedJob,
                            selectedJobPhase: firstLine.selectedJobPhase,
                            selectedJobCostType: firstLine.selectedJobCostType,
                            selectedEquipment: firstLine.selectedEquipment,
                            selectedEquipmentCostCode: firstLine.selectedEquipmentCostCode,
                            selectedEquipmentCostType: firstLine.selectedEquipmentCostType,
                          })));
                        }
                      }
                    }}
                  >
                    Copy Coding to All
                  </Button>
                </Grid>
              </Grid>
            </Box>
            
            {/* Split lines */}
            {splitLines.map((line, index) => (
              <Box key={line.id} sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Line {index + 1}
                      {splitLines.length > 2 && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeSplitLine(line.id)}
                          sx={{ ml: 1 }}
                        >
                          <Remove />
                        </IconButton>
                      )}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Amount"
                      value={line.amount}
                      onChange={(e) => updateSplitLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                      InputProps={{
                        startAdornment: '$',
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Percentage"
                      value={line.percentage.toFixed(2)}
                      onChange={(e) => updateSplitLine(line.id, 'percentage', parseFloat(e.target.value) || 0)}
                      InputProps={{
                        endAdornment: '%',
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={7}>
                    <ToggleButtonGroup
                      value={line.codingType}
                      exclusive
                      onChange={(e, newType) => updateSplitLine(line.id, 'codingType', newType)}
                      size="small"
                    >
                      <ToggleButton value="gl_account">
                        <Business sx={{ fontSize: 16, mr: 0.5 }} />
                        GL Account
                      </ToggleButton>
                      <ToggleButton value="job">
                        <Work sx={{ fontSize: 16, mr: 0.5 }} />
                        Job
                      </ToggleButton>
                      <ToggleButton value="equipment">
                        <Build sx={{ fontSize: 16, mr: 0.5 }} />
                        Equipment
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>
                  
                  {/* Coding fields based on type */}
                  {line.codingType === 'gl_account' && (
                    <>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Company</InputLabel>
                          <Select
                            value={line.selectedCompany}
                            onChange={(e) => updateSplitLine(line.id, 'selectedCompany', e.target.value)}
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
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>GL Account</InputLabel>
                          <Select
                            value={line.selectedGlAccount}
                            onChange={(e) => updateSplitLine(line.id, 'selectedGlAccount', e.target.value)}
                            label="GL Account"
                          >
                            <MenuItem value="">Select GL Account</MenuItem>
                            {glAccounts
                              .filter(account => account.company_id === line.selectedCompany)
                              .map((account) => (
                                <MenuItem key={account.id} value={account.id}>
                                  {account.account_code} - {account.description}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}
                  
                  {line.codingType === 'job' && (
                    <>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Job</InputLabel>
                          <Select
                            value={line.selectedJob}
                            onChange={(e) => updateSplitLine(line.id, 'selectedJob', e.target.value)}
                            label="Job"
                          >
                            <MenuItem value="">Select Job</MenuItem>
                            {jobs.map((job) => (
                              <MenuItem key={job.id} value={job.id}>
                                {job.job_number} - {job.description}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Phase</InputLabel>
                          <Select
                            value={line.selectedJobPhase}
                            onChange={(e) => updateSplitLine(line.id, 'selectedJobPhase', e.target.value)}
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
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Cost Type</InputLabel>
                          <Select
                            value={line.selectedJobCostType}
                            onChange={(e) => updateSplitLine(line.id, 'selectedJobCostType', e.target.value)}
                            label="Cost Type"
                          >
                            <MenuItem value="">Select Cost Type</MenuItem>
                            {jobCostTypes.map((type) => (
                              <MenuItem key={type.id} value={type.id}>
                                {type.cost_type_code} - {type.description}
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
                      value={line.notes}
                      onChange={(e) => updateSplitLine(line.id, 'notes', e.target.value)}
                      multiline
                      rows={1}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
            
            {/* Add line button */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                startIcon={<Add />}
                onClick={addSplitLine}
                variant="outlined"
              >
                Add Split Line
              </Button>
              
              {splitTransaction && (
                <Typography
                  variant="body2"
                  color={Math.abs(splitLines.reduce((sum, line) => sum + line.amount, 0) - splitTransaction.amount) > 0.01 ? 'error' : 'success.main'}
                >
                  Total: ${splitLines.reduce((sum, line) => sum + line.amount, 0).toFixed(2)} / ${splitTransaction.amount.toFixed(2)}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSplitDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveSplit}
            variant="contained"
            color="primary"
            disabled={loading || (splitTransaction && Math.abs(splitLines.reduce((sum, line) => sum + line.amount, 0) - splitTransaction.amount) > 0.01) || false}
          >
            Save Split
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