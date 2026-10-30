'use client';

interface SettingsSectionCardProps {
  children: React.ReactNode;
}

export function SettingsSectionCard({ children }: SettingsSectionCardProps) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-6 shadow-sm">
      {children}
    </div>
  );
}
