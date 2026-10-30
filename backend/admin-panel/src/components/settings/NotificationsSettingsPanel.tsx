'use client';

import { useState } from 'react';
import { SettingsForm } from './SettingsForm';
import { OneSignalWebhookInfo } from './OneSignalWebhookInfo';
import { Tabs } from '@/components/ui';

export function NotificationsSettingsPanel() {
  const [activeTab, setActiveTab] = useState('onesignal');

  return (
    <div className="space-y-6">
      <Tabs
        tabs={[
          { key: 'onesignal', label: 'OneSignal' },
          { key: 'notifications', label: 'Push Toggles' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === 'onesignal' && (
        <div className="space-y-6">
          <SettingsForm
            key="onesignal"
            group="onesignal"
            title="OneSignal"
            description="Push notification API credentials"
          />
          <OneSignalWebhookInfo />
        </div>
      )}
      {activeTab === 'notifications' && (
        <SettingsForm
          key="notifications"
          group="notifications"
          title="Notification Preferences"
          description="Enable or disable notification channels"
        />
      )}
    </div>
  );
}
