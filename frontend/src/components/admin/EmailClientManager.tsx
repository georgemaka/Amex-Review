import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Send,
  ContentCopy,
  Download,
  Group,
  Person,
  Refresh,
  OpenInNew,
  Email,
} from '@mui/icons-material';
import api from '../../services/api';

interface Statement {
  id: number;
  month: number;
  year: number;
  status: string;
  cardholder_count: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  is_active: boolean;
}

const EmailClientManager: React.FC = () => {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [recipientLists, setRecipientLists] = useState<any>({});
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Email form state
  const [recipientType, setRecipientType] = useState('all_coders');
  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [specificEmails, setSpecificEmails] = useState('');
  
  // Template dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const statementsRes = await api.getStatements();
      setStatements(statementsRes);
      
      // Get recipient lists
      const listsRes = await api.get('/email-client/recipient-lists');
      setRecipientLists(listsRes);
      
      // Get email templates
      const templatesRes = await api.get('/email-client/templates');
      setTemplates(templatesRes);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInEmailClient = async () => {
    try {
      setError(null);
      setSuccess(null);

      const payload = {
        recipient_type: recipientType,
        statement_id: selectedStatement,
        subject,
        body,
        specific_recipients: recipientType === 'specific' 
          ? specificEmails.split(',').map(e => e.trim()).filter(e => e)
          : undefined
      };

      const result = await api.post('/email-client/prepare-email', payload);
      
      // Open mailto link
      if (result.mailto_link) {
        window.open(result.mailto_link, '_blank');
      }
      
      setSuccess(`Email prepared for ${result.total_recipients} recipients. Check your email client.`);
      
      // Store the full recipient list for copying
      if (result.recipients.length > 10) {
        navigator.clipboard.writeText(result.recipients.join('; '));
        setSuccess(s => s + ' Full recipient list copied to clipboard.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to prepare email');
    }
  };

  const handleDownloadEml = async () => {
    try {
      setError(null);
      
      const payload = {
        recipient_type: recipientType,
        statement_id: selectedStatement,
        subject,
        body,
        specific_recipients: recipientType === 'specific' 
          ? specificEmails.split(',').map(e => e.trim()).filter(e => e)
          : undefined
      };

      const result = await api.post('/email-client/generate-eml', payload);
      
      // Create download link
      const byteCharacters = atob(result.content_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.content_type });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess(`Email draft downloaded for ${result.recipients_count} recipients.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate email file');
    }
  };

  const handleCopyRecipients = (listType: string) => {
    const recipients = recipientLists[listType] || [];
    navigator.clipboard.writeText(recipients.join('; '));
    setSuccess(`Copied ${recipients.length} email addresses to clipboard`);
  };

  const handleUseTemplate = async () => {
    if (!selectedTemplate) return;
    
    const statement = statements.find(s => s.id === selectedStatement);
    if (!statement) return;

    try {
      // Prepare variables for template replacement
      const monthName = new Date(statement.year, statement.month - 1).toLocaleString('default', { month: 'long' });
      const variables = {
        month: monthName,
        year: statement.year.toString(),
        cardholder_count: statement.cardholder_count.toString()
      };
      
      // Preview template with variables
      const result = await api.post(`/email-client/templates/${selectedTemplate.id}/preview`, variables);
      
      setSubject(result.subject);
      setBody(result.body);
      setTemplateDialogOpen(false);
      setSuccess('Template loaded successfully');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load template');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        This tool helps you prepare emails in your default email client. Emails will be sent from your 
        personal email address on behalf of GL@sukut.com. For best results, add "on behalf of GL@sukut.com" 
        to your email signature or subject line.
      </Alert>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Compose Email" />
          <Tab label="Recipient Lists" />
          <Tab label="Instructions" />
        </Tabs>
        
        <TabPanel value={tabValue} index={0}>
          <Stack spacing={3}>
            {/* Recipient Selection */}
            <Stack direction="row" spacing={2}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Recipient Type</InputLabel>
                <Select
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value)}
                  label="Recipient Type"
                >
                  <MenuItem value="all_coders">All Coders</MenuItem>
                  <MenuItem value="all_reviewers">All Reviewers</MenuItem>
                  <MenuItem value="assigned_coders">Assigned Coders (Statement)</MenuItem>
                  <MenuItem value="assigned_reviewers">Assigned Reviewers (Statement)</MenuItem>
                  <MenuItem value="specific">Specific Recipients</MenuItem>
                </Select>
              </FormControl>
              
              {(recipientType === 'assigned_coders' || recipientType === 'assigned_reviewers') && (
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Statement</InputLabel>
                  <Select
                    value={selectedStatement || ''}
                    onChange={(e) => setSelectedStatement(Number(e.target.value))}
                    label="Statement"
                    required
                  >
                    {statements.map((stmt) => (
                      <MenuItem key={stmt.id} value={stmt.id}>
                        {new Date(stmt.year, stmt.month - 1).toLocaleString('default', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
            
            {recipientType === 'specific' && (
              <TextField
                fullWidth
                label="Email Addresses (comma-separated)"
                value={specificEmails}
                onChange={(e) => setSpecificEmails(e.target.value)}
                placeholder="user1@sukut.com, user2@sukut.com"
                helperText="Enter email addresses separated by commas"
              />
            )}
            
            {/* Email Content */}
            <TextField
              fullWidth
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
            
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Email Body (HTML supported)
                </Typography>
                <Button
                  size="small"
                  onClick={() => setTemplateDialogOpen(true)}
                  disabled={!selectedStatement && (recipientType === 'assigned_coders' || recipientType === 'assigned_reviewers')}
                >
                  Use Template
                </Button>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter email body (HTML tags supported)"
              />
            </Box>
            
            <Divider />
            
            {/* Actions */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={() => {
                  setSubject('');
                  setBody('');
                  setSpecificEmails('');
                }}
              >
                Clear
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadEml}
                disabled={!subject || !body}
              >
                Download .eml File
              </Button>
              <Button
                variant="contained"
                startIcon={<OpenInNew />}
                onClick={handleOpenInEmailClient}
                disabled={!subject || !body}
              >
                Open in Email Client
              </Button>
            </Stack>
          </Stack>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Quick Copy Recipient Lists
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click any list to copy all email addresses to your clipboard.
          </Typography>
          
          <List>
            {Object.entries(recipientLists).map(([listType, emails]: [string, any]) => (
              <ListItem key={listType}>
                <ListItemText
                  primary={listType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  secondary={`${emails.length} recipients`}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Copy to clipboard">
                    <IconButton onClick={() => handleCopyRecipients(listType)}>
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            How to Use This Tool
          </Typography>
          
          <Stack spacing={2}>
            <Alert severity="info">
              <strong>Important:</strong> Emails will be sent from your personal email address, not from GL@sukut.com.
            </Alert>
            
            <Typography variant="subtitle1" fontWeight="bold">
              Method 1: Open in Email Client
            </Typography>
            <Typography variant="body2">
              1. Compose your email using the form<br />
              2. Click "Open in Email Client"<br />
              3. Your default email program will open with the email pre-filled<br />
              4. Add any attachments if needed<br />
              5. Review and send the email
            </Typography>
            
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
              Method 2: Download .eml File
            </Typography>
            <Typography variant="body2">
              1. Compose your email using the form<br />
              2. Click "Download .eml File"<br />
              3. Open the downloaded file with Outlook or your email client<br />
              4. The email will open as a draft<br />
              5. Add attachments and send
            </Typography>
            
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
              Method 3: Copy Recipients
            </Typography>
            <Typography variant="body2">
              1. Go to the "Recipient Lists" tab<br />
              2. Click on any list to copy all email addresses<br />
              3. Paste into your email client's "To" field<br />
              4. Compose and send your email manually
            </Typography>
            
            <Alert severity="warning" sx={{ mt: 2 }}>
              <strong>Best Practice:</strong> Include "On behalf of GL@sukut.com" in your subject line or signature 
              to indicate you're sending on behalf of the GL team.
            </Alert>
          </Stack>
        </TabPanel>
      </Paper>
      
      {/* Success/Error Messages */}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)}>
        <DialogTitle>Select Email Template</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Template</InputLabel>
            <Select
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const template = templates.find(t => t.id === Number(e.target.value));
                setSelectedTemplate(template || null);
              }}
              label="Select Template"
            >
              {templates.filter(t => t.is_active).map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name} ({template.category})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {selectedTemplate && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Template Preview:
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Subject:</strong> {selectedTemplate.subject}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Variables:</strong> {selectedTemplate.variables.join(', ')}
              </Typography>
              <Typography variant="body2" sx={{ maxHeight: 100, overflow: 'auto' }}>
                <strong>Body:</strong> {selectedTemplate.body.substring(0, 200)}...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUseTemplate} variant="contained" disabled={!selectedTemplate}>
            Use Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailClientManager;