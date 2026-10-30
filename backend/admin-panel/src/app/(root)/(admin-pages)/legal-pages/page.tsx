import { redirect } from 'next/navigation';

/** @deprecated Use Settings → Legal Pages */
export default function LegacyLegalPagesRedirect() {
  redirect('/settings/legal-pages');
}
