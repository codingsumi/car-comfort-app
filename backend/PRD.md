# Car Comfort — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** July 2026  
**Prepared by:** Engineering Team  
**Status:** Living Document

---

## 1. Product Overview

### 1.1 What is Car Comfort?

Car Comfort is an on-demand mobile platform that connects vehicle owners (Customers) with mobile service providers (Service Providers / Drivers) for car care services delivered directly to the customer's location. The platform supports three core service verticals: **Car Wash**, **EV Charging**, and a **Combined (Car Wash + EV Charging)** offering.

The product consists of three integrated systems:
- **Customer & Provider Mobile App** — Flutter (iOS + Android)
- **Admin Panel** — Next.js 14 web application
- **Backend API** — Node.js + Express + MySQL (Sequelize ORM), Socket.IO real-time layer

### 1.2 Core Value Proposition

- **For Customers:** Book car care services from their phone, tracked in real time, with transparent pricing and no need to visit a shop.
- **For Service Providers:** Earn income by accepting nearby jobs, manage availability, and receive payouts directly to a linked bank account.
- **For Admins:** Oversee the entire platform — users, bookings, finances, compliance, and app content — from a single web dashboard.

### 1.3 Key Terms

| Term | Definition |
|---|---|
| Customer | End user who books services |
| Service Provider / Driver | Technician who fulfills bookings |
| Booking | A confirmed service request tied to a vehicle and location |
| Wallet | Provider's in-app earnings ledger |
| Payout | Transfer of wallet balance to provider's linked bank account |
| ASAP Booking | Booking dispatched immediately to nearby providers |
| Scheduled Booking | Booking set for a future date and time |

---

## 2. User Roles

| Role | Access |
|---|---|
| **Customer** | Mobile app — book services, track live, manage profile |
| **Service Provider (Driver)** | Mobile app — accept jobs, navigate, log completion, manage earnings |
| **Admin** | Web admin panel — full platform management |

---

## 3. Mobile App — Customer Experience

### 3.1 Authentication & Onboarding

**Splash & Onboarding**
- Animated splash screen on first launch
- Multi-screen onboarding slides introducing platform features
- Role selection screen: Customer or Service Provider

**Registration (Customer)**
- Fields: First name, Last name, Email, Phone (US, +1), Password, optional Referral Code
- OTP verification sent to email after registration
- Social sign-in: Google, Apple (iOS/macOS only), Facebook
- Legal consent: must open and accept all required CMS-managed legal documents before completing registration

**Login**
- Email/password with role selection (Customer or Service Provider)
- Remember Me: saves credentials securely (Keychain/Keystore-backed)
- Forgot password → email-based OTP reset flow
- Social login: Google, Apple, Facebook

**Maintenance Mode**
- Platform-wide maintenance mode screen shown when enabled by admin (blocks all bookings)

---

### 3.2 Customer Home Dashboard

**Bottom Navigation (4 tabs)**
1. Home
2. My Bookings
3. Settings
4. Need Help

**Home Tab**
- Service picker cards: Car Wash, EV Charging, EV Charging & Car Wash (combo)
- Services fetched dynamically from admin-configured catalog
- Live trip panel (if a booking is currently active): shows driver location on Mapbox map, driver name/avatar, real-time tracking status, pickup OTP
- Booking timer banner for time-sensitive actions (accept timeout)
- Post-booking state recovery on app resume/relaunch

---

### 3.3 Service Booking Flow

Customers go through a multi-step booking wizard. Steps vary by service type.

#### Car Wash Booking
1. **Location Step** — Enter vehicle parked address (Mapbox geocoding autocomplete) or select from a list of nearby car wash locations. GPS auto-suggest supported.
2. **Service Package Step** — Select a car wash package (e.g. Basic, Premium, Deluxe) fetched from admin-configured catalog
3. **Vehicle Details Step** — Select registered vehicle from the customer's garage, or add a new one inline. Upload vehicle photos. Enter notes on parked location and key handover
4. **Review & Confirm Step** — Summary of service, location, vehicle, package, pricing. Select ASAP or a scheduled date/time. Add payment method if not already linked. Confirm booking

#### EV Charging Booking
1. **Charging Location Step** — Search for or select an EV charging station (Mapbox Places search)
2. **Charging Type Step** — Select charging level (Level 1 / Level 2 / DC Fast Charge)
3. **Vehicle Step** — Select registered vehicle
4. **Review & Confirm Step** — Summary + schedule + payment confirmation

#### Combined (EV + Car Wash) Booking
- Combines both flows into a single wizard (5 steps)
- Selects both a car wash location and an EV charging station
- Both service legs are tracked independently on the live map

**Payment**
- Payment via saved card (Stripe)
- Add new card inline during booking
- Tips can be added after service completion

**Scheduling**
- ASAP: dispatched immediately to nearby providers
- Scheduled: customer selects date and time; booking auto-converts to active status at that time

---

### 3.4 Live Booking Tracking

- Real-time map (Mapbox) showing provider location as they travel to the customer
- Socket.IO live updates for tracking milestones: Assigned → En Route → Arrived → Service Started → Service Complete
- Driver name, avatar, and contact displayed on tracking screen
- **Pickup OTP**: customer receives a 6-digit OTP that the provider must confirm to begin service
- Live chat between customer and provider during active booking
- In-app timer for time-sensitive stages
- Booking cancellation with reason selection (before provider arrives)

---

### 3.5 My Bookings

- Full booking history list with status badges: Draft, Pending, Confirmed, Assigned, In Progress, Completed, Cancelled
- Tap to view booking detail: service type, vehicle, location, provider info, timeline, total cost
- Rate and review service provider after completion
- Report accident/damage or missing item from booking detail
- Download or view invoice for completed bookings

---

### 3.6 Customer Settings

| Section | Features |
|---|---|
| **Profile** | Edit name, email, phone, profile photo |
| **Payment Methods** | Add/remove Stripe cards; set default |
| **Billing History** | View all past invoices, download PDF |
| **Refer & Earn** | Personal referral code + share; discount label shown from admin config |
| **Tutorial Library** | Admin-managed video tutorials for how to use the app |
| **Notifications** | Push notification history and settings |
| **Legal Documents** | Privacy Policy, Terms & Conditions, and any CMS pages from admin |
| **Need Help / Support** | Create support tickets, view ticket history and replies |
| **Delete Account** | Submit account deletion request (data export + soft/hard delete) |

---

## 4. Mobile App — Service Provider (Driver) Experience

### 4.1 Provider Registration & Onboarding

**Registration**
- Fields: First name, Last name, Email, Phone, Password
- Profile photo upload (required)
- T-shirt size selection
- Driver's License upload (front + back photos)
- Vehicle information: Make, Model, Year, Color, License Plate, Vehicle Type
- Vehicle Registration upload (front + back)
- Background Check consent screen with downloadable authorization form
- OTP verification after all steps
- Redirected to **Approval Pending** screen after submission

**Single Identity Model**
- Existing customers can add a provider profile to their account without creating a new account ("Add Service Provider profile" flow)
- Role switching between Customer and Provider within the same session

**Approval Flow**
- Admin reviews and approves/rejects the provider application
- Provider sees "Under Review" screen while pending
- On approval: full provider dashboard access granted
- On rejection: rejection reason displayed; option to contact support

---

### 4.2 Provider Home Dashboard

**Bottom Navigation (5 tabs)**
1. Home (Job Map)
2. Bookings
3. Wallet
4. Settings
5. Support

**Home Tab — Job Map**
- Full-screen Mapbox map as background
- Nearby available bookings shown as pins on the map
- Booking card with service type, distance, estimated earnings, and timer (accept before expiry)
- Accept / Decline job directly from the map
- Active job shown with turn-by-turn navigation assist

---

### 4.3 Job Lifecycle (Provider Side)

1. **Receive Job Alert** — Push notification + map pin for nearby bookings
2. **Accept Job** — Tap to accept; job assigned; navigation begins
3. **En Route** — Real-time location broadcast to customer; turn-by-turn route shown
4. **Arrived** — Mark arrived at location
5. **Pickup OTP Confirmation** — Provider enters or confirms OTP shown by customer
6. **Service in Progress** — Timer running; customer tracking active
7. **Complete Service** — Mark job complete; billing triggered
8. **Post-Job** — Earnings credited to wallet; customer prompted to tip and review

---

### 4.4 Provider Wallet

- **Wallet Balance**: Total earnings including pending and available
- **Available for Payout**: Balance cleared for withdrawal
- **Payout Withdrawal**: Enter amount → transfer to linked bank account via Stripe Connect
- **Transaction History**: List of all earnings, tips, deductions, and payouts
- Penalty deductions shown in transaction log (e.g. late cancellation)

---

### 4.5 Provider Settings

| Section | Features |
|---|---|
| **Profile** | Edit name, phone, bio, profile photo |
| **Car Details** | View/update registered vehicle info |
| **Driver License** | View uploaded license documents |
| **Payment History** | Detailed earnings history with filters |
| **Notifications** | Push notification history |
| **Learning Library** | Admin-managed training videos for providers |
| **Privacy & Terms** | Legal documents relevant to providers |
| **Support** | Access same support ticket system as customers |

---

## 5. Admin Panel

The admin panel is a Next.js 14 web application accessible at `/admin`. All routes are protected by admin authentication (session cookie).

### 5.1 Authentication

- Email/password login
- Forgot password via email reset link
- Session stored in HttpOnly cookie (secure, XSS-safe)
- Auto-redirect to login on session expiry
- Admin audit log captures all login/logout events

---

### 5.2 Dashboard

**KPI Summary Cards**
- Total Users, Total Drivers, Total Customers
- Total Bookings (all time), Active Bookings (live count)
- Total Revenue (completed bookings)
- Pending Driver Approvals

**Recent Bookings Table**
- Last 10 bookings with customer name, driver, vehicle, status

---

### 5.3 User Management

#### Customers (`/users/customers`)
- Paginated, searchable, filterable list
- Customer detail view: profile info, booking history, payment methods, support tickets, account status
- Actions: view profile, suspend/activate, send notification, export data

#### Service Providers (`/users/drivers`)
- Paginated list with approval status filter (pending, approved, rejected)
- Provider detail view: profile, vehicle details, license documents, background check status, rating, earning summary
- Actions: Approve / Reject application with reason, suspend/activate, manual payout trigger

#### Admin Users (`/users/admins`)
- List of all admin accounts
- Create / deactivate admin users

---

### 5.4 Bookings

#### Bookings List (`/bookings`)
- Full paginated booking list with advanced filters: status, service type, date range, customer, provider
- Quick filter tabs: All, Active, Pending, Completed, Cancelled
- Booking status badges

#### Booking Detail (`/bookings/[id]`)
- Full booking info: customer, provider, vehicle, service type, package, location, timestamps, cost breakdown
- Timeline of all status changes
- Chat transcript
- Assign/reassign provider manually
- Cancel booking with reason
- Issue refund from booking detail

#### Fleet Map (`/bookings/fleet-map`)
- Live map showing all active bookings and provider locations in real time

#### Booking Charges (`/bookings/charges`)
- Manage extra charges that can be applied to bookings (e.g. distance surcharges)

---

### 5.5 Finance

#### Transactions (`/finance/transactions`)
- Complete paginated transaction ledger
- Filter by type (booking payment, tip, refund, payout), date, provider, customer
- Export as CSV
- Transaction detail view

#### Payouts (`/finance/payouts`)
- Provider payout history list
- Manual payout trigger for a specific provider
- Payout detail with Stripe Connect status

#### Refunds (`/finance/refunds`)
- Refund history with original booking reference
- Issue new refund against a booking

#### Pricing (`/finance/pricing`)
- Configure platform commission rates
- Service pricing rules by vehicle type and service type

#### Financial Reports (`/finance/reports`)
- Revenue report (by date range, by service type)
- Refund report
- Payout report
- Tax report
- Export all reports as CSV

---

### 5.6 Vehicles

#### Vehicle List (`/vehicles`)
- All vehicles registered by customers
- Filter by status: active, inactive, flagged, removed
- Unflag directly from list

#### Vehicle Detail (`/vehicles/[id]`)
- Full vehicle profile: make, model, year, color, plate, VIN, registration photos
- Flag vehicle with reason (suspicious activity, fraud, etc.)
- Remove vehicle from platform
- Booking history for that vehicle
- Activity log (flagged, unflagged, removed, etc.)
- Vehicle image management (preview, flag image, remove image)

#### Vehicle Types (`/vehicles/types`)
- Admin-managed list of vehicle types used in booking and pricing
- Create, edit, activate/deactivate vehicle types
- Vehicle count per type displayed

---

### 5.7 Services Catalog (`/services`)
- Create and manage service offerings (Car Wash, EV Charging, Combo)
- Enable/disable services
- Attach packages and pricing to services

---

### 5.8 Provider Performance (`/provider-performance`)
- Performance scorecard per provider: completion rate, average rating, cancellation rate, earnings
- Provider detail performance view
- Sortable and filterable leaderboard

#### Provider Reviews (`/provider-reviews`)
- All customer reviews for providers
- Filter by rating, provider, date
- Remove inappropriate reviews with reason (logged to audit)
- Review response management

---

### 5.9 Support

#### Support Tickets (`/support/tickets`)
- All customer and provider support tickets
- Filter by status (open, in_progress, pending, resolved, closed), priority, assignee
- Ticket detail: full message thread with admin reply, attachment support
- Assign tickets to admin users with auto-assignment strategies (round-robin, priority-based)
- Update status, priority, escalate
- Email history per ticket

#### FAQ Management (`/support/faq`)
- Create and manage FAQ categories and questions
- Shown in the mobile app's "Need Help" section

#### Reported Issues (`/support/reported-issues`)
- Issues flagged from within bookings (accident/damage, missing items)

---

### 5.10 Content Moderation

#### Reviews (`/content-moderation/reviews`)
- All reviews across the platform
- Flag, remove, or restore reviews
- Remove provider responses to reviews

#### Reports (`/content-moderation/reports`)
- User-submitted reports against other users or providers

#### Moderation Logs (`/content-moderation/logs`)
- Audit trail of all moderation actions taken by admins

---

### 5.11 Notifications

#### Inbox (`/notifications/inbox`)
- All system-generated and manual notifications sent to users

#### Templates (`/notifications/templates`)
- Create and manage reusable notification templates (push + email)
- Variables supported (e.g. `{{name}}`, `{{booking_id}}`)

#### Campaigns (`/notifications/campaigns`)
- Create targeted notification campaigns to segments of users
- Schedule campaigns for future delivery
- Track delivery and open rates

#### Analytics (`/notifications/analytics`)
- Notification delivery rate, open rate, channel breakdown
- Recent send history and failure log

---

### 5.12 Reports

| Report | Description |
|---|---|
| Revenue Report | Revenue by date range, service type, provider |
| Booking Report | Booking volume, completion rates, cancellation analysis |
| Customer Report | Customer acquisition, retention, LTV |
| Provider Report | Provider performance, earnings, activity |
| Satisfaction Report | Rating trends, review sentiment |
| Service Duration Report | Average time per service type |
| Export | CSV export of any report dataset |

---

### 5.13 Security

#### Overview (`/security/overview`)
- Platform security health summary

#### Admin Sessions (`/security/sessions`)
- List of all active and historical admin login sessions
- Revoke individual sessions
- Force logout all sessions for a specific admin

#### Compliance (`/security/compliance`)
- Account deletion requests from customers
- Verify, export user data, and process deletion (soft delete or hard delete)

#### Audit Logs (`/security/logs`)
- Full admin action audit trail: login, logout, data changes, approvals, rejections
- Filterable by admin, action type, date range
- Individual log detail view

#### Security Monitoring (`/security/monitoring`)
- Suspicious activity flags and alerts

---

### 5.14 Settings

| Section | Purpose |
|---|---|
| **General** | App name, timezone, contact info |
| **Company** | Company details (name, address, logo) |
| **Admin Branding** | Logo, favicon, primary colour for admin panel |
| **Payments** | Stripe publishable/secret keys, webhook secret, payout settings |
| **Email** | SMTP configuration (host, port, credentials) |
| **Notifications** | OneSignal credentials (App ID, REST API key) |
| **Social Links** | App Store / Play Store / social media URLs |
| **Services** | Default service settings |
| **Legal Pages** | CMS editor for Privacy Policy, Terms & Conditions, and custom legal documents shown in app at registration and in settings |
| **Tutorial — Customer** | Upload and manage tutorial video library for customers |
| **Tutorial — Driver** | Upload and manage training video library for service providers |
| **Maintenance Mode** | Toggle platform-wide maintenance mode (blocks bookings on mobile app) |
| **Audit Logs** | Settings-level change log |

---

### 5.15 Account Deletion Management (`/account-deletion`)
- All pending and processed account deletion requests
- Filter by status and deletion type
- Process: verify → export data (GDPR) → complete deletion

---

### 5.16 Disputes (`/disputes`)
- Booking disputes raised by customers or providers
- Resolution workflow with admin decision

---

## 6. Backend API

### 6.1 Architecture

- **Runtime:** Node.js (v22+), Express.js
- **Database:** MySQL via Sequelize ORM
- **Real-time:** Socket.IO over HTTP/WebSocket
- **Authentication:** JWT (access tokens), bcrypt password hashing
- **File Storage:** Local filesystem with configurable upload path
- **Payments:** Stripe (charges, Connect payouts, webhooks)
- **Push Notifications:** OneSignal (push) + SMTP (email) + SignalWire (SMS)
- **Maps:** Mapbox (geocoding, routing, static map tokens)
- **Process Manager:** PM2 in cluster mode

### 6.2 API Module Overview

| Module | Routes |
|---|---|
| Auth | Register, Login, OTP verify, Forgot/Reset password, Social login, Role switch, Logout |
| Customer | Profile, Vehicles, Bookings, Payments, Reviews, Referrals, Support tickets |
| Driver (Provider) | Profile, Vehicle, Bookings (accept/decline/complete), Wallet, Payout, Notifications |
| Bookings | Create, Status updates, Live tracking, Chat, Cancel, Rate, Tip |
| Payments | Stripe payment intents, Stripe webhooks |
| Services | List available services and packages |
| Legal Pages | Fetch CMS legal documents |
| Tutorial | Fetch tutorial videos by audience |
| App Status | Public health check, Admin-authed DB health check |
| Admin — All modules listed above |

### 6.3 Real-Time Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `location_update` | Provider → Server | Provider GPS broadcast |
| `driver_location` | Server → Customer | Forwarded provider location |
| `booking_status_update` | Server → Both | Tracking milestone change |
| `new_booking_available` | Server → Provider | New nearby job alert |
| `booking_assigned` | Server → Customer | Provider accepted the job |
| `chat_message` | Both ↔ Server | In-booking chat |
| `otp_confirmed` | Server → Customer | Pickup OTP verified |

### 6.4 Workers

- **Notification Worker:** Background process consuming a notification queue (email, push, SMS) — runs as a separate PM2 process
- **Driver License Compliance Scheduler:** Periodic check for expiring driver licenses; sends alerts
- **Scheduled Booking Converter:** Converts scheduled bookings to active at their scheduled time

---

## 7. Integrations

| Service | Purpose |
|---|---|
| **Stripe** | Customer card payments, provider Stripe Connect payouts, webhook events |
| **Mapbox** | Map rendering, geocoding, routing, EV station search |
| **OneSignal** | Push notifications to iOS and Android |
| **Firebase** | Realtime database, push notification delivery routing |
| **SMTP (configurable)** | Transactional email (registration, password reset, ticket replies) |
| **SignalWire** | SMS OTP delivery |
| **Apple Sign In** | iOS social auth |
| **Google Sign In** | Android/iOS social auth |
| **Facebook Login** | Social auth |

---

## 8. Non-Functional Requirements

### 8.1 Performance
- API responses under 500ms for standard queries
- Booking dispatch (socket broadcast) within 2 seconds of acceptance
- Admin panel list pages paginated (default 20 per page, max 100)

### 8.2 Security
- JWT tokens stored in device Keychain (iOS) / EncryptedSharedPreferences (Android)
- Admin sessions via HttpOnly cookie (XSS-resistant)
- All admin routes protected by server-side middleware auth
- Admin-only and garage roles blocked from public registration
- Stripe webhook signature verification enforced
- CORS restricted to configured origins only

### 8.3 Availability
- PM2 cluster mode on all CPU cores for the Node API
- PM2 `max_memory_restart` limits to prevent memory leak crashes
- Notification worker runs as an isolated PM2 process

### 8.4 Compliance
- GDPR-compliant account deletion flow (verify → export → delete)
- Legal document consent captured and logged at signup
- Admin audit log captures all admin actions
- User data export before deletion

### 8.5 Supported Platforms
- iOS 14+
- Android 8+ (API level 26+)
- Admin panel: modern browsers (Chrome, Firefox, Safari, Edge)

---

## 9. User Flows Summary

### Customer: Book a Car Wash
```
Open App → Home → Tap "Car Wash"
→ Enter vehicle location (geocode or GPS)
→ Select car wash location
→ Select package
→ Select vehicle from garage (or add new)
→ Add notes + key location
→ Choose ASAP or Schedule date/time
→ Review summary + confirm payment
→ Booking confirmed → wait for provider assignment
→ Provider assigned → live tracking starts
→ Provider arrives → exchange Pickup OTP
→ Service completed → rate provider → view invoice
```

### Provider: Accept and Complete a Job
```
Provider Dashboard (map view)
→ New job pin appears + push notification
→ View job card: service, location, earnings, timer
→ Tap Accept
→ Navigation starts (Mapbox turn-by-turn)
→ Arrive → tap Arrived
→ Customer shows OTP → provider confirms
→ Complete service → tap Complete
→ Earnings credited to wallet
→ Customer reviews provider
```

### Admin: Approve a New Provider
```
Admin Panel → Users → Drivers → Pending tab
→ Click driver row → View application
→ Review license, vehicle, background check consent
→ Click Approve (or Reject with reason)
→ Provider receives push notification + email
→ Provider gains access to full dashboard
```

---

## 10. Out of Scope (Current Version)

- In-app subscription / membership plans
- Multi-city / franchise management
- Provider earnings advance / instant pay
- Customer loyalty points system (referral discount only)
- Web-based customer booking portal
- Native iPad / tablet layout
- Third-party CRM integration
- Analytics beyond admin panel built-in reports
