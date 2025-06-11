import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface Transaction {
  id: number;
  cardholder_statement_id: number;
  transaction_date: string;
  posting_date: string;
  description: string;
  amount: number;
  merchant_name?: string;
  gl_account?: string;
  job_code?: string;
  phase?: string;
  cost_type?: string;
  notes?: string;
  status: 'uncoded' | 'coded' | 'reviewed' | 'rejected' | 'exported';
  coded_at?: string;
  coded_by?: any;
  reviewed_at?: string;
  reviewed_by?: any;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
}

interface TransactionState {
  transactions: Transaction[];
  currentTransaction: Transaction | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    cardholder_statement_id?: number;
    status?: string;
  };
}

const initialState: TransactionState = {
  transactions: [],
  currentTransaction: null,
  isLoading: false,
  error: null,
  filters: {},
};

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (params?: {
    cardholder_statement_id?: number;
    status?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await api.getTransactions(params);
    return response;
  }
);

export const fetchTransaction = createAsyncThunk(
  'transactions/fetchTransaction',
  async (id: number) => {
    const response = await api.getTransaction(id);
    return response;
  }
);

export const codeTransaction = createAsyncThunk(
  'transactions/codeTransaction',
  async ({ id, codingData }: { id: number; codingData: any }) => {
    const response = await api.codeTransaction(id, codingData);
    return response;
  }
);

export const reviewTransaction = createAsyncThunk(
  'transactions/reviewTransaction',
  async ({ id, approved, rejectionReason }: { 
    id: number; 
    approved: boolean; 
    rejectionReason?: string 
  }) => {
    const response = await api.reviewTransaction(id, approved, rejectionReason);
    return { id, approved, rejectionReason };
  }
);

export const bulkCodeTransactions = createAsyncThunk(
  'transactions/bulkCodeTransactions',
  async ({ transactionIds, codingData }: { 
    transactionIds: number[]; 
    codingData: any 
  }) => {
    const response = await api.bulkCodeTransactions(transactionIds, codingData);
    return { transactionIds, codingData };
  }
);

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch transactions';
      })
      // Fetch single transaction
      .addCase(fetchTransaction.fulfilled, (state, action) => {
        state.currentTransaction = action.payload;
      })
      // Code transaction
      .addCase(codeTransaction.fulfilled, (state, action) => {
        const index = state.transactions.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.transactions[index] = action.payload;
        }
        if (state.currentTransaction?.id === action.payload.id) {
          state.currentTransaction = action.payload;
        }
      })
      // Review transaction
      .addCase(reviewTransaction.fulfilled, (state, action) => {
        const transaction = state.transactions.find(t => t.id === action.payload.id);
        if (transaction) {
          transaction.status = action.payload.approved ? 'reviewed' : 'rejected';
          if (!action.payload.approved) {
            transaction.rejection_reason = action.payload.rejectionReason;
          }
        }
      })
      // Bulk code transactions
      .addCase(bulkCodeTransactions.fulfilled, (state, action) => {
        const { transactionIds, codingData } = action.payload;
        state.transactions.forEach(transaction => {
          if (transactionIds.includes(transaction.id)) {
            Object.assign(transaction, codingData);
            transaction.status = 'coded';
          }
        });
      });
  },
});

export const { clearError, setFilters, clearFilters } = transactionSlice.actions;
export default transactionSlice.reducer;