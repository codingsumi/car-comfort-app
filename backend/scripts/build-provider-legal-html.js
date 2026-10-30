'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeLine(line) {
  return String(line)
    .replace(/\u2028/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBulletLine(line) {
  return /^[•\-\u2022\u2023\u25E6\u2043\u2219]/.test(line) || /^\t•/.test(line);
}

function stripBullet(line) {
  return normalizeLine(line.replace(/^[\t•\-\u2022\u2023\u25E6\u2043\u2219]+\s*/, ''));
}

const SECTION_HEADINGS = new Set([
  'Entire Agreement',
  'Effectiveness',
  'Communication',
  'Tips',
  'Contact Us',
  'Information We Collect',
  'Information Collected Automatically',
  'Information From Third Parties',
  'How We Use Your Information',
  'How We Share Information',
  'EV Charging and Vehicle Access Information',
  'Cookies and Tracking Technologies',
  'Data Retention',
  'Your Rights',
  'Data Security',
  "Children's Privacy",
  'Children’s Privacy',
  'ThirdParty Links',
  'Policy Updates',
  'Signatures',
  'Compliance',
  'Hourly Rate Policy',
  'Refund Policy and Payment Procedures',
  'Service fees policy',
  'Traffic Violation Policy',
  'Vehicle Type Policy',
  'List of Services Not Provided',
  'Rating and cancellation policies',
  'Lateness and Punctuality',
  'Customer vehicle adjustment',
  'Tutorial video and learning center',
  'Unexpected vehicle maintenance',
  'Background check',
  'Grounds for Immediate Termination',
  'Service notifications',
  'Proof of service provider Documentation',
  'Document expiration Alert',
  'Vehicle before and after service inspection photos',
  'Uniform, ID, and Authentication Policy',
  'Safety and Vehicle Handling',
  'Insurance claim process',
  'Accident or damage claims',
  'Investigation Process',
  'Encounter with police',
  'Platform Use & Operational Requirements',
  'On-Demand & Scheduled Services',
  'Towing Policy',
  'Surge Pricing Policy',
  'Car Wash Policy',
  'Eligible vehicle policy',
  'Tesla Vehicle billing Policy',
  'Other EV Billing Policy',
  'Discrimination policy',
  'Further Assurances',
  'Independent Contractor Relationship',
  'Equipment & Property',
  'Services provided',
  'Work Schedule',
  'Termination Rights.',
  'No Additional Compensation',
  'No Employee Benefits',
  'Independent Contractor.',
  'Company Inventions.',
]);

function isIntroLine(line) {
  const lower = line.toLowerCase();
  return (
    line.endsWith(':') ||
    lower.startsWith('we use personal information to') ||
    lower.startsWith('we may share personal information with') ||
    lower.startsWith('we retain personal information only as long as needed to') ||
    lower.startsWith('because valet ev charging involves temporary access to your vehicle') ||
    lower.startsWith('we use cookies and similar tools to') ||
    lower.startsWith('depending on your jurisdiction, you may have the right to') ||
    lower.startsWith('service providers must') ||
    lower.startsWith('accepted vehicles') ||
    lower.startsWith('not accepted') ||
    lower.startsWith('towing') ||
    lower.startsWith('ev customers are billed at time of booking') ||
    lower.startsWith('we do not discriminate based on') ||
    lower.startsWith('examples include') ||
    lower.startsWith('claims must include') ||
    lower.startsWith('carcomfort will') ||
    lower.startsWith('providers must') ||
    lower.startsWith('providers must not') ||
    lower.startsWith('providers must take') ||
    lower.startsWith('providers must wear') ||
    lower.startsWith('contractors may perform services including but not limited to') ||
    lower.startsWith('contractors agree to provide services to') ||
    lower.startsWith('contractors are responsible for') ||
    lower.startsWith('contractor agrees to') ||
    lower.startsWith('contractor shall not disclose') ||
    lower.startsWith('company may immediately terminate contractor for') ||
    lower.startsWith('company may also maintain') ||
    lower.startsWith('compensation will be paid as agreed')
  );
}

function expandLines(rawText) {
  const expanded = [];
  for (const raw of rawText.split(/\r?\n/)) {
    const line = normalizeLine(raw);
    if (!line) continue;
    if (line.includes('•') && !isBulletLine(line)) {
      const firstBullet = line.indexOf('•');
      const intro = line.slice(0, firstBullet).trim();
      if (intro) expanded.push(intro);
      for (const item of line.slice(firstBullet).split(/\s*•\s*/).filter(Boolean)) {
        expanded.push(`• ${item}`);
      }
      continue;
    }
    expanded.push(line);
  }
  return expanded;
}

function readDocxText(filename) {
  const docxPath = path.join(process.env.HOME || '', 'Downloads', filename);
  if (process.platform === 'darwin' && fs.existsSync(docxPath)) {
    return execSync(`textutil -convert txt -stdout ${JSON.stringify(docxPath)}`, {
      encoding: 'utf8',
    });
  }
  const tmpPath = path.join('/tmp', filename.replace(/\.docx$/i, '.txt').replace(/\s+/g, '-').toLowerCase());
  if (fs.existsSync(tmpPath)) {
    return fs.readFileSync(tmpPath, 'utf8');
  }
  throw new Error(`Missing source document: ${filename}`);
}

function splitNumberedSection(line) {
  const match = line.match(/^(\d+)\.\s+(.+)$/);
  if (!match) return null;
  const body = match[2];
  if (body.endsWith(':') && body.length < 80) {
    return { number: match[1], title: body.slice(0, -1).trim(), paragraph: null };
  }
  const splitAt = body.search(/\s{2,}|(?<=[a-z])\s+(?=[A-Z][a-z])/);
  if (splitAt > 0 && splitAt < 80) {
    return {
      number: match[1],
      title: body.slice(0, splitAt).trim(),
      paragraph: body.slice(splitAt).trim(),
    };
  }
  return { number: match[1], title: null, paragraph: body.trim() };
}

function textFileToHtml(articleClass, title, rawText, options = {}) {
  const { skipDuplicateTitle = false, skipLines = [] } = options;
  const skipSet = new Set(skipLines.map((s) => s.toLowerCase()));
  const lines = expandLines(rawText).filter((line, index) => {
    if (!line) return false;
    if (line === '.' && index === 0) return false;
    if (line === 'Top of Form' || line === 'Bottom of Form') return false;
    if (skipDuplicateTitle && line.toLowerCase() === title.toLowerCase()) return false;
    if (skipSet.has(line.toLowerCase())) return false;
    return true;
  });

  const parts = [`<article class="legal-page ${articleClass}">`, `<h1>${escapeHtml(title)}</h1>`];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      parts.push('</ul>');
      listOpen = false;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === title && i < 3) continue;

    if (isBulletLine(line)) {
      if (!listOpen) {
        parts.push('<ul>');
        listOpen = true;
      }
      parts.push(`<li>${escapeHtml(stripBullet(line))}</li>`);
      continue;
    }

    closeList();

    if (/^\([a-z]+\)\s/.test(line)) {
      parts.push(`<h3>${escapeHtml(line)}</h3>`);
      continue;
    }

    const numbered = splitNumberedSection(line);
    if (numbered) {
      if (numbered.title) {
        parts.push(`<h2>${escapeHtml(`${numbered.number}. ${numbered.title}`)}</h2>`);
        if (numbered.paragraph) {
          parts.push(`<p>${escapeHtml(numbered.paragraph)}</p>`);
        }
      } else {
        parts.push(`<h2>${escapeHtml(`${numbered.number}.`)}</h2>`);
        parts.push(`<p>${escapeHtml(numbered.paragraph)}</p>`);
      }
      continue;
    }

    if (SECTION_HEADINGS.has(line) || (line.endsWith(':') && line.length < 80 && !isIntroLine(line))) {
      const heading = line.endsWith(':') ? line.slice(0, -1) : line;
      parts.push(`<h2>${escapeHtml(heading)}</h2>`);
      continue;
    }

    if (isIntroLine(line)) {
      parts.push(`<p>${escapeHtml(line)}</p>`);
      continue;
    }

    if (line.startsWith('Note:')) {
      parts.push(`<p><strong>Note:</strong> ${escapeHtml(line.slice(5).trim())}</p>`);
      continue;
    }

    if (line.startsWith('Compensation and payment method:')) {
      parts.push(`<h2>Compensation and payment method</h2>`);
      parts.push(`<p>${escapeHtml(line.slice('Compensation and payment method:'.length).trim())}</p>`);
      continue;
    }

    parts.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();
  parts.push('</article>');
  return parts.join('\n');
}

const providerContractorLiabilityWaiverHtml = `<article class="legal-page legal-page--provider legal-page--waiver">
<h1>Independent Contractor Liability Waiver</h1>
<p class="legal-lead">CarComfort Independent Contractor Liability Waiver &amp; Release</p>
<p>This Liability Waiver and Release (&ldquo;Agreement&rdquo;) is entered into between CarComfort (&ldquo;Company&rdquo;) and the undersigned independent contractor (&ldquo;Contractor&rdquo;).</p>
<h2>1. Independent Contractor Status</h2>
<p>Contractor acknowledges and agrees they are an independent contractor, not an employee, agent, or representative of CarComfort. Contractors are solely responsible for their own taxes, insurance, licensing, and compliance with applicable laws.</p>
<h2>2. Assumption of Risk</h2>
<p>Contractor understands that providing vehicle-related services&mdash;including driving, transporting, cleaning, fueling, or inspecting vehicles&mdash;carries inherent risks, including accidents, injuries, property damage, or mechanical failure. Contractors voluntarily assume all such risks.</p>
<h2>3. Release of Liability</h2>
<p>Contractor releases and holds harmless CarComfort from any claims, losses, damages, injuries, or expenses arising from Contractor&rsquo;s performance of services, except to the extent caused by CarComfort&rsquo;s proven negligence.</p>
<h2>4. Responsibility for Equipment and Conduct</h2>
<p>Contractors are solely responsible for:</p>
<ul>
<li>Their own tools, equipment, and personal property</li>
<li>Safe operation of any vehicle entrusted to them</li>
<li>Compliance with traffic laws and safety standards</li>
<li>Any citations, violations, or damages resulting from their actions</li>
</ul>
<h2>5. Insurance Requirements</h2>
<p>Contractors affirm they carry valid auto insurance, liability insurance, and any other coverage required by law or by CarComfort. Contractor agrees to provide proof of insurance upon request.</p>
<h2>6. Indemnification</h2>
<p>Contractors agree to indemnify and defend CarComfort against claims arising from Contractor&rsquo;s actions, omissions, or breach of this Agreement.</p>
<h2>7. No Workers&rsquo; Compensation Coverage</h2>
<p>Contractors acknowledge they are not covered by CarComfort&rsquo;s workers&rsquo; compensation insurance and are responsible for their own injury protection.</p>
<h2>8. Vehicle Condition &amp; Documentation</h2>
<p>Contractors agree to document vehicle conditions before and after service and acknowledge responsibility for any unreported damage occurring while the vehicle is in their custody.</p>
<h2>9. Governing Law</h2>
<p>This Agreement is governed by the laws of the state in which services are performed.</p>
<h2>Entire Agreement</h2>
<p>This Agreement constitutes the entire understanding between the parties regarding confidentiality and supersedes all prior discussions.</p>
<p><strong>Disclosure and Assignment.</strong> The Contractor shall promptly disclose all Company Inventions and execute necessary documents to secure Company ownership, including after termination.</p>
<p><strong>Signatures:</strong> Service providers acknowledge that they have read and understood this agreement and may confirm acceptance either by e-signing or by checking the &ldquo;I agree&rdquo; box.</p>
</article>`;

const root = path.resolve(__dirname, '..');
const outFile = path.join(root, 'src/seeders/data/providerLegalContentHtml.js');

const privacyText = readDocxText('Privacy Policy.docx');
const termsText = readDocxText('Service providers terms and conditions.docx');
const icaText = readDocxText('Independent Contractor Agreement.docx');

const providerPrivacyPolicyHtml = textFileToHtml(
  'legal-page--provider legal-page--privacy',
  'Privacy Policy',
  privacyText
);
const providerTermsConditionsHtml = textFileToHtml(
  'legal-page--provider legal-page--terms',
  'Service Provider Terms and Conditions',
  termsText,
  { skipDuplicateTitle: true }
);
const providerIndependentContractorAgreementHtml = textFileToHtml(
  'legal-page--provider legal-page--contract',
  'Independent Contractor Agreement',
  icaText,
  {
    skipLines: ['CarComfort service providers Independent Contractor Agreement'],
  }
);

const fileBody = `'use strict';

/**
 * Provider legal page HTML generated from client Word documents.
 * Regenerate: node scripts/build-provider-legal-html.js
 */

const providerContractorLiabilityWaiverHtml = ${JSON.stringify(providerContractorLiabilityWaiverHtml)};
const providerIndependentContractorAgreementHtml = ${JSON.stringify(providerIndependentContractorAgreementHtml)};
const providerPrivacyPolicyHtml = ${JSON.stringify(providerPrivacyPolicyHtml)};
const providerTermsConditionsHtml = ${JSON.stringify(providerTermsConditionsHtml)};

module.exports = {
  providerContractorLiabilityWaiverHtml,
  providerIndependentContractorAgreementHtml,
  providerPrivacyPolicyHtml,
  providerTermsConditionsHtml,
};
`;

fs.writeFileSync(outFile, fileBody, 'utf8');
console.log('Wrote', outFile);
