'use strict';

/**
 * Customer app legal pages (signup + settings menu).
 * Admin can edit HTML in Legal Pages → Customer app.
 */
const CUSTOMER_SIGNUP_REQUIRED_SLUGS = [
  'terms-conditions',
  'privacy-policy',
  'liability-waiver'
];

const CUSTOMER_LEGAL_CATALOG = [
  {
    title: 'Terms & Conditions',
    slug: 'terms-conditions',
    sort_order: 1,
    requires_agreement: true,
    show_in_menu: true
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    sort_order: 2,
    requires_agreement: true,
    show_in_menu: true
  },
  {
    title: 'Waiver',
    slug: 'liability-waiver',
    sort_order: 3,
    requires_agreement: true,
    show_in_menu: true
  },
  {
    title: 'Support',
    slug: 'support',
    sort_order: 10,
    requires_agreement: false,
    show_in_menu: true
  }
];

module.exports = {
  CUSTOMER_SIGNUP_REQUIRED_SLUGS,
  CUSTOMER_LEGAL_CATALOG
};
