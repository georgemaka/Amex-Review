import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface BudgetLimit {
  id: number;
  cardholder_id?: number;
  category_id?: number;
  month?: number;
  year?: number;
  limit_amount: number;
  alert_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BudgetCreate {
  cardholder_id?: number;
  category_id?: number;
  month?: number;
  year?: number;
  limit_amount: number;
  alert_threshold?: number;
  is_active?: boolean;
}

interface BudgetState {
  budgets: BudgetLimit[];
  loading: boolean;
  error: string | null;
}

const initialState: BudgetState = {
  budgets: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchBudgets = createAsyncThunk(
  'budgets/fetchBudgets',
  async (params?: { cardholder_id?: number; category_id?: number; is_active?: boolean }) => {
    const response = await api.getBudgetLimits(params);
    return response;
  }
);

export const createBudget = createAsyncThunk(
  'budgets/createBudget',
  async (budget: BudgetCreate) => {
    const response = await api.createBudgetLimit(budget);
    return response;
  }
);

export const updateBudget = createAsyncThunk(
  'budgets/updateBudget',
  async ({ id, budget }: { id: number; budget: BudgetCreate }) => {
    const response = await api.updateBudgetLimit(id, budget);
    return response;
  }
);

export const deleteBudget = createAsyncThunk(
  'budgets/deleteBudget',
  async (id: number) => {
    await api.deleteBudgetLimit(id);
    return id;
  }
);

const budgetSlice = createSlice({
  name: 'budgets',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch budgets
    builder
      .addCase(fetchBudgets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBudgets.fulfilled, (state, action) => {
        state.loading = false;
        state.budgets = action.payload;
      })
      .addCase(fetchBudgets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch budgets';
      });

    // Create budget
    builder
      .addCase(createBudget.fulfilled, (state, action) => {
        state.budgets.push(action.payload);
      })
      .addCase(createBudget.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create budget';
      });

    // Update budget
    builder
      .addCase(updateBudget.fulfilled, (state, action) => {
        const index = state.budgets.findIndex(b => b.id === action.payload.id);
        if (index !== -1) {
          state.budgets[index] = action.payload;
        }
      })
      .addCase(updateBudget.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update budget';
      });

    // Delete budget
    builder
      .addCase(deleteBudget.fulfilled, (state, action) => {
        state.budgets = state.budgets.filter(b => b.id !== action.payload);
      })
      .addCase(deleteBudget.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to delete budget';
      });
  },
});

export const { clearError } = budgetSlice.actions;
export default budgetSlice.reducer;