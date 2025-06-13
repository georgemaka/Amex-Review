import React, { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import { 
  CloudUpload, 
  Close, 
  Description, 
  InsertDriveFile 
} from '@mui/icons-material';
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
        p: 2,
        textAlign: 'center',
        backgroundColor: isDragging ? 'action.hover' : 'background.paper',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minHeight: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover',
        },
      }}
    >
      <input
        type="file"
        id={`modal-file-input-${fileType}`}
        hidden
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
      <label htmlFor={`modal-file-input-${fileType}`} style={{ cursor: 'pointer', width: '100%' }}>
        {file ? (
          <Box>
            {fileType === 'PDF' ? (
              <Description sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
            ) : (
              <InsertDriveFile sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
            )}
            <Typography variant="body2" fontWeight="medium">
              {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
          </Box>
        ) : (
          <Box>
            <CloudUpload sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }} />
            <Typography variant="body2" gutterBottom>
              Drop {fileType} here or click
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {accept}
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

interface StatementUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const StatementUploadModal: React.FC<StatementUploadModalProps> = ({ 
  open, 
  onClose,
  onSuccess 
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const handleSubmit = async (values: FormValues, { resetForm }: any) => {
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
      
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload statement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={isSubmitting ? undefined : onClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Upload Statement</Typography>
          <IconButton
            onClick={onClose}
            disabled={isSubmitting}
            size="small"
          >
            <Close />
          </IconButton>
        </DialogTitle>
        
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
              <DialogContent dividers>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      select
                      name="month"
                      label="Month"
                      value={values.month}
                      onChange={(e) => setFieldValue('month', e.target.value)}
                      error={touched.month && Boolean(errors.month)}
                      helperText={touched.month && errors.month}
                      size="small"
                    >
                      {[...Array(12)].map((_, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                          {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={4}>
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
                      size="small"
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <DatePicker
                      label="Closing Date"
                      value={values.closingDate}
                      onChange={(date) => setFieldValue('closingDate', date)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          error: touched.closingDate && Boolean(errors.closingDate),
                          helperText: touched.closingDate && errors.closingDate?.toString(),
                        },
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                      PDF Statement File
                    </Typography>
                    <FileDropZone
                      file={values.pdfFile}
                      accept=".pdf"
                      onFileSelect={(file) => setFieldValue('pdfFile', file)}
                      error={touched.pdfFile && errors.pdfFile ? String(errors.pdfFile) : undefined}
                      fileType="PDF"
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                      Excel Statement File
                    </Typography>
                    <FileDropZone
                      file={values.excelFile}
                      accept=".xlsx,.xls"
                      onFileSelect={(file) => setFieldValue('excelFile', file)}
                      error={touched.excelFile && errors.excelFile ? String(errors.excelFile) : undefined}
                      fileType="Excel"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Alert severity="info" variant="outlined">
                      <Typography variant="caption">
                        <strong>Note:</strong> You can upload multiple statements for the same month/year as long as they have different filenames.
                        The system will process and split them by cardholder automatically.
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </DialogContent>

              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button
                  onClick={onClose}
                  disabled={isSubmitting}
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
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </LocalizationProvider>
  );
};

export default StatementUploadModal;