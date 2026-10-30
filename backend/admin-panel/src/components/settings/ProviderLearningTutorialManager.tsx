'use client';

import { TutorialLibraryManager } from '@/components/settings/TutorialLibraryManager';

const PROVIDER_LEARNING_CATEGORIES = [
  'Getting Started',
  'EV Charging',
  'Car Wash',
  'Vehicle Types',
  'Accidents & Damage',
  'Reporting',
  'Safety',
  'General',
];

export function ProviderLearningTutorialManager() {
  return (
    <TutorialLibraryManager
      audience="driver"
      title="Provider Learning Tutorials"
      description="Upload multiple tutorial videos to teach service providers how to operate different vehicles and handle common situations"
      defaultCategories={PROVIDER_LEARNING_CATEGORIES}
      publishedLabel="Published in provider app"
      instructionsHint="These steps appear under You'll Learn in the provider app for this tutorial."
      emptyListHint="No tutorials yet. Add videos for EV charging, car wash, accident reporting, vehicle-specific guides, and more."
    />
  );
}
