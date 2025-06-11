import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface Cardholder {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  employee_id?: string;
  department?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CardholderAssignment {
  id: number;
  cardholder_id: number;
  coder_id: number;
  cc_emails: string[];
  is_active: boolean;
  created_at: string;
  cardholder?: Cardholder;
  coder?: any;
}

interface CardholderState {
  cardholders: Cardholder[];
  currentCardholder: Cardholder | null;
  currentAssignments: CardholderAssignment[];
  isLoading: boolean;
  error: string | null;
}

const initialState: CardholderState = {
  cardholders: [],
  currentCardholder: null,
  currentAssignments: [],
  isLoading: false,
  error: null,
};

export const fetchCardholders = createAsyncThunk(
  'cardholders/fetchCardholders',
  async (params?: {
    is_active?: boolean;
    search?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await api.getCardholders(params);
    return response;
  }
);

export const fetchCardholder = createAsyncThunk(
  'cardholders/fetchCardholder',
  async (id: number) => {
    const response = await api.getCardholder(id);
    return response;
  }
);

export const createCardholder = createAsyncThunk(
  'cardholders/createCardholder',
  async (data: any) => {
    const response = await api.createCardholder(data);
    return response;
  }
);

export const updateCardholder = createAsyncThunk(
  'cardholders/updateCardholder',
  async ({ id, data }: { id: number; data: any }) => {
    const response = await api.updateCardholder(id, data);
    return response;
  }
);

export const deleteCardholder = createAsyncThunk(
  'cardholders/deleteCardholder',
  async (id: number) => {
    await api.deleteCardholder(id);
    return id;
  }
);

export const fetchCardholderAssignments = createAsyncThunk(
  'cardholders/fetchCardholderAssignments',
  async (cardholderId: number) => {
    const response = await api.getCardholderAssignments(cardholderId);
    return response;
  }
);

export const importCardholders = createAsyncThunk(
  'cardholders/importCardholders',
  async (file: File) => {
    const response = await api.importCardholders(file);
    return response;
  }
);

const cardholderSlice = createSlice({
  name: 'cardholders',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch cardholders
      .addCase(fetchCardholders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCardholders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cardholders = action.payload;
      })
      .addCase(fetchCardholders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch cardholders';
      })
      // Fetch single cardholder
      .addCase(fetchCardholder.fulfilled, (state, action) => {
        state.currentCardholder = action.payload;
      })
      // Create cardholder
      .addCase(createCardholder.fulfilled, (state, action) => {
        state.cardholders.push(action.payload);
      })
      // Update cardholder
      .addCase(updateCardholder.fulfilled, (state, action) => {
        const index = state.cardholders.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.cardholders[index] = action.payload;
        }
        if (state.currentCardholder?.id === action.payload.id) {
          state.currentCardholder = action.payload;
        }
      })
      // Delete cardholder
      .addCase(deleteCardholder.fulfilled, (state, action) => {
        state.cardholders = state.cardholders.filter(c => c.id !== action.payload);
      })
      // Fetch assignments
      .addCase(fetchCardholderAssignments.fulfilled, (state, action) => {
        state.currentAssignments = action.payload;
      });
  },
});

export const { clearError } = cardholderSlice.actions;
export default cardholderSlice.reducer;