export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { id: string; email: string; name: string } | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  link?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}
