import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailState {
  templates: EmailTemplate[];
  loading: boolean;
  error: string | null;
}

const initialState: EmailState = {
  templates: [],
  loading: false,
  error: null
};

export const fetchEmailTemplates = createAsyncThunk(
  'emails/fetchTemplates',
  async () => {
    const response = await api.get('/api/v1/emails/templates');
    return response;
  }
);

export const createEmailTemplate = createAsyncThunk(
  'emails/createTemplate',
  async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    const response = await api.post('/api/v1/emails/templates', template);
    return response;
  }
);

export const updateEmailTemplate = createAsyncThunk(
  'emails/updateTemplate',
  async ({ id, template }: { id: number; template: Partial<EmailTemplate> }) => {
    const response = await api.put(`/api/v1/emails/templates/${id}`, template);
    return response;
  }
);

export const deleteEmailTemplate = createAsyncThunk(
  'emails/deleteTemplate',
  async (id: number) => {
    await api.delete(`/api/v1/emails/templates/${id}`);
    return id;
  }
);

const emailSlice = createSlice({
  name: 'emails',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch templates
      .addCase(fetchEmailTemplates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmailTemplates.fulfilled, (state, action) => {
        state.loading = false;
        state.templates = action.payload;
      })
      .addCase(fetchEmailTemplates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch templates';
      })
      // Create template
      .addCase(createEmailTemplate.fulfilled, (state, action) => {
        state.templates.push(action.payload);
      })
      // Update template
      .addCase(updateEmailTemplate.fulfilled, (state, action) => {
        const index = state.templates.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.templates[index] = action.payload;
        }
      })
      // Delete template
      .addCase(deleteEmailTemplate.fulfilled, (state, action) => {
        state.templates = state.templates.filter(t => t.id !== action.payload);
      });
  }
});

export default emailSlice.reducer;