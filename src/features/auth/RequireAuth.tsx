import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { ReactNode } from 'react';
import type { SimulatorRole } from '../../shared/types/domain';

interface RequireAuthProps {
  children: ReactNode;
  allowedRoles?: SimulatorRole[];
  fallbackPath?: string;
}

export function RequireAuth({ children, allowedRoles, fallbackPath = '/' }: RequireAuthProps) {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B981]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && user && !hasRole(allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
