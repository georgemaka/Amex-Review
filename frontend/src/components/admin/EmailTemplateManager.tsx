import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import axios from 'axios';

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

interface EmailTemplateForm {
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  is_active: boolean;
}

const EmailTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState<EmailTemplateForm>({
    name: '',
    subject: '',
    body: '',
    category: 'coding',
    variables: [],
    is_active: true,
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('/api/v1/email-client/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch templates',
        severity: 'error',
      });
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
        variables: template.variables,
        is_active: template.is_active,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        subject: '',
        body: '',
        category: 'coding',
        variables: [],
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleSave = async () => {
    try {
      if (editingTemplate) {
        await axios.put(`/api/v1/email-client/templates/${editingTemplate.id}`, formData);
        setSnackbar({
          open: true,
          message: 'Template updated successfully',
          severity: 'success',
        });
      } else {
        await axios.post('/api/v1/email-client/templates', formData);
        setSnackbar({
          open: true,
          message: 'Template created successfully',
          severity: 'success',
        });
      }
      handleCloseDialog();
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save template',
        severity: 'error',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await axios.delete(`/api/v1/email-client/templates/${id}`);
        setSnackbar({
          open: true,
          message: 'Template deleted successfully',
          severity: 'success',
        });
        fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
        setSnackbar({
          open: true,
          message: 'Failed to delete template',
          severity: 'error',
        });
      }
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map(match => match.slice(2, -2))));
  };

  const handleBodyChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      body: value,
      variables: Array.from(new Set([
        ...extractVariables(prev.subject),
        ...extractVariables(value)
      ])),
    }));
  };

  const handleSubjectChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      subject: value,
      variables: Array.from(new Set([
        ...extractVariables(value),
        ...extractVariables(prev.body)
      ])),
    }));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Email Templates</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Template
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Variables</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>{template.name}</TableCell>
                <TableCell>
                  <Chip
                    label={template.category}
                    size="small"
                    color={template.category === 'coding' ? 'primary' : 'secondary'}
                  />
                </TableCell>
                <TableCell>{template.subject}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {template.variables.map((variable) => (
                      <Chip
                        key={variable}
                        label={`{{${variable}}}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={template.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    color={template.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(template)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(template.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Template Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                label="Category"
              >
                <MenuItem value="coding">Coding</MenuItem>
                <MenuItem value="review">Review</MenuItem>
                <MenuItem value="general">General</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Subject"
              value={formData.subject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              fullWidth
              required
              helperText="Use {{variable}} for dynamic content"
            />

            <TextField
              label="Body"
              value={formData.body}
              onChange={(e) => handleBodyChange(e.target.value)}
              fullWidth
              multiline
              rows={8}
              required
              helperText="Use {{variable}} for dynamic content. HTML is supported."
            />

            {formData.variables.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Detected Variables:
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {formData.variables.map((variable) => (
                    <Chip
                      key={variable}
                      label={`{{${variable}}}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmailTemplateManager;