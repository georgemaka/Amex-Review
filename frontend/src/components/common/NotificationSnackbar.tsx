import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Snackbar, Alert } from '@mui/material';
import { RootState, AppDispatch } from '../../store';
import { removeNotification } from '../../store/slices/uiSlice';

const NotificationSnackbar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const notifications = useSelector((state: RootState) => state.ui.notifications);

  const handleClose = (id: string) => {
    dispatch(removeNotification(id));
  };

  return (
    <>
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={6000}
          onClose={() => handleClose(notification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ bottom: `${(index * 70) + 24}px !important` }}
        >
          <Alert
            onClose={() => handleClose(notification.id)}
            severity={notification.type}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export default NotificationSnackbar;