import React, { useState, useCallback } from 'react';
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
  MenuItem,
} from '@mui/material';
import { CloudUpload, Cancel, Description, InsertDriveFile } from '@mui/icons-material';
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

interface FileDropZoneProps {
  file: File | null;
  accept: string;
  onFileSelect: (file: File) => void;
  error?: string;
  fileType: 'PDF' | 'Excel';
}

const FileDropZone: React.FC<FileDropZoneProps> = ({ file, accept, onFileSelect, error, fileType }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const acceptedExtensions = accept.split(',').map(ext => ext.trim());
    
    const validFile = files.find(file => {
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      return acceptedExtensions.includes(fileExtension);
    });

    if (validFile) {
      onFileSelect(validFile);
    }
  }, [accept, onFileSelect]);

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        border: 2,
        borderStyle: 'dashed',
        borderColor: isDragging ? 'primary.main' : error ? 'error.main' : 'divider',
        borderRadius: 1,
        p: 3,
        textAlign: 'center',
        backgroundColor: isDragging ? 'action.hover' : 'background.paper',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover',
        },
      }}
    >
      <input
        type="file"
        id={`file-input-${fileType}`}
        hidden
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
      <label htmlFor={`file-input-${fileType}`} style={{ cursor: 'pointer' }}>
        {file ? (
          <Box>
            {fileType === 'PDF' ? (
              <Description sx={{ fontSize: 48, color: 'error.main', mb: 1 }} />
            ) : (
              <InsertDriveFile sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            )}
            <Typography variant="body1" fontWeight="medium">
              {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
          </Box>
        ) : (
          <Box>
            <CloudUpload sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              Drag and drop your {fileType} file here
            </Typography>
            <Typography variant="caption" color="text.secondary">
              or click to browse
            </Typography>
          </Box>
        )}
      </label>
      {error && (
        <Typography color="error" variant="caption" display="block" mt={1}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

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
                    <TextField
                      fullWidth
                      select
                      name="month"
                      label="Month"
                      value={values.month}
                      onChange={(e) => setFieldValue('month', e.target.value)}
                      error={touched.month && Boolean(errors.month)}
                      helperText={touched.month && errors.month}
                    >
                      {[...Array(12)].map((_, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                          {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </TextField>
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
                      <FileDropZone
                        file={values.pdfFile}
                        accept=".pdf"
                        onFileSelect={(file) => setFieldValue('pdfFile', file)}
                        error={touched.pdfFile && errors.pdfFile ? String(errors.pdfFile) : undefined}
                        fileType="PDF"
                      />
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Excel Statement File
                      </Typography>
                      <FileDropZone
                        file={values.excelFile}
                        accept=".xlsx,.xls"
                        onFileSelect={(file) => setFieldValue('excelFile', file)}
                        error={touched.excelFile && errors.excelFile ? String(errors.excelFile) : undefined}
                        fileType="Excel"
                      />
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