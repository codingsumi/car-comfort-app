# App Settings API Documentation

## Base URL
```
/api/admin/settings
```

## Authentication
All settings endpoints require admin authentication via Bearer token.

```
Authorization: Bearer <admin_jwt_token>
```

## Rate Limiting
- 30 requests per minute per IP

---

## Endpoints

### 1. Get All Settings

**GET** `/api/admin/settings`

Returns all settings grouped by category.

**Response:**
```json
{
  "status": "success",
  "message": "Settings fetched successfully",
  "error_type": null,
  "data": {
    "general": {
      "app_name": {
        "key": "app_name",
        "value": "Car Comfort",
        "type": "text",
        "label": "App Name",
        "description": "The name of your application",
        "is_sensitive": false,
        "group_name": "general",
        "sort_order": 1
      }
    },
    "stripe": { ... },
    "onesignal": { ... },
    "email": { ... },
    "social_links": { ... },
    "finance": { ... },
    "theme": { ... },
    "invoice": { ... }
  }
}
```

**Note:** Sensitive values (secret keys, passwords) are masked in the response.

---

### 2. Get Settings by Group

**GET** `/api/admin/settings/:group`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| group | string | Yes | One of: `general`, `stripe`, `onesignal`, `email`, `social_links`, `finance`, `theme`, `invoice` |

**Response:**
```json
{
  "status": "success",
  "message": "stripe settings fetched",
  "data": {
    "stripe_publishable_key": {
      "key": "stripe_publishable_key",
      "value": "pk_test_...",
      "type": "text",
      "label": "Publishable Key",
      "description": "Stripe publishable (public) key",
      "is_sensitive": false,
      "group_name": "stripe",
      "sort_order": 1
    },
    "stripe_secret_key": {
      "key": "stripe_secret_key",
      "value": "sk_t••••••••st_x",
      "type": "password",
      "label": "Secret Key",
      "description": "Stripe secret key (encrypted)",
      "is_sensitive": true,
      "group_name": "stripe",
      "sort_order": 2
    }
  }
}
```

---

### 3. Update Settings by Group

**PUT** `/api/admin/settings/:group`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| group | string | Yes | Setting group name |

**Body:** JSON object with key-value pairs for the group.

**Example - Update General Settings:**
```json
{
  "app_name": "My Car Comfort",
  "support_email": "help@example.com",
  "timezone": "America/Chicago"
}
```

**Example - Update Stripe Settings:**
```json
{
  "stripe_publishable_key": "pk_live_...",
  "stripe_secret_key": "sk_live_...",
  "stripe_payment_mode": "live"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "stripe settings updated successfully",
  "data": { ... }
}
```

**Validation Errors (400):**
```json
{
  "statusCode": 400,
  "error_type": "validation_error",
  "message": "Validation error",
  "details": [
    { "field": "support_email", "message": "Must be a valid email" }
  ]
}
```

---

### 4. Upload File (Logo/Favicon)

**POST** `/api/admin/settings/upload`

**Content-Type:** `multipart/form-data`

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | Image file (JPEG, PNG, GIF, SVG, WebP, ICO) |

**Constraints:**
- Max file size: 5MB
- Allowed types: JPEG, PNG, GIF, SVG, WebP, ICO

**Response:**
```json
{
  "status": "success",
  "message": "File uploaded successfully",
  "data": {
    "url": "http://localhost:4001/uploads/settings/setting-1715670000000-123456789.png",
    "filename": "setting-1715670000000-123456789.png"
  }
}
```

---

### 5. Get Audit Logs

**GET** `/api/admin/settings/audit-logs`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 20, max: 100) |
| group | string | No | Filter by group name |

**Response:**
```json
{
  "status": "success",
  "message": "Audit logs fetched",
  "data": {
    "logs": [
      {
        "id": 1,
        "user_id": 1,
        "group_name": "stripe",
        "setting_key": "stripe_payment_mode",
        "old_value": "test",
        "new_value": "live",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2026-05-14T10:30:00.000Z",
        "user": {
          "id": 1,
          "name": "Admin User",
          "email": "admin@example.com"
        }
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "total_pages": 3
    }
  }
}
```

---

## Setting Groups Reference

### General (`general`)
| Key | Type | Sensitive |
|-----|------|-----------|
| app_name | text | No |
| app_logo | image | No |
| app_favicon | image | No |
| support_email | email | No |
| contact_number | text | No |
| address | text | No |
| default_language | text | No |
| default_currency | text | No |
| timezone | text | No |

### Stripe (`stripe`)
| Key | Type | Sensitive |
|-----|------|-----------|
| stripe_publishable_key | text | No |
| stripe_secret_key | password | Yes |
| stripe_webhook_secret | password | Yes |
| stripe_connected_account_enabled | boolean | No |
| stripe_payment_mode | text | No |

### OneSignal (`onesignal`)
| Key | Type | Sensitive |
|-----|------|-----------|
| onesignal_app_id | text | No |
| onesignal_rest_api_key | password | Yes |
| onesignal_user_auth_key | password | Yes |

### Email / SMTP (`email`)
| Key | Type | Sensitive |
|-----|------|-----------|
| smtp_host | text | No |
| smtp_port | number | No |
| smtp_username | text | No |
| smtp_password | password | Yes |
| smtp_encryption | text | No |
| smtp_from_email | email | No |
| smtp_from_name | text | No |

### Social Links (`social_links`)
| Key | Type | Sensitive |
|-----|------|-----------|
| social_facebook | url | No |
| social_instagram | url | No |
| social_youtube | url | No |
| social_linkedin | url | No |
| social_twitter | url | No |

### Finance (`finance`)
| Key | Type | Sensitive |
|-----|------|-----------|
| default_tax_percentage | number | No |
| default_commission_percentage | number | No |
| currency_symbol | text | No |

### Theme / UI (`theme`)
| Key | Type | Sensitive |
|-----|------|-----------|
| theme_primary_color | color | No |
| theme_secondary_color | color | No |
| theme_sidebar_style | text | No |
| theme_dark_mode_enabled | boolean | No |
| theme_logo_light | image | No |
| theme_logo_dark | image | No |

### Invoice (`invoice`)
| Key | Type | Sensitive |
|-----|------|-----------|
| invoice_company_name | text | No |
| invoice_gst_vat_number | text | No |
| invoice_email | email | No |
| invoice_phone | text | No |
| invoice_address | text | No |
| invoice_footer_notes | text | No |

---

## Security Notes

1. **Encryption:** All fields marked as `sensitive` are encrypted at rest using AES-256-GCM.
2. **Response Masking:** Sensitive values are masked in API responses (e.g., `sk_t••••••••st_x`).
3. **Rate Limiting:** 30 requests/minute per IP to prevent abuse.
4. **File Validation:** Uploaded files are validated for type and size.
5. **Audit Trail:** All changes are logged with user, IP, and timestamp.
6. **Permissions:** Only users with `admin` role can access these endpoints.
