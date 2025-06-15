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
  FormControlLabel,
  Checkbox,
  Stack,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Send,
  Drafts,
  Group,
  Person,
  Refresh,
  Info,
} from '@mui/icons-material';
// import { Editor } from '@tinymce/tinymce-react';  // TODO: Add TinyMCE integration
import api from '../../services/api';

interface EmailConfig {
  graph_api_configured: boolean;
  outlook_available: boolean;
  from_email: string;
  default_mode: 'draft' | 'send';
}

interface Statement {
  id: number;
  month: number;
  year: number;
  status: string;
  cardholder_count: number;
}

const EmailManagement: React.FC = () => {
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Email form state
  const [recipientType, setRecipientType] = useState('all_coders');
  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isDraft, setIsDraft] = useState(true);
  const [specificEmails, setSpecificEmails] = useState('');
  
  // Template dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateType, setTemplateType] = useState('ready_for_coding');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, statementsRes] = await Promise.all([
        api.getEmailConfig(),
        api.getStatements()
      ]);
      
      setEmailConfig(configRes);
      setStatements(statementsRes);
      setIsDraft(configRes.default_mode === 'draft');
    } catch (err) {
      setError('Failed to load email configuration');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      setSendLoading(true);
      setError(null);
      setSuccess(null);

      const payload = {
        recipient_type: recipientType,
        statement_id: selectedStatement,
        subject,
        body,
        is_draft: isDraft,
        specific_recipients: recipientType === 'specific' 
          ? specificEmails.split(',').map(e => e.trim()).filter(e => e)
          : undefined
      };

      const result = await api.sendGroupEmail(payload);
      
      if (isDraft) {
        setSuccess(`Created ${result.drafts?.length || 0} email drafts successfully`);
      } else {
        setSuccess(`Emails queued for sending to ${result.recipient_count || 0} recipients`);
      }
      
      // Reset form
      setSubject('');
      setBody('');
      setSpecificEmails('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send emails');
    } finally {
      setSendLoading(false);
    }
  };

  const handleUseTemplate = () => {
    const statement = statements.find(s => s.id === selectedStatement);
    if (!statement) return;

    const monthName = new Date(statement.year, statement.month - 1).toLocaleString('default', { month: 'long' });
    
    if (templateType === 'ready_for_coding') {
      setSubject(`${monthName} ${statement.year} American Express Statements Ready for Coding`);
      setBody(`
        <p>Hello,</p>
        <p>The American Express statements for <strong>${monthName} ${statement.year}</strong> are now ready for coding.</p>
        <p><strong>Summary:</strong></p>
        <ul>
          <li>Total Cardholders: ${statement.cardholder_count}</li>
          <li>Portal URL: <a href="http://sukutapps.com/statements">Access Portal</a></li>
        </ul>
        <p>Please log in to the AMEX Coding Portal to access your assigned statements and begin coding.</p>
        <p><strong>Reminder:</strong> Please complete coding within 7 business days.</p>
        <p>If you have any questions or issues accessing the portal, please contact the Accounting Department.</p>
        <p>Thank you,<br>GL Team<br>Accounting Department</p>
      `);
    } else {
      setSubject(`${monthName} ${statement.year} American Express Statements Ready for Review`);
      setBody(`
        <p>Hello,</p>
        <p>The American Express statements for <strong>${monthName} ${statement.year}</strong> have been coded and are ready for your review.</p>
        <p><strong>Summary:</strong></p>
        <ul>
          <li>Total Cardholders: ${statement.cardholder_count}</li>
          <li>Portal URL: <a href="http://sukutapps.com/statements">Access Portal</a></li>
        </ul>
        <p>Please log in to the AMEX Coding Portal to review the coded transactions for your assigned cardholders.</p>
        <p>If you find any discrepancies or have questions about specific charges, please use the portal's rejection feature to send them back for correction.</p>
        <p>Thank you,<br>GL Team<br>Accounting Department</p>
      `);
    }
    
    setTemplateDialogOpen(false);
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
      <Typography variant="h5" gutterBottom>
        Email Management
      </Typography>

      {/* Email Configuration Status */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Info sx={{ mr: 1 }} />
          <Typography variant="h6">Email Configuration</Typography>
        </Box>
        
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Chip
            label={`From: ${emailConfig?.from_email || 'Not configured'}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={emailConfig?.graph_api_configured ? 'Graph API Ready' : 'Graph API Not Configured'}
            color={emailConfig?.graph_api_configured ? 'success' : 'warning'}
          />
          <Chip
            label={emailConfig?.outlook_available ? 'Outlook Available' : 'Outlook Not Available'}
            color={emailConfig?.outlook_available ? 'success' : 'default'}
          />
          <Chip
            label={`Default: ${emailConfig?.default_mode === 'draft' ? 'Create Drafts' : 'Send Directly'}`}
            color="info"
          />
        </Stack>
        
        {!emailConfig?.graph_api_configured && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Microsoft Graph API is not configured. Emails will be created as drafts in Outlook (Windows only).
            To enable direct sending, configure Azure App credentials in the environment settings.
          </Alert>
        )}
      </Paper>

      {/* Email Composer */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Compose Email
        </Typography>
        
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
                <MenuItem value="all_coders">
                  <Group sx={{ mr: 1, fontSize: 20 }} />
                  All Coders
                </MenuItem>
                <MenuItem value="all_reviewers">
                  <Group sx={{ mr: 1, fontSize: 20 }} />
                  All Reviewers
                </MenuItem>
                <MenuItem value="assigned_coders">
                  <Person sx={{ mr: 1, fontSize: 20 }} />
                  Assigned Coders (Statement)
                </MenuItem>
                <MenuItem value="assigned_reviewers">
                  <Person sx={{ mr: 1, fontSize: 20 }} />
                  Assigned Reviewers (Statement)
                </MenuItem>
                <MenuItem value="specific">
                  <Person sx={{ mr: 1, fontSize: 20 }} />
                  Specific Recipients
                </MenuItem>
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
              rows={15}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter email body (HTML tags supported)"
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '14px',
                }
              }}
            />
          </Box>
          
          <Divider />
          
          {/* Send Options */}
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <FormControlLabel
              control={
                <Checkbox
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                  disabled={!emailConfig?.graph_api_configured}
                />
              }
              label="Create as Draft"
            />
            
            <Stack direction="row" spacing={2}>
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
                variant="contained"
                startIcon={isDraft ? <Drafts /> : <Send />}
                onClick={handleSendEmail}
                disabled={sendLoading || !subject || !body}
              >
                {sendLoading ? 'Processing...' : (isDraft ? 'Create Drafts' : 'Send Emails')}
              </Button>
            </Stack>
          </Stack>
        </Stack>
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
            <InputLabel>Template Type</InputLabel>
            <Select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              label="Template Type"
            >
              <MenuItem value="ready_for_coding">Ready for Coding</MenuItem>
              <MenuItem value="ready_for_review">Ready for Review</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUseTemplate} variant="contained">
            Use Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailManagement;