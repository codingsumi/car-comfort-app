export const CHART_COLORS = ['#E4101F', '#00A416', '#3B82F6', '#FF7A00', '#8B5CF6', '#EC4899'];

export function formatCategoryLabel(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatDurationHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return formatDurationHours(minutes / 60);
}

export function priorityVariant(priority: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (priority === 'critical' || priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'medium') return 'neutral';
  return 'success';
}

export function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'escalated') return 'danger';
  if (status === 'in_progress' || status === 'pending') return 'warning';
  return 'neutral';
}
