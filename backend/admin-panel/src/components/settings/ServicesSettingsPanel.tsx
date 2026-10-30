'use client';

import { SettingsForm } from './SettingsForm';
import { ServiceAreasManager } from './ServiceAreasManager';

export function ServicesSettingsPanel() {
  return (
    <div className="space-y-8">
      <SettingsForm
        group="services"
        title="Service Defaults"
        description="Default durations, car wash packages, and EV charging stations"
      />

      <ServiceAreasManager />
    </div>
  );
}
