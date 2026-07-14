'use client';

interface PermissionActionButtonProps {
  permission: string;
  userPermissions?: string[];
  isSuperAdmin?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function PermissionActionButton({
  permission, userPermissions = [], isSuperAdmin = false, children, onClick, disabled, className = '',
}: PermissionActionButtonProps) {
  const hasPermission = isSuperAdmin || userPermissions.includes(permission);
  if (!hasPermission) return null;
  return (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
