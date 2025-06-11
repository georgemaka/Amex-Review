import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  Chip,
  Divider,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Save,
  NavigateBefore,
  NavigateNext,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { AppDispatch } from '../../store';
import { codeTransaction } from '../../store/slices/transactionSlice';
import { addNotification } from '../../store/slices/uiSlice';
import { Transaction } from '../../store/slices/transactionSlice';

interface TransactionCodingFormProps {
  transaction: Transaction;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  currentIndex: number;
  totalCount: number;
}

const validationSchema = Yup.object({
  gl_account: Yup.string()
    .matches(/^\d{4}$/, 'GL Account must be 4 digits')
    .required('GL Account is required'),
  job_code: Yup.string()
    .max(50, 'Job Code must be 50 characters or less'),
  phase: Yup.string()
    .max(20, 'Phase must be 20 characters or less'),
  cost_type: Yup.string()
    .max(20, 'Cost Type must be 20 characters or less'),
  notes: Yup.string()
    .max(500, 'Notes must be 500 characters or less'),
});

const TransactionCodingForm: React.FC<TransactionCodingFormProps> = ({
  transaction,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  currentIndex,
  totalCount,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uncoded':
        return 'default';
      case 'coded':
        return 'primary';
      case 'reviewed':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleSubmit = async (values: any) => {
    setIsSubmitting(true);
    try {
      await dispatch(codeTransaction({
        id: transaction.id,
        codingData: values,
      })).unwrap();
      
      dispatch(addNotification({
        type: 'success',
        message: 'Transaction coded successfully',
      }));

      // Auto-advance to next transaction if available
      if (hasNext) {
        setTimeout(onNext, 500);
      }
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        message: 'Failed to code transaction',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">
            Transaction {currentIndex} of {totalCount}
          </Typography>
          <Chip
            label={transaction.status.toUpperCase()}
            color={getStatusColor(transaction.status)}
            size="small"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={onPrev}
            disabled={!hasPrev}
          >
            <NavigateBefore />
          </IconButton>
          <IconButton
            size="small"
            onClick={onNext}
            disabled={!hasNext}
          >
            <NavigateNext />
          </IconButton>
        </Box>
      </Box>

      {/* Transaction Details */}
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Transaction Date
            </Typography>
            <Typography variant="body2">
              {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Amount
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              ${transaction.amount.toFixed(2)}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Merchant
            </Typography>
            <Typography variant="body2">
              {transaction.merchant_name || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Description
            </Typography>
            <Typography variant="body2">
              {transaction.description}
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Divider />

      {/* Coding Form */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {transaction.status === 'rejected' && transaction.rejection_reason && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Rejection Reason:</Typography>
            {transaction.rejection_reason}
          </Alert>
        )}

        <Formik
          key={transaction.id} // Reset form when transaction changes
          initialValues={{
            gl_account: transaction.gl_account || '',
            job_code: transaction.job_code || '',
            phase: transaction.phase || '',
            cost_type: transaction.cost_type || '',
            notes: transaction.notes || '',
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ values, errors, touched, handleChange, handleBlur, isValid }) => (
            <Form>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="gl_account"
                    label="GL Account *"
                    value={values.gl_account}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.gl_account && Boolean(errors.gl_account)}
                    helperText={touched.gl_account && errors.gl_account}
                    placeholder="1234"
                    inputProps={{ maxLength: 4 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="job_code"
                    label="Job Code"
                    value={values.job_code}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.job_code && Boolean(errors.job_code)}
                    helperText={touched.job_code && errors.job_code}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="phase"
                    label="Phase"
                    value={values.phase}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.phase && Boolean(errors.phase)}
                    helperText={touched.phase && errors.phase}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="cost_type"
                    label="Cost Type"
                    value={values.cost_type}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.cost_type && Boolean(errors.cost_type)}
                    helperText={touched.cost_type && errors.cost_type}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    name="notes"
                    label="Notes"
                    value={values.notes}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.notes && Boolean(errors.notes)}
                    helperText={touched.notes && errors.notes}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!isValid || isSubmitting || transaction.status !== 'uncoded'}
                  startIcon={<Save />}
                >
                  Save & Continue
                </Button>
                {transaction.status === 'coded' && (
                  <Chip
                    icon={<CheckCircle />}
                    label="Already Coded"
                    color="success"
                  />
                )}
              </Box>
            </Form>
          )}
        </Formik>
      </Box>
    </Paper>
  );
};

export default TransactionCodingForm;