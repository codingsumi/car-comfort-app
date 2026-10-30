'use client';

import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { accountDeletionRequestsService } from '@/services/accountDeletionRequests.service';

export default function DeleteAccountRequestPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [reason, setReason] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  async function sendOtp() {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error('Email is required');
      return;
    }
    setSendingOtp(true);
    try {
      await accountDeletionRequestsService.sendPublicOtp({
        name: name.trim() || undefined,
        email: cleanEmail,
      });
      setOtpSent(true);
      toast.success('OTP sent to your email');
    } catch {
      // The shared API client already shows the backend validation message.
    } finally {
      setSendingOtp(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!otp.trim()) {
      toast.error('Verification OTP is required');
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason for deletion is required');
      return;
    }

    setSubmitting(true);
    try {
      await accountDeletionRequestsService.submitPublic({
        name: name.trim(),
        email: email.trim(),
        otp: otp.trim(),
        reason: reason.trim(),
      });
      toast.success('Delete account request submitted');
      setName('');
      setEmail('');
      setOtp('');
      setReason('');
      setOtpSent(false);
    } catch {
      // The shared API client already shows the backend validation message.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-100 sm:p-8">
        <div className="mb-7 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Car Comfort</p>
          <h1 className="mt-2 text-2xl font-bold text-secondary-900">Delete Account Request</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Submit your request with a verified email address. We cannot process deletion while your account has a pending or in-progress booking, and only one request can stay pending at a time.
          </p>
        </div>

        <form className="space-y-5" onSubmit={submit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary-700">Email</label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setOtpSent(false);
                }}
                type="email"
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
                placeholder="Enter your email"
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={sendingOtp || !email.trim()}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingOtp ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
            {otpSent && (
              <p className="mt-1.5 text-xs text-success">OTP sent. Please check your email.</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary-700">Verification OTP</label>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="Enter OTP"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary-700">Reason for deletion</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[130px] w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="Tell us why you want to delete your account"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Delete Request'}
          </button>
        </form>
      </div>
    </main>
  );
}
