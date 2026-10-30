'use client';

import { TutorialNav } from '@/components/settings/TutorialNav';
import { TutorialContentEditor } from '@/components/settings/TutorialContentEditor';

export default function DriverTutorialPage() {
  return (
    <>
      <TutorialNav />
      <TutorialContentEditor
        audience="driver"
        title="Service Provider Tutorial"
        description="Manage the onboarding tutorial video and instructions shown to new service providers"
        instructionsHint="These instruction steps are shown to service providers during signup and in Settings."
      />
    </>
  );
}
