#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANSIBLE_DIR="${REPO_ROOT}/deploy/ansible"

fatal() {
  printf "[error] %s\n" "$1" >&2
  exit 1
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    fatal "Run as root: sudo bash ./deploy/ubuntu24-host-install.sh"
  fi
}

check_os() {
  if [[ ! -f /etc/os-release ]]; then
    fatal "Cannot detect operating system"
  fi
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID}" != "ubuntu" || "${VERSION_ID}" != "24.04" ]]; then
    fatal "This deploy entrypoint supports Ubuntu 24.04 only"
  fi
}

install_ansible() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ansible rsync
}

main() {
  require_root
  check_os
  install_ansible

  local vars_file="${ANSIBLE_DIR}/group_vars/all.yml"
  if [[ ! -f "${vars_file}" ]]; then
    cp "${ANSIBLE_DIR}/group_vars/all.yml.example" "${vars_file}"
    fatal "Created ${vars_file}. Fill it and rerun: sudo bash ./deploy/ubuntu24-host-install.sh"
  fi

  ANSIBLE_CONFIG="${ANSIBLE_DIR}/ansible.cfg" ansible-playbook \
    -i "${ANSIBLE_DIR}/inventory.ini" \
    "${ANSIBLE_DIR}/site.yml"
}

main "$@"
