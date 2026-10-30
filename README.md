# Car Comfort

Car Comfort is a multi-part service marketplace project for customers, drivers, and administrators.

The repository contains:

- `app/` — Flutter mobile application for Android and iOS.
- `pwa/` — Flutter web/PWA client.
- `backend/` — Node.js, Express, Sequelize, and MySQL API.
- `backend/admin-panel/` — Next.js administration panel.

## Prerequisites

Install the following tools before starting:

- Git
- Flutter with Dart `3.10` or newer
- Android Studio and an Android SDK for Android development
- Xcode and CocoaPods for iOS development (macOS only)
- Node.js 20 LTS and npm
- MySQL 8 or a compatible MySQL server
- Redis for notification queues, scheduled reminders, and multi-process Socket.IO
- Firebase CLI and FlutterFire CLI for generating local Firebase configuration
- A Mapbox account and access tokens
- A Google Cloud project with the Places API enabled

Check the main tools:

```bash
flutter doctor
node --version
npm --version
mysql --version
redis-cli --version
```

## Clone the project

```bash
git clone https://github.com/codingsumi/car-comfort-app.git
cd car-comfort-app
```

## Important security rules

- Never commit `.env` files.
- Never add a Stripe secret key to `app/.env` or `pwa/.env`.
- Never commit Android `.jks` keystores or `jks_credentials.txt` files.
- Firebase-generated client configuration files are ignored and must be generated locally.
- Use restricted browser tokens for Mapbox and Google Places in the PWA.
- Keep `MAPBOX_DOWNLOADS_TOKEN`, Stripe secret keys, Firebase private keys, and other server credentials private.

## 1. Backend API

The backend runs at `http://localhost:4001` by default.

### Install dependencies

```bash
cd backend
npm ci
```

### Configure the environment

Copy the example file:

```bash
cp .env.example .env
```

At minimum, review and set these values in `backend/.env`:

```env
NODE_ENV=development
HOST=localhost
PORT=4001

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=car_comfort
DB_USER=root
DB_PASSWORD=your_mysql_password

JWT_SECRET=replace_with_a_long_random_value
SETTINGS_ENCRYPTION_KEY=replace_with_a_different_long_random_value

PUBLIC_BASE_URL=http://localhost:4001
ADMIN_FRONTEND_URL=http://localhost:4002/admin
CORS_ORIGIN=http://localhost:4002,http://localhost:5000

REDIS_URL=redis://127.0.0.1:6379
```

Generate secure random values, for example:

```bash
openssl rand -hex 32
```

The remaining variables in `.env.example` enable optional or production integrations:

- Mapbox and Google Places public web configuration
- Stripe payments and webhooks
- OneSignal push notifications
- SignalWire SMS
- SMTP email
- Firebase Admin and Realtime Database
- Google, Apple, and Facebook sign-in
- Invoice, support, tutorial, and upload configuration

For Firebase Admin, keep the service-account values only in the backend environment:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_DATABASE_URL=
FIREBASE_WEB_API_KEY=
```

If `FIREBASE_PRIVATE_KEY` is stored on one line, retain its escaped `\n` characters.

### Create and migrate the database

Start MySQL, then create the database:

```sql
CREATE DATABASE car_comfort
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Run the migrations from `backend/`:

```bash
npm run db:migrate
```

Load the project seed data only when needed:

```bash
npm run db:seed
```

### Start Redis

Use your operating system's Redis service, or run Redis directly:

```bash
redis-server
```

Verify it in another terminal:

```bash
redis-cli ping
```

The expected response is `PONG`.

### Run the API

```bash
cd backend
npm run dev
```

Verify the server:

```bash
curl http://localhost:4001/health
```

For a non-reloading process, use `npm start`.

The API starts an embedded notification worker during normal development. A dedicated production worker can be started with:

```bash
npm run worker:notifications
```

Do not run both the embedded and dedicated worker unless the deployment is configured for that topology.

## 2. Admin panel

The Next.js admin panel lives under `backend/admin-panel` and runs at `http://localhost:4002/admin`.

Keep the backend running in a separate terminal.

### Install and configure

```bash
cd backend/admin-panel
npm ci
cp .env.example .env.local
```

Use these local values in `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:4002/admin
NEXT_PUBLIC_API_URL=http://localhost:4001
NEXT_PUBLIC_BASE_PATH=/admin

NEXT_PUBLIC_MAPBOX_TOKEN=

NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

`NEXT_PUBLIC_API_URL` must contain only the backend origin; do not append `/api`.

The Firebase browser values are required for live support chat unless the panel obtains compatible configuration from the backend. `NEXT_PUBLIC_MAPBOX_TOKEN` enables admin maps.

### Run the admin panel

```bash
npm run dev
```

Open `http://localhost:4002/admin/login`.

To test a production build locally:

```bash
npm run build
npm start
```

## 3. Firebase client configuration

The mobile app and PWA import `lib/firebase_options.dart`. This file and the platform-specific Firebase files are deliberately excluded from Git.

Install the tools once:

```bash
npm install --global firebase-tools
dart pub global activate flutterfire_cli
firebase login
```

Generate configuration for the native app:

```bash
cd app
flutterfire configure
```

Generate configuration for the PWA:

```bash
cd ../pwa
flutterfire configure
```

Select the correct Firebase project and the platforms required by each client. Confirm that these local files are generated where applicable:

- `app/lib/firebase_options.dart`
- `app/android/app/google-services.json`
- `app/ios/Runner/GoogleService-Info.plist`
- `pwa/lib/firebase_options.dart`
- `pwa/android/app/google-services.json`
- `pwa/ios/Runner/GoogleService-Info.plist`

Do not force-add these ignored files to Git.

## 4. Native Flutter app

### Create `app/.env`

Create the file because it is bundled as a Flutter asset:

```bash
cd app
touch .env
```

Add the following configuration:

```env
BASE_URL=http://127.0.0.1:4001/
MAPBOX_ACCESS_TOKEN=your_public_mapbox_token
MAPBOX_DOWNLOADS_TOKEN=your_private_mapbox_downloads_token
GOOGLE_PLACES_API_KEY=your_google_places_key

ONESIGNAL_APP_ID=
STRIPE_PUBLISHABLE_KEY=
STRIPE_APPLE_MERCHANT_IDENTIFIER=merchant.com.example.carcomfort
FIREBASE_DATABASE_URL=
```

The required runtime keys are `BASE_URL`, `MAPBOX_ACCESS_TOKEN`, and `GOOGLE_PLACES_API_KEY`.

Use the correct backend URL for the target device:

- iOS simulator: `http://127.0.0.1:4001/`
- Android emulator: `http://10.0.2.2:4001/`
- Physical device: `http://YOUR_COMPUTER_LAN_IP:4001/`
- Deployed API: the public HTTPS API URL

For a physical device, set `HOST=0.0.0.0` in `backend/.env`, restart the backend, and ensure the computer and device are on the same network.

`MAPBOX_DOWNLOADS_TOKEN` is used by Android build tooling to download Mapbox native dependencies. It must have the required downloads scope and must not be committed or exposed to the client at runtime.

### Install and generate

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

If iOS pods need refreshing:

```bash
cd ios
pod install
cd ..
```

### Run the native app

List available devices:

```bash
flutter devices
```

Run on a selected device:

```bash
flutter run -d DEVICE_ID
```

Common examples:

```bash
flutter run -d emulator-5554
flutter run -d "iPhone 16 Pro"
```

### Build release artifacts

```bash
flutter build apk --release
flutter build appbundle --release
flutter build ios --release
```

Release builds require your own Android signing setup and Apple signing team/profiles. Signing files are intentionally not included in this repository.

## 5. Flutter PWA

### Create `pwa/.env`

```bash
cd pwa
touch .env
```

For local development, use:

```env
BASE_URL=http://localhost:4001/
MAPBOX_ACCESS_TOKEN=your_browser_restricted_mapbox_token
GOOGLE_PLACES_API_KEY=your_browser_restricted_google_places_key

ONESIGNAL_APP_ID=
STRIPE_PUBLISHABLE_KEY=
STRIPE_APPLE_MERCHANT_IDENTIFIER=merchant.com.example.carcomfort
FIREBASE_DATABASE_URL=
```

Do not put `STRIPE_SECRET_KEY` or `MAPBOX_DOWNLOADS_TOKEN` in the PWA environment. Values bundled into a web build are visible to browser users.

Restrict browser keys to the local and production domains in the Mapbox and Google Cloud consoles.

### Install and run

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run -d chrome --web-port 5000
```

Open the URL printed by Flutter, normally `http://localhost:5000`.

### Build the PWA

```bash
flutter build web --release
```

The deployable output is written to `pwa/build/web/`. Serve it from a web server configured to return `index.html` for client-side routes.

## Recommended local startup order

Use a separate terminal for each long-running process:

1. Start MySQL.
2. Start Redis.
3. Run backend migrations once with `cd backend && npm run db:migrate`.
4. Start the API with `cd backend && npm run dev`.
5. Start the admin panel with `cd backend/admin-panel && npm run dev`.
6. Start the PWA with `cd pwa && flutter run -d chrome --web-port 5000`.
7. Start the native app with `cd app && flutter run -d DEVICE_ID`.

Local URLs:

- API health: `http://localhost:4001/health`
- Admin panel: `http://localhost:4002/admin/login`
- PWA: `http://localhost:5000`

## Useful commands

Backend:

```bash
npm run db:migrate
npm run db:migrate:undo
npm run db:seed
npm run dev
npm start
```

Flutter clients:

```bash
flutter clean
flutter pub get
flutter analyze
flutter test
dart run build_runner build --delete-conflicting-outputs
```

Admin panel:

```bash
npm run dev
npm run build
npm start
npm run lint
```

## Troubleshooting

### The app cannot reach the backend

- Confirm `curl http://localhost:4001/health` works on the development computer.
- Use `10.0.2.2`, not `localhost`, from the Android emulator.
- Use the computer's LAN IP from a physical device and bind the backend to `HOST=0.0.0.0`.
- Check local firewall rules and HTTP cleartext restrictions.

### Flutter reports a missing `.env` asset

Create `.env` inside the relevant `app/` or `pwa/` directory, then run:

```bash
flutter clean
flutter pub get
```

### Flutter cannot find `firebase_options.dart`

Run `flutterfire configure` in the affected Flutter directory.

### Database connection fails

- Confirm MySQL is running.
- Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
- The example may need port `3306` for standard MySQL or `8889` for some MAMP installations.
- Confirm that `car_comfort` exists and the selected user has access.

### Admin requests go to the wrong port

Set `NEXT_PUBLIC_API_URL=http://localhost:4001`, stop the admin dev server, and start it again. Next.js reads public environment variables at startup/build time.

### Maps do not load

- Confirm the Mapbox token is valid and has the required scopes.
- Confirm browser token URL restrictions include the current PWA/admin origin.
- Confirm the Google Places API is enabled and its key restrictions match the client.

### Scheduled notifications do not run

- Confirm Redis is running and `REDIS_URL` is correct.
- Check the API/worker logs.
- In production, run the dedicated notification worker described in `backend/README.md` and `backend/DEPLOY.md`.

## Production deployment

Production deployment notes for the API, admin panel, PM2, Nginx, TLS, migrations, and health checks are documented in:

- `backend/README.md`
- `backend/DEPLOY.md`

Always use HTTPS, production-only environment files, restricted public API keys, rotated secrets, database backups, and a secret manager or protected process-manager environment.
