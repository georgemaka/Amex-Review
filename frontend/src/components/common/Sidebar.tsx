import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Toolbar,
  Box,
} from '@mui/material';
import {
  Dashboard,
  Description,
  Code,
  People,
  CreditCard,
  AdminPanelSettings,
  Analytics,
  Notifications,
  Email,
  Assignment,
  Template,
} from '@mui/icons-material';
import { RootState } from '../../store';

interface SidebarProps {
  mobileOpen: boolean;
  onDrawerToggle: () => void;
}

const drawerWidth = 200;

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onDrawerToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <Dashboard />,
      path: '/dashboard',
      roles: ['admin', 'coder', 'reviewer', 'viewer'],
    },
    {
      text: 'Statements',
      icon: <Description />,
      path: '/statements',
      roles: ['admin', 'coder', 'reviewer', 'viewer'],
    },
    {
      text: 'Code Transactions',
      icon: <Code />,
      path: '/coding',
      roles: ['admin', 'coder'],
    },
    {
      text: 'Analytics',
      icon: <Analytics />,
      path: '/analytics',
      roles: ['admin', 'reviewer', 'viewer'],
    },
  ];

  const adminMenuItems = [
    {
      text: 'User Management',
      icon: <People />,
      path: '/admin/users',
      roles: ['admin'],
    },
    {
      text: 'Cardholder Management',
      icon: <CreditCard />,
      path: '/admin/cardholders',
      roles: ['admin'],
    },
    {
      text: 'Assignments',
      icon: <Assignment />,
      path: '/admin/assignments',
      roles: ['admin'],
    },
    {
      text: 'Email Management',
      icon: <Email />,
      path: '/admin/emails',
      roles: ['admin'],
    },
    {
      text: 'Email Templates',
      icon: <Template />,
      path: '/admin/email-templates',
      roles: ['admin'],
    },
    {
      text: 'Alert Settings',
      icon: <Notifications />,
      path: '/admin/alerts',
      roles: ['admin'],
    },
  ];

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const canAccess = (roles: string[]) => {
    return user && (user.is_superuser || roles.includes(user.role));
  };

  const drawer = (
    <div>
      <Toolbar />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => {
            if (!canAccess(item.roles)) return null;
            
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  selected={isActive(item.path)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        
        {user?.role === 'admin' && (
          <>
            <Divider />
            <List>
              <ListItem>
                <ListItemIcon>
                  <AdminPanelSettings />
                </ListItemIcon>
                <ListItemText primary="Administration" />
              </ListItem>
              {adminMenuItems.map((item) => {
                if (!canAccess(item.roles)) return null;
                
                return (
                  <ListItem key={item.text} disablePadding sx={{ pl: 2 }}>
                    <ListItemButton
                      onClick={() => navigate(item.path)}
                      selected={isActive(item.path)}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </>
        )}
      </Box>
    </div>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 }, backgroundColor: 'white' }}
      aria-label="navigation"
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export default Sidebar;