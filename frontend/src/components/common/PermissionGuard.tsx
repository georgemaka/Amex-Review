import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface PermissionGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  allowedRoles, 
  children, 
  fallback = null 
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  
  if (!user) {
    return null;
  }
  
  // Check if user has permission
  const hasPermission = user.is_superuser || allowedRoles.includes(user.role);
  
  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;