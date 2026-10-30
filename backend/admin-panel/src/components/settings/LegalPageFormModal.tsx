'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { LegalDocumentImport } from '@/components/settings/LegalDocumentImport';
import { LegalBackgroundCheckPdfUpload } from '@/components/settings/LegalBackgroundCheckPdfUpload';
import type { LegalPage, LegalPageAudience, LegalPagePayload } from '@/services/legalPages.service';

const BACKGROUND_CHECK_SLUG = 'background-check-authorization';

const PAGE_PRESETS: Record<
  LegalPageAudience,
  Array<{ title: string; slug: string; hint: string }>
> = {
  customer: [
    { title: 'Terms & Conditions', slug: 'terms-conditions', hint: 'Required at customer signup' },
    { title: 'Privacy Policy', slug: 'privacy-policy', hint: 'Required at customer signup' },
    { title: 'Waiver', slug: 'liability-waiver', hint: 'Required at customer signup' },
    { title: 'Support', slug: 'support', hint: 'Customer help — menu only' },
  ],
  provider: [
    { title: 'Service Provider NDA', slug: 'provider-nda', hint: 'Required at signup' },
    { title: 'Independent Contractor Agreement', slug: 'independent-contractor-agreement', hint: 'Required at signup' },
    { title: 'Privacy Policy', slug: 'privacy-policy', hint: 'Required at signup' },
    { title: 'Contractor Liability Waiver', slug: 'contractor-liability-waiver', hint: 'Required at signup' },
    { title: 'Vehicle User Agreement', slug: 'vehicle-user-agreement', hint: 'Required at signup' },
    { title: 'Service Provider Terms', slug: 'terms-conditions', hint: 'Required at signup' },
    {
      title: 'Background Check Authorization',
      slug: BACKGROUND_CHECK_SLUG,
      hint: 'Onboarding step 5 — PDF form only',
    },
    { title: 'Provider Support', slug: 'support', hint: 'Menu only — not required at signup' },
  ],
  common: [
    { title: 'FAQ', slug: 'faq', hint: 'Shown in customer and provider apps' },
    { title: 'Safety Guidelines', slug: 'safety-guidelines', hint: 'Shared safety information' },
  ],
};

interface LegalPageFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: LegalPagePayload) => void;
  loading?: boolean;
  editingPage?: LegalPage | null;
  audience: LegalPageAudience;
}

export function LegalPageFormModal({
  open,
  onClose,
  onSubmit,
  loading,
  editingPage,
  audience,
}: LegalPageFormModalProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [status, setStatus] = useState(true);
  const [sortOrder, setSortOrder] = useState(100);
  const [requiresAgreement, setRequiresAgreement] = useState(false);
  const [showInMenu, setShowInMenu] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isBackgroundCheckPage =
    slug.trim() === BACKGROUND_CHECK_SLUG ||
    editingPage?.slug === BACKGROUND_CHECK_SLUG;

  const audienceLabel =
    audience === 'customer' ? 'Customer' : audience === 'provider' ? 'Provider' : 'Common';

  useEffect(() => {
    if (open) {
      if (editingPage) {
        setTitle(editingPage.title);
        setSlug(editingPage.slug);
        setHtmlContent(editingPage.description_json?.html || '');
        setMetaTitle(editingPage.meta_title || '');
        setMetaDescription(editingPage.meta_description || '');
        setStatus(editingPage.status);
        setSortOrder(editingPage.sort_order ?? 100);
        setRequiresAgreement(Boolean(editingPage.requires_agreement));
        setShowInMenu(editingPage.show_in_menu !== false);
        setPdfUrl(editingPage.description_json?.pdf_url?.trim() || '');
      } else {
        setTitle('');
        setSlug('');
        setHtmlContent('');
        setMetaTitle('');
        setMetaDescription('');
        setStatus(true);
        setSortOrder(100);
        setRequiresAgreement(audience === 'provider');
        setShowInMenu(true);
        setPdfUrl('');
      }
      setErrors({});
    }
  }, [open, editingPage, audience]);

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!editingPage) {
      setSlug(generateSlug(value));
    }
  };

  const applyPreset = (preset: { title: string; slug: string; hint?: string }) => {
    if (editingPage) return;
    setTitle(preset.title);
    setSlug(preset.slug);
    if (preset.slug === BACKGROUND_CHECK_SLUG) {
      setHtmlContent('');
      setRequiresAgreement(false);
      setShowInMenu(true);
      setPdfUrl('');
      return;
    }
    if (audience === 'provider') {
      const signupRequired = preset.slug !== 'support';
      setRequiresAgreement(signupRequired);
      setShowInMenu(true);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (isBackgroundCheckPage) {
      if (!pdfUrl.trim()) errs.pdf = 'Upload the background check PDF form';
    } else if (!htmlContent.trim()) {
      errs.content = 'Content is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const description_json = isBackgroundCheckPage
      ? { html: '', pdf_url: pdfUrl.trim() }
      : { html: htmlContent };

    onSubmit({
      title: title.trim(),
      slug: slug.trim() || undefined,
      audience,
      description_json,
      meta_title: metaTitle.trim() || undefined,
      meta_description: metaDescription.trim() || undefined,
      status,
      sort_order: sortOrder,
      requires_agreement: isBackgroundCheckPage ? false : requiresAgreement,
      show_in_menu: showInMenu,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editingPage
          ? `Edit ${audienceLabel} Legal Page`
          : `Create ${audienceLabel} Legal Page`
      }
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {!editingPage && (
          <div className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Quick templates
            </p>
            <div className="flex flex-wrap gap-2">
              {PAGE_PRESETS[audience].map((preset) => (
                <button
                  key={preset.slug}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs text-secondary-700 hover:border-primary-200 hover:bg-primary-50"
                >
                  <span className="font-medium">{preset.title}</span>
                  <span className="mt-0.5 block text-neutral-400">/{preset.slug}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Title"
            placeholder="e.g. Privacy Policy"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            error={errors.title}
          />
          <Input
            label="Slug"
            placeholder="privacy-policy"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={isBackgroundCheckPage}
            hint={
              isBackgroundCheckPage
                ? 'Fixed slug for provider onboarding step 5'
                : audience === 'common'
                  ? `Shown in both apps: ?page=${slug || 'faq'}&audience=customer or provider`
                  : `Used by the ${audienceLabel.toLowerCase()} app: ?page=${slug || 'privacy-policy'}&audience=${audience}`
            }
          />
        </div>

        {isBackgroundCheckPage ? (
          <LegalBackgroundCheckPdfUpload
            pdfUrl={pdfUrl}
            onPdfUrlChange={setPdfUrl}
            error={errors.pdf}
            onClearError={() =>
              setErrors((prev) => {
                const next = { ...prev };
                delete next.pdf;
                return next;
              })
            }
            disabled={loading}
          />
        ) : (
          <>
            <LegalDocumentImport
              key={`${open}-${editingPage?.id ?? 'new'}-${audience}`}
              htmlContent={htmlContent}
              onContentChange={setHtmlContent}
              onClearContentError={() =>
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.content;
                  return next;
                })
              }
            />

            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-secondary-500">
                Content (HTML)
              </label>
              <textarea
                rows={10}
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<h1>Privacy Policy</h1><p>Your privacy is important to us...</p>"
                className={`block w-full rounded-lg border bg-white px-3.5 py-2.5 font-mono text-sm text-secondary-900 placeholder:text-neutral-300 transition-colors focus:outline-none focus:ring-1 ${
                  errors.content
                    ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
                    : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-500'
                }`}
              />
              {errors.content && (
                <p className="mt-1 text-xs text-danger-500">{errors.content}</p>
              )}
            </div>
          </>
        )}

        {!isBackgroundCheckPage && (
          <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
            <p className="mb-3 text-sm font-medium text-secondary-500">SEO Settings (Optional)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Meta Title"
                placeholder="Custom page title for search engines"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
              />
              <Input
                label="Meta Description"
                placeholder="Short description for search results"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
          <Toggle
            label="Published"
            description={
              audience === 'common'
                ? 'Make this page visible in both customer and provider apps'
                : `Make this page visible in the ${audienceLabel.toLowerCase()} app`
            }
            checked={status}
            onChange={setStatus}
          />
          <Toggle
            label="Show in app menu"
            description="Users can open this document anytime from settings / legal menu"
            checked={showInMenu}
            onChange={setShowInMenu}
          />
          {!isBackgroundCheckPage && (audience === 'provider' || audience === 'customer') && (
            <Toggle
              label="Required at signup"
              description={
                audience === 'provider'
                  ? 'Provider must view and accept this before completing registration'
                  : 'Customer must accept this during signup (if your app enforces it)'
              }
              checked={requiresAgreement}
              onChange={setRequiresAgreement}
            />
          )}
          <Input
            label="Sort order"
            type="number"
            min={0}
            max={9999}
            value={String(sortOrder)}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            hint="Lower numbers appear first in the app menu"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {editingPage ? 'Update Page' : 'Create Page'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
