import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import statementReducer from './slices/statementSlice';
import transactionReducer from './slices/transactionSlice';
import cardholderReducer from './slices/cardholderSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    statements: statementReducer,
    transactions: transactionReducer,
    cardholders: cardholderReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;