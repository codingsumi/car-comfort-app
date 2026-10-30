'use client';

import { useState, useEffect, useCallback } from 'react';
import { SettingsForm } from './SettingsForm';
import { settingsService } from '@/services/settings.service';
import { SafeImage } from '@/components/shared/SafeImage';

export function InvoicePreviewPanel() {
  const [invoice, setInvoice] = useState({
    company: 'Car Comfort LLC',
    gst: '',
    website: '',
    email: '',
    phone: '',
    address: '',
    footer: 'Thank you for your business!',
    logo: null as string | null,
  });

  const load = useCallback(async () => {
    try {
      const data = await settingsService.getByGroup('invoice');
      const val = (key: string) => (data[key]?.value as string) || '';
      setInvoice({
        company: val('invoice_company_name') || 'Car Comfort LLC',
        gst: val('invoice_gst_vat_number'),
        website: val('invoice_website'),
        email: val('invoice_email'),
        phone: val('invoice_phone'),
        address: val('invoice_address'),
        footer: val('invoice_footer_notes') || 'Thank you for your business!',
        logo: (data.invoice_logo?.value as string) || null,
      });
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SettingsForm
        group="invoice"
        title="Company & Invoice"
        description="Legal and billing details shown on invoices"
      />
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-secondary-900">Invoice Preview</h4>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
            <div>
              {invoice.logo && (
                <SafeImage src={invoice.logo} alt="Company logo" width={48} height={48} className="mb-2 h-12 w-auto" />
              )}
              <h3 className="text-lg font-bold text-secondary-900">{invoice.company}</h3>
              {invoice.gst && <p className="text-xs text-neutral-400">Tax ID: {invoice.gst}</p>}
            </div>
            <div className="text-right text-xs text-neutral-400">
              <p>INVOICE</p>
              <p className="mt-1">#INV-00001</p>
              <p>{new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <div className="mt-4 space-y-1 text-sm text-neutral-500">
            {invoice.address && <p>{invoice.address}</p>}
            {invoice.website && <p>{invoice.website}</p>}
            {invoice.email && <p>{invoice.email}</p>}
            {invoice.phone && <p>{invoice.phone}</p>}
          </div>
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-neutral-400">
                <th className="pb-2">Description</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-50">
                <td className="py-2">Car Wash Service</td>
                <td className="py-2 text-right">$49.00</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-6 border-t border-neutral-100 pt-4 text-center text-xs text-neutral-400">
            {invoice.footer}
          </p>
        </div>
      </div>
    </div>
  );
}
