import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
} from '@mui/icons-material';
import { RootState, AppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';

interface AppBarProps {
  onMenuClick: () => void;
}

const AppBar: React.FC<AppBarProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'reviewer':
        return 'warning';
      case 'coder':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <MuiAppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          AMEX Coding Portal
        </Typography>

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">
              {user.first_name} {user.last_name}
            </Typography>
            <Chip
              label={user.role.toUpperCase()}
              size="small"
              color={getRoleColor(user.role)}
              sx={{ color: 'white' }}
            />
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleLogout}>
                <Logout sx={{ mr: 1 }} fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </MuiAppBar>
  );
};

export default AppBar;