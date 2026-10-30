#!/usr/bin/env bash
set -euo pipefail

# Car Comfort auth+driver signup API smoke script
# Usage:
#   chmod +x signup_flow_test.sh
#   BASE_URL="https://node.carcomfort.betaplanets.com" \
#   CUSTOMER_EMAIL="john.customer+$(date +%s)@knoxweb.us" \
#   CUSTOMER_PHONE="9492649001" \
#   DRIVER_EMAIL="driver.customer+$(date +%s)@knoxweb.us" \
#   DRIVER_PHONE="9492649002" \
#   ./signup_flow_test.sh
#
# Optional vars:
#   CUSTOMER_PASSWORD (default: sR123456)
#   DRIVER_PASSWORD   (default: sR123456)
#   DRIVER_FIRST_NAME (default: Driver)
#   DRIVER_LAST_NAME  (default: User)
#   CUSTOMER_FIRST_NAME (default: John)
#   CUSTOMER_LAST_NAME  (default: Customer)
#   DRIVER_TSHIRT_SIZE (default: L)
#   DRIVER_ADDRESS (default: 123 Main St, Mountain View, CA 94040)
#   VEHICLE_MAKE/MODEL/YEAR/COLOR/TYPE/LICENSE_PLATE
#   INS_PROVIDER/INS_POLICY/INS_EXPIRY/INS_COVERAGE
#   DRIVERS_LICENSE_FRONT/DRIVERS_LICENSE_BACK
#   INSURANCE_CARD_FRONT/INSURANCE_CARD_BACK
#   VEHICLE_REG_FRONT/VEHICLE_REG_BACK
#   FLOW (default: both) -> customer | driver | both
#   SKIP_DRIVER_DOCUMENT_UPLOADS (default: false) -> true | false

BASE_URL="${BASE_URL:-https://node.carcomfort.betaplanets.com}"
FLOW="${FLOW:-both}"
SKIP_DRIVER_DOCUMENT_UPLOADS="${SKIP_DRIVER_DOCUMENT_UPLOADS:-false}"

CUSTOMER_FIRST_NAME="${CUSTOMER_FIRST_NAME:-John}"
CUSTOMER_LAST_NAME="${CUSTOMER_LAST_NAME:-Customer}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-john.customer.$(date +%s)@knoxweb.us}"
UNIQUE_SUFFIX="$(date +%s | tail -c 7)"
CUSTOMER_PHONE="${CUSTOMER_PHONE:-9492${UNIQUE_SUFFIX}}"
CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-sR123456}"

DRIVER_FIRST_NAME="${DRIVER_FIRST_NAME:-Driver}"
DRIVER_LAST_NAME="${DRIVER_LAST_NAME:-User}"
DRIVER_EMAIL="${DRIVER_EMAIL:-driver.user.$(date +%s)@knoxweb.us}"
DRIVER_PHONE="${DRIVER_PHONE:-9493${UNIQUE_SUFFIX}}"
DRIVER_PASSWORD="${DRIVER_PASSWORD:-sR123456}"
DRIVER_TSHIRT_SIZE="${DRIVER_TSHIRT_SIZE:-L}"
DRIVER_ADDRESS="${DRIVER_ADDRESS:-123 Main St, Mountain View, CA 94040}"

VEHICLE_MAKE="${VEHICLE_MAKE:-Toyota}"
VEHICLE_MODEL="${VEHICLE_MODEL:-Camry}"
VEHICLE_YEAR="${VEHICLE_YEAR:-2021}"
VEHICLE_COLOR="${VEHICLE_COLOR:-Black}"
VEHICLE_TYPE="${VEHICLE_TYPE:-Sedan}"
VEHICLE_LICENSE_PLATE="${VEHICLE_LICENSE_PLATE:-ABC1234}"

INS_PROVIDER="${INS_PROVIDER:-Geico}"
INS_POLICY="${INS_POLICY:-POL1234}"
INS_EXPIRY="${INS_EXPIRY:-2027-01-01}"
INS_COVERAGE="${INS_COVERAGE:-Full}"

DRIVERS_LICENSE_FRONT="${DRIVERS_LICENSE_FRONT:-/Users/mohitkumar/Downloads/abc.png}"
DRIVERS_LICENSE_BACK="${DRIVERS_LICENSE_BACK:-/Users/mohitkumar/Downloads/abc.png}"
INSURANCE_CARD_FRONT="${INSURANCE_CARD_FRONT:-/Users/mohitkumar/Downloads/abc.png}"
INSURANCE_CARD_BACK="${INSURANCE_CARD_BACK:-/Users/mohitkumar/Downloads/abc.png}"
VEHICLE_REG_FRONT="${VEHICLE_REG_FRONT:-/Users/mohitkumar/Downloads/abc.png}"
VEHICLE_REG_BACK="${VEHICLE_REG_BACK:-/Users/mohitkumar/Downloads/abc.png}"

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

need() {
  command -v "$1" >/dev/null 2>&1 || {
    red "Missing required command: $1"
    exit 1
  }
}

need curl
need python3

json_get() {
  local key="$1"
  python3 -c '
import json,sys
key=sys.argv[1]
try:
    data=json.load(sys.stdin)
except Exception:
    print("")
    sys.exit(0)
parts=key.split(".")
cur=data
for p in parts:
    if isinstance(cur, dict):
        cur=cur.get(p)
    else:
        cur=None
    if cur is None:
        break
if cur is None:
    print("")
elif isinstance(cur, (dict,list)):
    print(json.dumps(cur))
else:
    print(str(cur))
' "$key"
}

post_json() {
  local url="$1"
  local body="$2"
  local auth="${3:-}"
  if [[ -n "$auth" ]]; then
    curl --silent --show-error --location \
      --request POST "$url" \
      --header 'Content-Type: application/json' \
      --header "Authorization: Bearer $auth" \
      --data-raw "$body"
  else
    curl --silent --show-error --location \
      --request POST "$url" \
      --header 'Content-Type: application/json' \
      --data-raw "$body"
  fi
}

post_form() {
  local url="$1"
  local auth="$2"
  shift 2
  curl --silent --show-error --location \
    --request POST "$url" \
    --header "Authorization: Bearer $auth" \
    "$@"
}

print_step() {
  yellow "------------------------------------------------------------"
  yellow "$1"
  yellow "------------------------------------------------------------"
}

require_file() {
  local p="$1"
  local label="$2"
  if [[ -z "$p" || ! -f "$p" ]]; then
    red "Missing file for $label. Set path in env var."
    red "Current value: ${p:-<empty>}"
    exit 1
  fi
}

print_step "1) Customer register"
customer_register_body=$(cat <<EOF
{
  "first_name":"$CUSTOMER_FIRST_NAME",
  "last_name":"$CUSTOMER_LAST_NAME",
  "email":"$CUSTOMER_EMAIL",
  "phone":"$CUSTOMER_PHONE",
  "password":"$CUSTOMER_PASSWORD",
  "role":"customer",
  "agreed_to_terms": true
}
EOF
)
if [[ "$FLOW" == "both" || "$FLOW" == "customer" ]]; then
  customer_register_res="$(post_json "$BASE_URL/api/auth/register" "$customer_register_body")"
  echo "$customer_register_res"
  customer_token="$(printf '%s' "$customer_register_res" | json_get "data.token")"
  if [[ -z "$customer_token" ]]; then
    red "Customer register failed (token missing)."
    exit 1
  fi
  green "Customer token received."
fi

print_step "2) Customer verify OTP (manual input)"
if [[ "$FLOW" == "both" || "$FLOW" == "customer" ]]; then
  read -r -p "Enter customer OTP for $CUSTOMER_EMAIL: " CUSTOMER_OTP
  customer_verify_body=$(cat <<EOF
{
  "otp": $CUSTOMER_OTP
}
EOF
  )
  customer_verify_res="$(post_json "$BASE_URL/api/auth/verify-otp" "$customer_verify_body" "$customer_token")"
  echo "$customer_verify_res"
  green "Customer OTP verify request sent."
fi

print_step "3) Driver register (Auth register API, role=driver)"
driver_register_body=$(cat <<EOF
{
  "first_name":"$DRIVER_FIRST_NAME",
  "last_name":"$DRIVER_LAST_NAME",
  "email":"$DRIVER_EMAIL",
  "phone":"$DRIVER_PHONE",
  "password":"$DRIVER_PASSWORD",
  "role":"driver",
  "agreed_to_terms": true
}
EOF
)
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
  driver_register_res="$(post_json "$BASE_URL/api/auth/register" "$driver_register_body")"
  echo "$driver_register_res"
  driver_token="$(printf '%s' "$driver_register_res" | json_get "data.token")"
  if [[ -z "$driver_token" ]]; then
    red "Driver register failed (token missing)."
    exit 1
  fi
  green "Driver token received."
fi

print_step "4) Driver step 2"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
driver_step2_body=$(cat <<EOF
{
  "tshirt_size":"$DRIVER_TSHIRT_SIZE",
  "address":"$DRIVER_ADDRESS"
}
EOF
)
echo "$(post_json "$BASE_URL/api/driver/step/2" "$driver_step2_body" "$driver_token")"
fi

print_step "5) Driver documents - license"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
  if [[ "$SKIP_DRIVER_DOCUMENT_UPLOADS" == "true" ]]; then
    yellow "Skipping driver license upload (SKIP_DRIVER_DOCUMENT_UPLOADS=true)"
  else
    require_file "$DRIVERS_LICENSE_FRONT" "drivers_license_front"
    require_file "$DRIVERS_LICENSE_BACK" "drivers_license_back"
    echo "$(post_form "$BASE_URL/api/driver/documents" "$driver_token" \
      -F "drivers_license_front=@$DRIVERS_LICENSE_FRONT" \
      -F "drivers_license_back=@$DRIVERS_LICENSE_BACK")"
  fi
fi

print_step "6) Driver step 4 vehicle info"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
driver_step4_body=$(cat <<EOF
{
  "vehicle_make":"$VEHICLE_MAKE",
  "vehicle_model":"$VEHICLE_MODEL",
  "vehicle_year":$VEHICLE_YEAR,
  "vehicle_color":"$VEHICLE_COLOR",
  "vehicle_type":"$VEHICLE_TYPE",
  "vehicle_license_plate":"$VEHICLE_LICENSE_PLATE"
}
EOF
)
echo "$(post_json "$BASE_URL/api/driver/step/4" "$driver_step4_body" "$driver_token")"
fi

print_step "7) Driver step 5 insurance info"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
driver_step5_body=$(cat <<EOF
{
  "insurance_provider_name":"$INS_PROVIDER",
  "insurance_policy_number":"$INS_POLICY",
  "insurance_expiration_date":"$INS_EXPIRY",
  "coverage_type":"$INS_COVERAGE"
}
EOF
)
echo "$(post_json "$BASE_URL/api/driver/step/5" "$driver_step5_body" "$driver_token")"
fi

print_step "8) Driver documents - insurance card"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
  if [[ "$SKIP_DRIVER_DOCUMENT_UPLOADS" == "true" ]]; then
    yellow "Skipping insurance card upload (SKIP_DRIVER_DOCUMENT_UPLOADS=true)"
  else
    require_file "$INSURANCE_CARD_FRONT" "insurance_card_front"
    require_file "$INSURANCE_CARD_BACK" "insurance_card_back"
    echo "$(post_form "$BASE_URL/api/driver/documents" "$driver_token" \
      -F "insurance_card_front=@$INSURANCE_CARD_FRONT" \
      -F "insurance_card_back=@$INSURANCE_CARD_BACK")"
  fi
fi

print_step "9) Driver documents - vehicle registration"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
  if [[ "$SKIP_DRIVER_DOCUMENT_UPLOADS" == "true" ]]; then
    yellow "Skipping vehicle registration upload (SKIP_DRIVER_DOCUMENT_UPLOADS=true)"
  else
    require_file "$VEHICLE_REG_FRONT" "vehicle_registration_front"
    require_file "$VEHICLE_REG_BACK" "vehicle_registration_back"
    echo "$(post_form "$BASE_URL/api/driver/documents" "$driver_token" \
      -F "vehicle_registration_front=@$VEHICLE_REG_FRONT" \
      -F "vehicle_registration_back=@$VEHICLE_REG_BACK")"
  fi
fi

print_step "10) Driver step 8 background consent"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
  echo "$(post_json "$BASE_URL/api/driver/step/8" '{"background_check_consent":true}' "$driver_token")"
fi

print_step "11) Driver request verification OTP"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
  echo "$(post_form "$BASE_URL/api/driver/request-verification-otp" "$driver_token")"
fi

print_step "12) Driver verify OTP (manual input)"
if [[ "$FLOW" == "both" || "$FLOW" == "driver" ]]; then
  read -r -p "Enter driver OTP for $DRIVER_EMAIL: " DRIVER_OTP
  driver_verify_body=$(cat <<EOF
{
  "otp":"$DRIVER_OTP"
}
EOF
  )
  echo "$(post_json "$BASE_URL/api/driver/verify-otp" "$driver_verify_body" "$driver_token")"
fi

green "Flow completed. Review each response above for 'status: success'."
