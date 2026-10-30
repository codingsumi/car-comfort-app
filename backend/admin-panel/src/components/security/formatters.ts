import type { AlertSeverity, AlertStatus, AuditSeverity, ComplianceRequestStatus } from '@/types/security';

export function severityVariant(severity: AuditSeverity | AlertSeverity | string) {
  switch (severity) {
    case 'critical':
      return 'danger' as const;
    case 'high':
      return 'warning' as const;
    case 'medium':
      return 'primary' as const;
    case 'low':
    case 'info':
      return 'neutral' as const;
    default:
      return 'neutral' as const;
  }
}

export function alertStatusVariant(status: AlertStatus | string) {
  switch (status) {
    case 'open':
      return 'danger' as const;
    case 'investigating':
      return 'warning' as const;
    case 'resolved':
      return 'success' as const;
    default:
      return 'neutral' as const;
  }
}

export function complianceStatusVariant(status: ComplianceRequestStatus | string) {
  switch (status) {
    case 'pending':
      return 'warning' as const;
    case 'verified':
    case 'processing':
      return 'primary' as const;
    case 'completed':
      return 'success' as const;
    case 'rejected':
      return 'danger' as const;
    default:
      return 'neutral' as const;
  }
}

export function formatActionLabel(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAlertType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncateDevice(info: string | null, max = 48) {
  if (!info) return '—';
  return info.length > max ? `${info.slice(0, max)}…` : info;
}
