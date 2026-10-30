#!/usr/bin/env bash
set -euo pipefail

# Login + Forgot Password flow test script
#
# Usage:
#   chmod +x login_forgot_flow_test.sh
#   BASE_URL="https://node.carcomfort.betaplanets.com" \
#   TEST_EMAIL="john.customer@knoxweb.us" \
#   TEST_PASSWORD="sR123456" \
#   ./login_forgot_flow_test.sh
#
# Optional:
#   FLOW=both|login|forgot|logout    (default: both)
#   NEW_PASSWORD="sR1234567"
#   CONFIRM_PASSWORD="sR1234567"
#   LOGIN_TOKEN="existing_jwt_token"
#   RUN_LOGIN_VALIDATION_CASES=1|0       (default: 1)

BASE_URL="${BASE_URL:-https://node.carcomfort.betaplanets.com}"
FLOW="${FLOW:-both}"

TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
LOGIN_TOKEN="${LOGIN_TOKEN:-}"

NEW_PASSWORD="${NEW_PASSWORD:-sR1234567}"
CONFIRM_PASSWORD="${CONFIRM_PASSWORD:-sR1234567}"
RUN_LOGIN_VALIDATION_CASES="${RUN_LOGIN_VALIDATION_CASES:-1}"

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

if [[ -z "$TEST_EMAIL" ]]; then
  red "TEST_EMAIL is required."
  exit 1
fi

if [[ "$FLOW" == "both" || "$FLOW" == "login" || "$FLOW" == "logout" ]]; then
  if [[ "$FLOW" == "logout" && -n "$LOGIN_TOKEN" ]]; then
    :
  elif [[ -z "$TEST_EMAIL" ]]; then
    red "TEST_EMAIL is required for login/logout flow."
    exit 1
  fi
fi

if [[ "$FLOW" == "both" || "$FLOW" == "forgot" ]]; then
  if [[ -z "$TEST_EMAIL" ]]; then
    red "TEST_EMAIL is required for forgot flow."
    exit 1
  fi
fi

if [[ "$FLOW" == "both" || "$FLOW" == "login" || "$FLOW" == "logout" ]]; then
  if [[ -z "$TEST_PASSWORD" ]]; then
    if [[ "$FLOW" == "logout" && -n "$LOGIN_TOKEN" ]]; then
      :
    else
      red "TEST_PASSWORD is required for login/logout flow (unless LOGIN_TOKEN is provided for logout)."
      exit 1
    fi
  fi
fi

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

print_step() {
  yellow "------------------------------------------------------------"
  yellow "$1"
  yellow "------------------------------------------------------------"
}

print_case() {
  yellow "[CASE] $1"
}

login_status_ok() {
  local res="$1"
  local status
  status="$(printf '%s' "$res" | json_get "status" | tr '[:upper:]' '[:lower:]')"
  [[ "$status" == "success" || "$status" == "true" ]]
}

run_login_case_expect_fail() {
  local title="$1"
  local email="$2"
  local password="$3"
  local body
  local res
  local msg

  print_case "$title (expect fail)"
  body=$(cat <<EOF
{
  "email": "$email",
  "password": "$password"
}
EOF
)
  res="$(post_json "$BASE_URL/api/auth/login" "$body")"
  echo "$res"
  msg="$(printf '%s' "$res" | json_get "message")"

  if login_status_ok "$res"; then
    red "Expected failure but got success for case: $title"
    exit 1
  fi
  green "Validation failed as expected${msg:+ -> $msg}"
}

run_login_case_expect_success() {
  local email="$1"
  local password="$2"
  local body
  local res
  local token

  print_case "Valid email + valid password (expect success)"
  body=$(cat <<EOF
{
  "email": "$email",
  "password": "$password"
}
EOF
)
  res="$(post_json "$BASE_URL/api/auth/login" "$body")"
  echo "$res"

  token="$(printf '%s' "$res" | json_get "data.token")"
  if [[ -z "$token" ]]; then
    red "Valid login failed (token missing)."
    exit 1
  fi
  green "Valid login passed."
  printf '%s' "$token"
}

login_token="$LOGIN_TOKEN"

if [[ "$FLOW" == "both" || "$FLOW" == "login" || "$FLOW" == "logout" ]]; then
  if [[ -n "$login_token" ]]; then
    print_step "1) Login (skipped: using LOGIN_TOKEN)"
    green "Using provided LOGIN_TOKEN for logout flow."
  else
  print_step "1) Login"

  if [[ "$RUN_LOGIN_VALIDATION_CASES" == "1" ]]; then
    run_login_case_expect_fail "Empty email and empty password" "" ""
    run_login_case_expect_fail "Invalid email format" "abc" "$TEST_PASSWORD"
    run_login_case_expect_fail "Correct email but wrong password" "$TEST_EMAIL" "Wrong@123"
    run_login_case_expect_fail "Unknown email with valid password" "unknown.$(date +%s)@example.com" "$TEST_PASSWORD"
  fi

  login_token="$(run_login_case_expect_success "$TEST_EMAIL" "$TEST_PASSWORD")"
  fi
fi

if [[ "$FLOW" == "both" || "$FLOW" == "forgot" ]]; then
  print_step "2) Forgot Password"
  forgot_body=$(cat <<EOF
{
  "email": "$TEST_EMAIL"
}
EOF
)
  forgot_res="$(post_json "$BASE_URL/api/auth/forgot-password" "$forgot_body")"
  echo "$forgot_res"

  print_step "3) Verify Reset OTP (manual input)"
  read -r -p "Enter reset OTP for $TEST_EMAIL: " RESET_OTP
  verify_reset_body=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "otp": "$RESET_OTP"
}
EOF
)
  verify_reset_res="$(post_json "$BASE_URL/api/auth/verify-reset-otp" "$verify_reset_body")"
  echo "$verify_reset_res"
  reset_token="$(printf '%s' "$verify_reset_res" | json_get "data.reset_token")"
  if [[ -z "$reset_token" ]]; then
    red "verify-reset-otp response has no data.reset_token."
    read -r -p "Paste reset token manually (or press Enter to skip reset-password): " reset_token
  fi

  if [[ -n "${reset_token:-}" ]]; then
    print_step "4) Reset Password"
    reset_body=$(cat <<EOF
{
  "reset_token": "$reset_token",
  "new_password": "$NEW_PASSWORD",
  "confirm_password": "$CONFIRM_PASSWORD"
}
EOF
)
    reset_res="$(post_json "$BASE_URL/api/auth/reset-password" "$reset_body")"
    echo "$reset_res"
  else
    yellow "Skipping reset-password because reset token was unavailable."
  fi
fi

if [[ "$FLOW" == "both" || "$FLOW" == "logout" ]]; then
  print_step "5) Logout"
  if [[ -z "${login_token:-}" ]]; then
    red "Logout skipped: token unavailable. Provide LOGIN_TOKEN or valid login credentials."
  else
    logout_res="$(post_json "$BASE_URL/api/auth/logout" "{}" "$login_token")"
    echo "$logout_res"
    green "Logout request sent."
  fi
fi

green "Flow execution complete."
