#!/bin/bash

# Define colors
GREEN="\e[32m"
RED="\e[31m"
CYAN="\e[36m"
YELLOW="\e[33m"
RESET="\e[0m"

# Function to run a command and track its success or failure
run_command() {
    echo -e "${CYAN}====== Running: $1 ======${RESET}"
    eval $1
    if [ $? -eq 0 ]; then
        RESULTS+=("${GREEN}$1: SUCCESS${RESET}")
    else
        RESULTS+=("${RED}$1: FAILED${RESET}")
    fi
}

# Function to display header
display_header() {
    echo -e "\n${YELLOW}================================${RESET}"
    echo -e "${YELLOW}  Crust & Q SETUP SCRIPT${RESET}"
    echo -e "${YELLOW}================================${RESET}\n"
}

# Array to store results
RESULTS=()

# Display header
display_header

echo -e "${CYAN}Starting Car Comfort app configuration...${RESET}\n"

# Run commands for Crust & Q setup
run_command "dart run change_app_package_name:main 'io.carcomfort.app'"
run_command "dart run rename_app:main all='Car Comfort'"
run_command "dart run flutter_native_splash:create"
run_command "dart run flutter_launcher_icons"
run_command "flutterfire configure -p Car Comfort"

# Additional setup commands for Crust & Q
echo -e "\n${CYAN}====== Additional Setup Commands ======${RESET}"
run_command "flutter clean"
run_command "flutter pub get"

# Generate assets if flutter_gen is configured
if grep -q "flutter_gen_runner:" pubspec.yaml; then
    run_command "fluttergen"
fi

# Display summary results
echo -e "\n${CYAN}====== Setup Summary ======${RESET}"
for result in "${RESULTS[@]}"; do
    echo -e "$result"
done

echo -e "\n${GREEN}Car Comfort setup completed!${RESET}"
echo -e "${YELLOW}Next steps:${RESET}"
echo -e "1. Configure Firebase (if needed): flutterfire configure"
echo -e "2. Set up environment variables"
echo -e "3. Configure API endpoints"
echo -e "4. Test the app: flutter run"

# Hold for 5 seconds
sleep 5