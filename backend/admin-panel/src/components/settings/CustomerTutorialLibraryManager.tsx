'use client';

import { TutorialLibraryManager } from '@/components/settings/TutorialLibraryManager';

const CUSTOMER_CATEGORIES = [
  'Getting Started',
  'Billing',
  'Pick-up & Drop-off',
  'Insurance Claims',
  'Safety',
  'General',
];

export function CustomerTutorialLibraryManager() {
  return (
    <TutorialLibraryManager
      audience="customer"
      title="Customer Tutorials"
      description="Create multiple tutorials with title, video, and instruction steps for the customer app"
      defaultCategories={CUSTOMER_CATEGORIES}
      publishedLabel="Published in customer app"
      instructionsHint={'These steps appear under "You\'ll Learn" in the customer app for this tutorial.'}
      emptyListHint="No tutorials yet. Add tutorials for billing, pick-up & drop-off, insurance claims, and more."
    />
  );
}
