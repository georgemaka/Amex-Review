import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface Statement {
  id: number;
  month: number;
  year: number;
  closing_date: string;
  pdf_filename: string;
  excel_filename: string;
  status: 'pending' | 'processing' | 'split' | 'distributed' | 'in_progress' | 'completed' | 'error';
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_error?: string;
  created_at: string;
}

export interface StatementProgress {
  statement_id: number;
  status: string;
  total_cardholders: number;
  processed_cardholders: number;
  total_transactions: number;
  coded_transactions: number;
  progress_percentage: number;
  cardholder_progress: Array<{
    cardholder_id: number;
    cardholder_name: string;
    total_transactions: number;
    coded_transactions: number;
    reviewed_transactions: number;
    rejected_transactions: number;
    progress_percentage: number;
  }>;
}

interface StatementState {
  statements: Statement[];
  currentStatement: Statement | null;
  currentProgress: StatementProgress | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: StatementState = {
  statements: [],
  currentStatement: null,
  currentProgress: null,
  isLoading: false,
  error: null,
};

export const fetchStatements = createAsyncThunk(
  'statements/fetchStatements',
  async ({ skip = 0, limit = 20 }: { skip?: number; limit?: number }) => {
    const response = await api.getStatements(skip, limit);
    return response;
  }
);

export const fetchStatement = createAsyncThunk(
  'statements/fetchStatement',
  async (id: number) => {
    const response = await api.getStatement(id);
    return response;
  }
);

export const fetchStatementProgress = createAsyncThunk(
  'statements/fetchStatementProgress',
  async (id: number) => {
    const response = await api.getStatementProgress(id);
    return response;
  }
);

export const uploadStatement = createAsyncThunk(
  'statements/uploadStatement',
  async (formData: FormData) => {
    const response = await api.uploadStatement(formData);
    return response;
  }
);

export const sendStatementEmails = createAsyncThunk(
  'statements/sendStatementEmails',
  async (id: number) => {
    const response = await api.sendStatementEmails(id);
    return response;
  }
);

const statementSlice = createSlice({
  name: 'statements',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateStatementStatus: (state, action) => {
      const { id, status } = action.payload;
      const statement = state.statements.find(s => s.id === id);
      if (statement) {
        statement.status = status;
      }
      if (state.currentStatement?.id === id && state.currentStatement) {
        state.currentStatement.status = status;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch statements
      .addCase(fetchStatements.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchStatements.fulfilled, (state, action) => {
        state.isLoading = false;
        state.statements = action.payload;
      })
      .addCase(fetchStatements.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch statements';
      })
      // Fetch single statement
      .addCase(fetchStatement.fulfilled, (state, action) => {
        state.currentStatement = action.payload;
      })
      // Fetch progress
      .addCase(fetchStatementProgress.fulfilled, (state, action) => {
        state.currentProgress = action.payload;
      })
      // Upload statement
      .addCase(uploadStatement.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(uploadStatement.fulfilled, (state, action) => {
        state.isLoading = false;
        state.statements.unshift(action.payload);
      })
      .addCase(uploadStatement.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to upload statement';
      });
  },
});

export const { clearError, updateStatementStatus } = statementSlice.actions;
export default statementSlice.reducer;