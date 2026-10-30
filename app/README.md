# Car Comfort

Flutter client for **Car Comfort** — a mobile and web app for customers and service providers around car-related services. It covers onboarding, authentication, a main dashboard (including bookings and provider profiles), and account settings. The project uses **GetX** for routing and dependency injection, **Dio** for HTTP, **Mapbox** for maps, and **Material 3** with **adaptive light/dark** theming.

## Features (app scope)

- **Onboarding & splash** — first-run and return flows.
- **Authentication** — login, registration (customer and driver), OTP, forgot password, welcome and tutorial steps, camera and location permission screens.
- **Dashboard** — home shell, **My Bookings**, and **Service provider profile**.
- **Settings** — payment methods, notifications, refer & earn, help, terms & privacy.
- **Cross-platform** — Android, iOS, and **web** (path URL strategy and custom route parsing for deep links).

## Tech stack

| Area | Packages / notes |
|------|------------------|
| Framework | Flutter (Dart SDK `^3.10.0`) |
| Navigation & DI | `get` |
| Networking | `dio` (interceptors, retries, auth handling under `lib/app/network/`) |
| Maps | `mapbox_maps_flutter` |
| Storage / prefs | `get_storage` |
| Theming | `adaptive_theme`, custom tokens in `lib/app/theme/` |
| Env config | `flutter_dotenv` (`.env` at project root) |
| UI | `cached_network_image`, `flutter_svg`, `toastification`, `intl`, etc. |
| Push (optional) | `onesignal_flutter` (initialization is commented in `main.dart` but keys are expected in `.env`) |

Asset and font code generation uses **flutter_gen** (`lib/app/gen/`).

## Project structure

```text
lib/
├── main.dart                 # App entry: env, prefs, GetX services, Mapbox token, theme, GetMaterialApp
└── app/
    ├── constants/            # API, app strings, validation, UI constants, etc.
    ├── gen/                  # Generated assets/fonts (flutter_gen)
    ├── models/               # Data models
    ├── modules/              # Feature screens + bindings/controllers
    │   ├── auth/             # Login, register, OTP, driver flow, permissions, tutorial, welcome
    │   ├── dashboard/        # Dashboard, bookings, service provider profile
    │   ├── onboarding/
    │   ├── settings/
    │   └── splash/
    ├── network/              # Dio client, repositories, API utilities
    ├── routes/               # `app_pages.dart`, `app_routes.dart` (GetX pages)
    ├── theme/                # Color schemes, typography, styles, design tokens
    ├── utils/                # Prefs, env service, validators, network monitor, extensions
    └── widgets/              # Shared UI (buttons, headers, bottom nav, etc.)
```

Other important paths:

- `assets/` — images, launcher icons, **Inter** font files
- `android/`, `ios/` — platform projects

## Prerequisites

- [Flutter](https://docs.flutter.dev/get-started/install) matching the SDK constraint in `pubspec.yaml`
- For Mapbox: a [Mapbox access token](https://docs.mapbox.com/help/getting-started/access-tokens/)
- Backend/API base URL and any third-party keys your build expects

## Setup

1. **Clone** the repository and open the project root (`car-comfort`).

2. **Create `.env`** in the project root (same folder as `pubspec.yaml`). The app loads it at startup via `EnvService`. Required keys (see `lib/app/utils/env_service.dart`):

   - `BASE_URL` — API base URL  
   - `MAPBOX_ACCESS_TOKEN` — used in `main.dart` for `MapboxOptions.setAccessToken`
   - `STRIPE_PUBLISHABLE_KEY` — used for Stripe card/wallet payment method creation in app
   - `STRIPE_APPLE_MERCHANT_IDENTIFIER` — optional; required for Apple Pay (e.g. `merchant.com.yourapp`)
   - `ONESIGNAL_API_KEY` — optional (OneSignal init is currently disabled)

   Example shape (replace with real values):

   ```env
   BASE_URL=https://api.example.com
   MAPBOX_ACCESS_TOKEN=your_mapbox_token
   STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   STRIPE_APPLE_MERCHANT_IDENTIFIER=merchant.com.example.carcomfort
   ONESIGNAL_API_KEY=your_onesignal_key
   ```

   > Do not put `STRIPE_SECRET_KEY` in the mobile `.env`. Keep it server-side only.

3. **Install dependencies**

   ```bash
   flutter pub get
   ```

4. **Generated code** — if you change assets or add flutter_gen outputs, run:

   ```bash
   dart run build_runner build --delete-conflicting-outputs
   ```

   (Use the commands your team already uses for `flutter_gen` / JSON code generation if they differ.)

5. **Run**

   ```bash
   flutter run
   ```

   For web:

   ```bash
   flutter run -d chrome
   ```

## Development notes

- **Routing**: New screens are registered in `lib/app/routes/app_pages.dart` (and route names in `app_routes.dart` when using Get CLI conventions).
- **iOS**: After adding pods or native deps, run `pod install` under `ios/` as usual for Flutter.
- **Launcher icons**: Configured via `flutter_launcher_icons` in `pubspec.yaml`.

## Resources

- [Flutter documentation](https://docs.flutter.dev/)
- [GetX](https://pub.dev/packages/get)
- [Mapbox Maps Flutter](https://pub.dev/packages/mapbox_maps_flutter)
