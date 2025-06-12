import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ApiService {
  private api: AxiosInstance;
  private tokenGetter?: () => string | null;
  private onUnauthorized?: () => void;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.tokenGetter?.();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.onUnauthorized?.();
        }
        return Promise.reject(error);
      }
    );
  }

  // Method to set auth handlers
  setAuthHandlers(tokenGetter: () => string | null, onUnauthorized: () => void) {
    this.tokenGetter = tokenGetter;
    this.onUnauthorized = onUnauthorized;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await this.api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async refreshToken() {
    const response = await this.api.post('/auth/refresh');
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  // User endpoints
  async getUsers(skip = 0, limit = 100) {
    const response = await this.api.get('/users', { params: { skip, limit } });
    return response.data;
  }

  async createUser(userData: any) {
    const response = await this.api.post('/users', userData);
    return response.data;
  }

  async updateUser(userId: number, userData: any) {
    const response = await this.api.put(`/users/${userId}`, userData);
    return response.data;
  }

  async deleteUser(userId: number) {
    const response = await this.api.delete(`/users/${userId}`);
    return response.data;
  }

  // Statement endpoints
  async uploadStatement(data: FormData) {
    const response = await this.api.post('/statements/upload', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getStatements(skip = 0, limit = 20) {
    const response = await this.api.get('/statements', { params: { skip, limit } });
    return response.data;
  }

  async getStatement(id: number) {
    const response = await this.api.get(`/statements/${id}`);
    return response.data;
  }

  async getStatementProgress(id: number) {
    const response = await this.api.get(`/statements/${id}/progress`);
    return response.data;
  }

  async sendStatementEmails(id: number) {
    const response = await this.api.post(`/statements/${id}/send-emails`);
    return response.data;
  }

  async deleteStatement(id: number) {
    const response = await this.api.delete(`/statements/${id}`);
    return response.data;
  }

  // Transaction endpoints
  async getTransactions(params?: {
    cardholder_statement_id?: number;
    status?: string;
    skip?: number;
    limit?: number;
  }) {
    const response = await this.api.get('/transactions', { params });
    return response.data;
  }

  async getTransaction(id: number) {
    const response = await this.api.get(`/transactions/${id}`);
    return response.data;
  }

  async codeTransaction(id: number, codingData: any) {
    const response = await this.api.put(`/transactions/${id}/code`, codingData);
    return response.data;
  }

  async reviewTransaction(id: number, approved: boolean, rejectionReason?: string) {
    const response = await this.api.put(`/transactions/${id}/review`, {
      approved,
      rejection_reason: rejectionReason,
    });
    return response.data;
  }

  async bulkCodeTransactions(transactionIds: number[], codingData: any) {
    const response = await this.api.post('/transactions/bulk-code', {
      transaction_ids: transactionIds,
      ...codingData,
    });
    return response.data;
  }

  async exportTransactionsCSV(cardholderStatementIds: number[], includeUncoded = false) {
    const response = await this.api.post(
      '/transactions/export-csv',
      {
        cardholder_statement_ids: cardholderStatementIds,
        include_uncoded: includeUncoded,
      },
      { responseType: 'blob' }
    );
    return response.data;
  }

  // Cardholder endpoints
  async getCardholders(params?: {
    is_active?: boolean;
    search?: string;
    skip?: number;
    limit?: number;
  }) {
    const response = await this.api.get('/cardholders', { params });
    return response.data;
  }

  async getCardholder(id: number) {
    const response = await this.api.get(`/cardholders/${id}`);
    return response.data;
  }

  async createCardholder(data: any) {
    const response = await this.api.post('/cardholders', data);
    return response.data;
  }

  async updateCardholder(id: number, data: any) {
    const response = await this.api.put(`/cardholders/${id}`, data);
    return response.data;
  }

  async deleteCardholder(id: number) {
    const response = await this.api.delete(`/cardholders/${id}`);
    return response.data;
  }

  async getCardholderAssignments(cardholderId: number) {
    const response = await this.api.get(`/cardholders/${cardholderId}/assignments`);
    return response.data;
  }

  // Analytics endpoints
  async getAnalyticsDashboard(params?: {
    month?: number;
    year?: number;
    cardholder_id?: number;
  }) {
    const response = await this.api.get('/analytics/dashboard', { params });
    return response.data;
  }

  async getSpendingByCategory(params?: {
    month?: number;
    year?: number;
    cardholder_id?: number;
  }) {
    const response = await this.api.get('/analytics/spending-by-category', { params });
    return response.data;
  }

  async getSpendingByMerchant(params?: {
    month?: number;
    year?: number;
    cardholder_id?: number;
    category_id?: number;
    limit?: number;
  }) {
    const response = await this.api.get('/analytics/spending-by-merchant', { params });
    return response.data;
  }

  async getSpendingTrends(params?: {
    cardholder_id?: number;
    category_id?: number;
    months?: number;
  }) {
    const response = await this.api.get('/analytics/spending-trends', { params });
    return response.data;
  }

  async getSpendingByCardholder(params?: {
    month?: number;
    year?: number;
  }) {
    const response = await this.api.get('/analytics/spending-by-cardholder', { params });
    return response.data;
  }

  async getSpendingAlerts(params?: {
    cardholder_id?: number;
    is_resolved?: boolean;
    severity?: string;
    limit?: number;
  }) {
    const response = await this.api.get('/analytics/alerts', { params });
    return response.data;
  }

  async resolveSpendingAlert(alertId: number) {
    const response = await this.api.put(`/analytics/alerts/${alertId}/resolve`);
    return response.data;
  }

  async getSpendingCategories(is_active = true) {
    const response = await this.api.get('/analytics/categories', { params: { is_active } });
    return response.data;
  }

  // Budget endpoints
  async getBudgetLimits(params?: {
    cardholder_id?: number;
    category_id?: number;
    is_active?: boolean;
  }) {
    const response = await this.api.get('/analytics/budgets', { params });
    return response.data;
  }

  async createBudgetLimit(data: any) {
    const response = await this.api.post('/analytics/budgets', data);
    return response.data;
  }

  async updateBudgetLimit(id: number, data: any) {
    const response = await this.api.put(`/analytics/budgets/${id}`, data);
    return response.data;
  }

  async deleteBudgetLimit(id: number) {
    const response = await this.api.delete(`/analytics/budgets/${id}`);
    return response.data;
  }

  async createCardholderAssignment(cardholderId: number, data: any) {
    const response = await this.api.post(`/cardholders/${cardholderId}/assignments`, data);
    return response.data;
  }

  async getCardholderReviewers(cardholderId: number) {
    const response = await this.api.get(`/cardholders/${cardholderId}/reviewers`);
    return response.data;
  }

  async createCardholderReviewer(cardholderId: number, data: any) {
    const response = await this.api.post(`/cardholders/${cardholderId}/reviewers`, data);
    return response.data;
  }

  async importCardholders(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post('/cardholders/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

}

export default new ApiService();