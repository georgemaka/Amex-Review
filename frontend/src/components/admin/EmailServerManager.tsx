import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Grid,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Preview as PreviewIcon,
  Science as TestIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { fetchStatements } from '../../store/slices/statementSlice';
import { fetchEmailTemplates } from '../../store/slices/emailSlice';
import api from '../../services/api';

interface EmailServerManagerProps {
  onEmailSent?: () => void;
}

const EmailServerManager: React.FC<EmailServerManagerProps> = ({ onEmailSent }) => {
  const dispatch = useDispatch<any>();
  const { statements } = useSelector((state: RootState) => state.statements);
  const { templates } = useSelector((state: RootState) => state.emails);

  const [recipientType, setRecipientType] = useState('specific');
  const [specificRecipients, setSpecificRecipients] = useState('');
  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [attachmentType, setAttachmentType] = useState('pdf');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    dispatch(fetchStatements({ skip: 0, limit: 100 }));
    dispatch(fetchEmailTemplates());
  }, [dispatch]);

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setSubject(template.subject);
        setBody(template.body);
      }
    }
  }, [selectedTemplate, templates]);

  const handleSendEmail = async () => {
    try {
      setIsSending(true);
      setSendResult(null);

      const emailData = {
        recipient_type: recipientType,
        specific_recipients: recipientType === 'specific' 
          ? specificRecipients.split(',').map(e => e.trim()).filter(e => e)
          : null,
        statement_id: selectedStatement,
        template_id: selectedTemplate,
        subject,
        body,
        include_attachments: includeAttachments,
        attachment_type: attachmentType,
      };

      const response = await api.post('/api/v1/email-sender/send', emailData);
      
      setSendResult({
        success: true,
        message: response.data.message,
      });

      if (onEmailSent) {
        onEmailSent();
      }

      // Reset form
      setSpecificRecipients('');
      setSubject('');
      setBody('');
      setIncludeAttachments(false);
    } catch (error: any) {
      setSendResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to send email',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTestEmail = async () => {
    const testEmail = prompt('Enter email address for test:');
    if (!testEmail) return;

    try {
      setIsSending(true);
      const response = await api.post('/api/v1/email-sender/test', { to_email: testEmail });
      setSendResult({
        success: true,
        message: response.data.message,
      });
    } catch (error: any) {
      setSendResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to send test email',
      });
    } finally {
      setIsSending(false);
    }
  };

  const processTemplate = (template: string): string => {
    if (!selectedStatement) return template;
    
    const statement = statements.find(s => s.id === selectedStatement);
    if (!statement) return template;

    const variables: Record<string, string> = {
      month: getMonthName(statement.month),
      year: statement.year.toString(),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      portal_url: window.location.origin,
    };

    let processed = template;
    Object.entries(variables).forEach(([key, value]) => {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return processed;
  };

  const getRecipientCount = () => {
    if (recipientType === 'specific') {
      return specificRecipients.split(',').filter(e => e.trim()).length;
    }
    return '?'; // Server will determine actual count
  };

  const getMonthName = (month: number): string => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Send Emails from Server</Typography>
        <Tooltip title="Send test email">
          <IconButton onClick={handleSendTestEmail} color="primary">
            <TestIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {sendResult && (
        <Alert 
          severity={sendResult.success ? 'success' : 'error'} 
          sx={{ mb: 3 }}
          onClose={() => setSendResult(null)}
        >
          {sendResult.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Recipients</Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Recipient Type</InputLabel>
              <Select
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
                label="Recipient Type"
              >
                <MenuItem value="specific">Specific Recipients</MenuItem>
                <MenuItem value="all_coders">All Coders</MenuItem>
                <MenuItem value="all_reviewers">All Reviewers</MenuItem>
                <MenuItem value="assigned_coders">Assigned Coders (by Statement)</MenuItem>
                <MenuItem value="assigned_reviewers">Assigned Reviewers (by Statement)</MenuItem>
              </Select>
            </FormControl>

            {recipientType === 'specific' && (
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Email Addresses (comma-separated)"
                value={specificRecipients}
                onChange={(e) => setSpecificRecipients(e.target.value)}
                placeholder="user1@example.com, user2@example.com"
                sx={{ mb: 2 }}
              />
            )}

            <Box sx={{ mb: 2 }}>
              <Chip 
                label={`Recipients: ${getRecipientCount()}`} 
                color="primary" 
                variant="outlined" 
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>Attachments</Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Statement</InputLabel>
              <Select
                value={selectedStatement || ''}
                onChange={(e) => setSelectedStatement(Number(e.target.value) || null)}
                label="Statement"
              >
                <MenuItem value="">None</MenuItem>
                {statements.map(stmt => (
                  <MenuItem key={stmt.id} value={stmt.id}>
                    {getMonthName(stmt.month)} {stmt.year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                  disabled={!selectedStatement}
                />
              }
              label="Include attachments"
              sx={{ mb: 2 }}
            />

            {includeAttachments && (
              <FormControl fullWidth>
                <InputLabel>Attachment Type</InputLabel>
                <Select
                  value={attachmentType}
                  onChange={(e) => setAttachmentType(e.target.value)}
                  label="Attachment Type"
                >
                  <MenuItem value="pdf">PDF Only</MenuItem>
                  <MenuItem value="csv">CSV Only</MenuItem>
                  <MenuItem value="both">Both PDF and CSV</MenuItem>
                </Select>
              </FormControl>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Email Content</Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Email Template</InputLabel>
              <Select
                value={selectedTemplate || ''}
                onChange={(e) => setSelectedTemplate(Number(e.target.value) || null)}
                label="Email Template"
              >
                <MenuItem value="">Custom Email</MenuItem>
                {templates.map(template => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              sx={{ mb: 2 }}
              required
            />

            <TextField
              fullWidth
              multiline
              rows={10}
              label="Email Body (HTML)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              sx={{ mb: 2 }}
              required
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? 'Edit' : 'Preview'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {previewMode && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Email Preview</Typography>
              <Box sx={{ border: 1, borderColor: 'divider', p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">From:</Typography>
                <Typography gutterBottom>AMEX Coding Portal &lt;noreply@sukutapps.com&gt;</Typography>
                
                <Typography variant="subtitle2" color="text.secondary">Reply-To:</Typography>
                <Typography gutterBottom>gl@sukut.com</Typography>
                
                <Typography variant="subtitle2" color="text.secondary">Subject:</Typography>
                <Typography gutterBottom fontWeight="bold">{processTemplate(subject)}</Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Box dangerouslySetInnerHTML={{ __html: processTemplate(body) }} />
              </Box>
            </Paper>
          </Grid>
        )}

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={isSending ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={handleSendEmail}
              disabled={isSending || !subject || !body || (recipientType === 'specific' && !specificRecipients)}
              size="large"
            >
              {isSending ? 'Sending...' : 'Send Email'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmailServerManager;