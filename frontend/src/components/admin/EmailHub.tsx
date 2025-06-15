import React, { useState } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import EmailServerManager from './EmailServerManager';
import EmailTemplateManager from './EmailTemplateManager';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const EmailHub: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Email Management
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, v) => setTabValue(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Send Emails" />
          <Tab label="Email Templates" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <EmailServerManager />
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <EmailTemplateManager />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
};

export default EmailHub;