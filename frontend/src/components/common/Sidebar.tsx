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
  Typography,
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
  Article,
} from '@mui/icons-material';
import { RootState } from '../../store';

interface SidebarProps {
  mobileOpen: boolean;
  onDrawerToggle: () => void;
}

const drawerWidth = 240;

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
      text: 'Email Management',
      icon: <Email />,
      path: '/admin/emails',
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
    <Box sx={{ height: '100%', backgroundColor: 'grey.50' }}>
      <Toolbar />
      <Box sx={{ overflow: 'auto', py: 1 }}>
        <List>
          {menuItems.map((item) => {
            if (!canAccess(item.roles)) return null;
            
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  selected={isActive(item.path)}
                  sx={{
                    mx: 1,
                    my: 0.5,
                    borderRadius: 1,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon sx={{ 
                    minWidth: 40,
                    color: isActive(item.path) ? 'inherit' : 'action.active',
                  }}>{item.icon}</ListItemIcon>
                  <ListItemText 
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: isActive(item.path) ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        
        {user?.role === 'admin' && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ px: 2, py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AdminPanelSettings sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                <Typography 
                  variant="overline" 
                  sx={{ 
                    fontWeight: 600,
                    color: 'text.secondary',
                    letterSpacing: 1.2,
                    fontSize: '0.7rem'
                  }}
                >
                  Administration
                </Typography>
              </Box>
            </Box>
            <List sx={{ pt: 0 }}>
              {adminMenuItems.map((item) => {
                if (!canAccess(item.roles)) return null;
                
                return (
                  <ListItem key={item.text} disablePadding>
                    <ListItemButton
                      onClick={() => navigate(item.path)}
                      selected={isActive(item.path)}
                      sx={{
                        mx: 1,
                        my: 0.5,
                        borderRadius: 1,
                        '&.Mui-selected': {
                          backgroundColor: 'primary.main',
                          color: 'primary.contrastText',
                          '&:hover': {
                            backgroundColor: 'primary.dark',
                          },
                          '& .MuiListItemIcon-root': {
                            color: 'primary.contrastText',
                          },
                        },
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ 
                    minWidth: 40,
                    color: isActive(item.path) ? 'inherit' : 'action.active',
                  }}>{item.icon}</ListItemIcon>
                      <ListItemText 
                        primary={item.text} 
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          fontWeight: isActive(item.path) ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </>
        )}
      </Box>
    </Box>
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