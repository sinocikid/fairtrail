#!/usr/bin/env bash
set -euo pipefail

# Smoke tests that run inside a fresh Debian container.
# Validates install.sh behavior without Docker-in-Docker.

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf "${GREEN}PASS${RESET} %s\n" "$1"; }
fail() { FAIL=$((FAIL + 1)); printf "${RED}FAIL${RESET} %s -- %s\n" "$1" "$2"; }

echo ""
printf "${BOLD}Debian install smoke tests${RESET}\n"
echo ""

# ──────────────────────────────────────────────────────────────────
# Test 1: PATH patching writes to both .bashrc and .profile
# ──────────────────────────────────────────────────────────────────
test_path_patching() {
  # Set up: ensure .bashrc exists (Debian default), no .bash_profile
  echo "# default bashrc" > "$HOME/.bashrc"
  echo "# default profile" > "$HOME/.profile"
  rm -f "$HOME/.bash_profile"

  # Extract just the PATH-patching section from install.sh and run it.
  # We simulate the condition where ~/.local/bin is NOT in PATH.
  local snippet
  snippet=$(sed -n '/^# Ensure ~\/.local\/bin is in PATH/,/^fi$/p' /home/testuser/install.sh)

  # Run the snippet with PATH that does NOT contain .local/bin
  (
    export HOME="$HOME"
    export INSTALL_BIN="$HOME/.local/bin"
    export PATH="/usr/bin:/bin"
    export SHELL="/bin/bash"
    # Source helper functions needed by the snippet
    ok() { true; }
    warn() { true; }
    BOLD="" RESET=""
    export -f ok warn
    eval "$snippet"
  )

  # Verify .bashrc was patched
  if grep -qF '.local/bin' "$HOME/.bashrc"; then
    pass "PATH patched in .bashrc"
  else
    fail "PATH NOT patched in .bashrc" "grep found nothing"
  fi

  # Verify .profile was also patched (the SSH login shell fix)
  if grep -qF '.local/bin' "$HOME/.profile"; then
    pass "PATH patched in .profile"
  else
    fail "PATH NOT patched in .profile" "SSH login shells won't find fairtrail"
  fi
}

# ──────────────────────────────────────────────────────────────────
# Test 2: Duplicate PATH entries are not added
# ──────────────────────────────────────────────────────────────────
test_no_duplicate_path() {
  # Set up: .bashrc and .profile already have .local/bin
  echo '# default bashrc' > "$HOME/.bashrc"
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
  echo '# default profile' > "$HOME/.profile"
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.profile"

  local snippet
  snippet=$(sed -n '/^# Ensure ~\/.local\/bin is in PATH/,/^fi$/p' /home/testuser/install.sh)

  (
    export HOME="$HOME"
    export INSTALL_BIN="$HOME/.local/bin"
    export PATH="/usr/bin:/bin"
    export SHELL="/bin/bash"
    ok() { true; }
    warn() { true; }
    BOLD="" RESET=""
    export -f ok warn
    eval "$snippet"
  )

  local count_bashrc count_profile
  count_bashrc=$(grep -cF '.local/bin' "$HOME/.bashrc")
  count_profile=$(grep -cF '.local/bin' "$HOME/.profile")

  if [ "$count_bashrc" -eq 1 ]; then
    pass "No duplicate PATH in .bashrc"
  else
    fail "Duplicate PATH in .bashrc" "found $count_bashrc entries"
  fi

  if [ "$count_profile" -eq 1 ]; then
    pass "No duplicate PATH in .profile"
  else
    fail "Duplicate PATH in .profile" "found $count_profile entries"
  fi
}

# ──────────────────────────────────────────────────────────────────
# Test 3: PATH is available in SSH login shell (bash -l)
# ──────────────────────────────────────────────────────────────────
test_login_shell_path() {
  # Set up clean files and patch them
  echo "# default bashrc" > "$HOME/.bashrc"
  echo "# default profile" > "$HOME/.profile"
  rm -f "$HOME/.bash_profile"

  local snippet
  snippet=$(sed -n '/^# Ensure ~\/.local\/bin is in PATH/,/^fi$/p' /home/testuser/install.sh)

  (
    export HOME="$HOME"
    export INSTALL_BIN="$HOME/.local/bin"
    export PATH="/usr/bin:/bin"
    export SHELL="/bin/bash"
    ok() { true; }
    warn() { true; }
    BOLD="" RESET=""
    export -f ok warn
    eval "$snippet"
  )

  # Create a dummy fairtrail binary
  mkdir -p "$HOME/.local/bin"
  echo '#!/bin/bash' > "$HOME/.local/bin/fairtrail"
  echo 'echo "fairtrail-ok"' >> "$HOME/.local/bin/fairtrail"
  chmod +x "$HOME/.local/bin/fairtrail"

  # Test: can a login shell find fairtrail?
  local result
  result=$(bash -l -c 'command -v fairtrail 2>/dev/null || echo "not-found"')

  if [ "$result" != "not-found" ]; then
    pass "Login shell (bash -l) finds fairtrail in PATH"
  else
    fail "Login shell (bash -l) cannot find fairtrail" "This is the SSH session bug"
  fi

  rm -rf "$HOME/.local"
}

# ──────────────────────────────────────────────────────────────────
# Test 4: Old ~/fairtrail dir gets renamed
# ──────────────────────────────────────────────────────────────────
test_old_dir_migration() {
  # Create fake old install dir
  mkdir -p "$HOME/fairtrail"
  echo "version: '3'" > "$HOME/fairtrail/docker-compose.yml"
  rm -rf "$HOME/.fairtrail"

  # The migration section of install.sh:
  # - Should rename ~/fairtrail to ~/fairtrail.old-backup in non-interactive mode
  local snippet
  snippet=$(sed -n '/^if \[ -d "\$HOME\/fairtrail" \]/,/^fi$/p' /home/testuser/install.sh)

  (
    export HOME="$HOME"
    export FAIRTRAIL_DIR="$HOME/.fairtrail"
    export FAIRTRAIL_YES=1  # non-interactive
    # Mock docker compose (not available in this container)
    DC="echo"
    info() { true; }
    ok() { true; }
    warn() { true; }
    BOLD="" DIM="" RESET=""
    export -f info ok warn
    eval "$snippet"
  )

  if [ -d "$HOME/fairtrail.old-backup" ]; then
    pass "Old ~/fairtrail renamed to ~/fairtrail.old-backup"
  else
    fail "Old ~/fairtrail not renamed" "directory should have been moved"
  fi

  if [ ! -d "$HOME/fairtrail" ]; then
    pass "Original ~/fairtrail no longer exists"
  else
    fail "Original ~/fairtrail still exists" "should have been moved"
  fi

  # Cleanup
  rm -rf "$HOME/fairtrail" "$HOME/fairtrail.old-backup" "$HOME/.fairtrail"
}

# ──────────────────────────────────────────────────────────────────
# Test 5: fairtrail-cli update uses command -v, not hardcoded path
# ──────────────────────────────────────────────────────────────────
test_cli_update_path() {
  local cli="/home/testuser/fairtrail-cli"

  # Check cmd_update function uses command -v
  if grep -A5 'cmd_update' "$cli" | grep -q 'command -v fairtrail'; then
    pass "CLI update uses 'command -v' for self-path detection"
  else
    fail "CLI update hardcodes path" "should use command -v"
  fi

  # Check it doesn't swallow curl errors
  local update_section
  update_section=$(sed -n '/^cmd_update/,/^cmd_/p' "$cli")
  local curl_line
  curl_line=$(echo "$update_section" | grep 'curl.*fairtrail-cli' | head -1)
  if echo "$curl_line" | grep -q '2>/dev/null'; then
    fail "CLI update swallows curl errors" "2>/dev/null found on download line"
  else
    pass "CLI update shows curl errors"
  fi
}

# ──────────────────────────────────────────────────────────────────
# Test 6: Generated .env includes HOST_PORT documentation
# ──────────────────────────────────────────────────────────────────
test_env_host_port() {
  local installer="/home/testuser/install.sh"
  if grep -q 'HOST_PORT=' "$installer" && grep -q 'do NOT set PORT' "$installer"; then
    pass "Generated .env documents HOST_PORT and warns about PORT"
  else
    fail "install.sh missing HOST_PORT documentation" "users will set PORT by mistake"
  fi
}

# ──────────────────────────────────────────────────────────────────
# Run all
# ──────────────────────────────────────────────────────────────────
test_path_patching
test_no_duplicate_path
test_login_shell_path
test_old_dir_migration
test_cli_update_path
test_env_host_port

echo ""
printf "${BOLD}Results: ${GREEN}%d passed${RESET}, ${RED}%d failed${RESET}\n" "$PASS" "$FAIL"
echo ""
[ "$FAIL" -eq 0 ] || exit 1
