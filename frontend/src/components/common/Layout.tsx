import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import AppBar from './AppBar';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar onMenuClick={handleDrawerToggle} />
      <Sidebar mobileOpen={mobileOpen} onDrawerToggle={handleDrawerToggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 4,
          width: { sm: `calc(100% - 200px)` },
          ml: { sm: '200px' },
          mt: '64px',
          height: 'calc(100vh - 64px)',
          overflow: 'auto',
          backgroundColor: 'background.default',
          maxWidth: '1600px',
          mx: 'auto',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;