import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { CloudUpload, Cancel } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AppDispatch } from '../../store';
import { uploadStatement } from '../../store/slices/statementSlice';
import { addNotification } from '../../store/slices/uiSlice';

const validationSchema = Yup.object({
  month: Yup.number()
    .min(1, 'Invalid month')
    .max(12, 'Invalid month')
    .required('Month is required'),
  year: Yup.number()
    .min(2020, 'Year must be 2020 or later')
    .max(new Date().getFullYear(), 'Year cannot be in the future')
    .required('Year is required'),
  closingDate: Yup.date()
    .required('Closing date is required'),
  pdfFile: Yup.mixed()
    .required('PDF file is required'),
  excelFile: Yup.mixed()
    .required('Excel file is required'),
});

interface FormValues {
  month: number;
  year: number;
  closingDate: Date | null;
  pdfFile: File | null;
  excelFile: File | null;
}

const StatementUpload: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('month', values.month.toString());
      formData.append('year', values.year.toString());
      formData.append('closing_date', values.closingDate!.toISOString());
      formData.append('pdf_file', values.pdfFile!);
      formData.append('excel_file', values.excelFile!);

      await dispatch(uploadStatement(formData)).unwrap();
      
      dispatch(addNotification({
        type: 'success',
        message: 'Statement uploaded successfully. Processing will begin shortly.',
      }));
      
      navigate('/statements');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload statement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Upload Statement
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Upload American Express PDF and Excel statement files for processing
        </Typography>

        <Paper sx={{ p: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Formik<FormValues>
            initialValues={{
              month: currentMonth,
              year: currentYear,
              closingDate: null,
              pdfFile: null,
              excelFile: null,
            }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, errors, touched, setFieldValue }) => (
              <Form>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Month</InputLabel>
                      <Select
                        name="month"
                        value={values.month}
                        onChange={(e) => setFieldValue('month', e.target.value)}
                        error={touched.month && Boolean(errors.month)}
                      >
                        {[...Array(12)].map((_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>
                            {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="year"
                      label="Year"
                      type="number"
                      value={values.year}
                      onChange={(e) => setFieldValue('year', parseInt(e.target.value))}
                      error={touched.year && Boolean(errors.year)}
                      helperText={touched.year && errors.year}
                      inputProps={{ min: 2020, max: currentYear }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <DatePicker
                      label="Closing Date"
                      value={values.closingDate}
                      onChange={(date) => setFieldValue('closingDate', date)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: touched.closingDate && Boolean(errors.closingDate),
                          helperText: touched.closingDate && errors.closingDate?.toString(),
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        PDF Statement File
                      </Typography>
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        startIcon={<CloudUpload />}
                        sx={{ py: 2 }}
                      >
                        {values.pdfFile ? values.pdfFile.name : 'Choose PDF File'}
                        <input
                          type="file"
                          hidden
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setFieldValue('pdfFile', file);
                          }}
                        />
                      </Button>
                      {touched.pdfFile && errors.pdfFile && (
                        <Typography color="error" variant="caption">
                          {errors.pdfFile}
                        </Typography>
                      )}
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Excel Statement File
                      </Typography>
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        startIcon={<CloudUpload />}
                        sx={{ py: 2 }}
                      >
                        {values.excelFile ? values.excelFile.name : 'Choose Excel File'}
                        <input
                          type="file"
                          hidden
                          accept=".xlsx,.xls"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setFieldValue('excelFile', file);
                          }}
                        />
                      </Button>
                      {touched.excelFile && errors.excelFile && (
                        <Typography color="error" variant="caption">
                          {errors.excelFile}
                        </Typography>
                      )}
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        onClick={() => navigate('/statements')}
                        startIcon={<Cancel />}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={isSubmitting}
                        startIcon={isSubmitting ? <CircularProgress size={20} /> : <CloudUpload />}
                      >
                        {isSubmitting ? 'Uploading...' : 'Upload Statement'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default StatementUpload;