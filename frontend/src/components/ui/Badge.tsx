interface BadgeProps {
  label: string;
  color?: string;
  variant?: 'default' | 'status';
  className?: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  resolved: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  connected: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export default function Badge({ label, color, variant = 'default', className = '' }: BadgeProps) {
  if (variant === 'status') {
    const cls = statusColors[label.toLowerCase()] || 'bg-gray-100 text-gray-600';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls} ${className}`}>
        {label}
      </span>
    );
  }

  if (color) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
        style={{ backgroundColor: color + '20', color }}
      >
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 ${className}`}>
      {label}
    </span>
  );
}
