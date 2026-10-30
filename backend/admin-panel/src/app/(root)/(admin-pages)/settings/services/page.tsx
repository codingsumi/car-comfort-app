import { redirect } from 'next/navigation';

export default function LegacySettingsServicesRedirect() {
  redirect('/settings/legal-pages');
}
