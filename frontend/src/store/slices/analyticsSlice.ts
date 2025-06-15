import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface CategorySpending {
  category_id: number;
  category_name: string;
  category_color: string;
  total_amount: number;
  transaction_count: number;
  percentage: number;
}

export interface MerchantSpending {
  merchant_name: string;
  total_amount: number;
  transaction_count: number;
  average_amount: number;
  category_name?: string;
}

export interface SpendingTrend {
  date: string;
  amount: number;
  transaction_count: number;
}

export interface CardholderSpending {
  cardholder_id: number;
  cardholder_name: string;
  total_amount: number;
  transaction_count: number;
  top_category?: string;
  trend: 'up' | 'down' | 'stable';
}

export interface SpendingAlert {
  id: number;
  alert_type: string;
  severity: string;
  cardholder_id?: number;
  category_id?: number;
  transaction_id?: number;
  amount?: number;
  threshold?: number;
  description: string;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

export interface AnalyticsDashboard {
  total_spending: number;
  total_transactions: number;
  average_transaction: number;
  top_categories: CategorySpending[];
  top_merchants: MerchantSpending[];
  spending_trend: SpendingTrend[];
  recent_alerts: SpendingAlert[];
  period_comparison: {
    current_total: number;
    previous_total: number;
    change_amount: number;
    change_percent: number;
  };
}

interface AnalyticsState {
  dashboard: AnalyticsDashboard | null;
  categorySpending: CategorySpending[];
  merchantSpending: MerchantSpending[];
  spendingTrends: SpendingTrend[];
  cardholderSpending: CardholderSpending[];
  alerts: SpendingAlert[];
  loading: boolean;
  error: string | null;
  filters: {
    month?: number;
    year?: number;
    date_from?: string;
    date_to?: string;
    cardholder_id?: number;
    category_id?: number;
    statement_id?: number;
  };
}

const initialState: AnalyticsState = {
  dashboard: null,
  categorySpending: [],
  merchantSpending: [],
  spendingTrends: [],
  cardholderSpending: [],
  alerts: [],
  loading: false,
  error: null,
  filters: {},
};

// Async thunks
export const fetchAnalyticsDashboard = createAsyncThunk(
  'analytics/fetchDashboard',
  async (params: { month?: number; year?: number; date_from?: string; date_to?: string; cardholder_id?: number; category_id?: number; statement_id?: number }) => {
    const response = await api.getAnalyticsDashboard(params);
    return response;
  }
);

export const fetchCategorySpending = createAsyncThunk(
  'analytics/fetchCategorySpending',
  async (params: { month?: number; year?: number; cardholder_id?: number; statement_id?: number }) => {
    const response = await api.getSpendingByCategory(params);
    return response;
  }
);

export const fetchMerchantSpending = createAsyncThunk(
  'analytics/fetchMerchantSpending',
  async (params: { month?: number; year?: number; cardholder_id?: number; category_id?: number; statement_id?: number; limit?: number }) => {
    const response = await api.getSpendingByMerchant(params);
    return response;
  }
);

export const fetchSpendingTrends = createAsyncThunk(
  'analytics/fetchSpendingTrends',
  async (params: { cardholder_id?: number; category_id?: number; statement_id?: number; months?: number }) => {
    const response = await api.getSpendingTrends(params);
    return response;
  }
);

export const fetchCardholderSpending = createAsyncThunk(
  'analytics/fetchCardholderSpending',
  async (params: { month?: number; year?: number; statement_id?: number }) => {
    const response = await api.getSpendingByCardholder(params);
    return response;
  }
);

export const fetchAlerts = createAsyncThunk(
  'analytics/fetchAlerts',
  async (params: { cardholder_id?: number; is_resolved?: boolean; severity?: string; limit?: number }) => {
    const response = await api.getSpendingAlerts(params);
    return response;
  }
);

export const resolveAlert = createAsyncThunk(
  'analytics/resolveAlert',
  async (alertId: number) => {
    await api.resolveSpendingAlert(alertId);
    return alertId;
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<AnalyticsState['filters']>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Dashboard
    builder
      .addCase(fetchAnalyticsDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchAnalyticsDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch analytics dashboard';
      });

    // Category Spending
    builder
      .addCase(fetchCategorySpending.fulfilled, (state, action) => {
        state.categorySpending = action.payload;
      });

    // Merchant Spending
    builder
      .addCase(fetchMerchantSpending.fulfilled, (state, action) => {
        state.merchantSpending = action.payload;
      });

    // Spending Trends
    builder
      .addCase(fetchSpendingTrends.fulfilled, (state, action) => {
        state.spendingTrends = action.payload;
      });

    // Cardholder Spending
    builder
      .addCase(fetchCardholderSpending.fulfilled, (state, action) => {
        state.cardholderSpending = action.payload;
      });

    // Alerts
    builder
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.alerts = action.payload;
      })
      .addCase(resolveAlert.fulfilled, (state, action) => {
        const alertIndex = state.alerts.findIndex(a => a.id === action.payload);
        if (alertIndex !== -1) {
          state.alerts[alertIndex].is_resolved = true;
          state.alerts[alertIndex].resolved_at = new Date().toISOString();
        }
        // Also update dashboard alerts if present
        if (state.dashboard) {
          const dashboardAlertIndex = state.dashboard.recent_alerts.findIndex(a => a.id === action.payload);
          if (dashboardAlertIndex !== -1) {
            state.dashboard.recent_alerts.splice(dashboardAlertIndex, 1);
          }
        }
      });
  },
});

export const { setFilters, clearFilters, clearError } = analyticsSlice.actions;
export default analyticsSlice.reducer;