#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v ansible-playbook >/dev/null 2>&1; then
  echo "ansible-playbook not found. Install Ansible first."
  exit 1
fi

EXTRA_ARGS=()
EXTRA_VARS=()
TMP_INVENTORY=""

cleanup() {
  if [[ -n "${TMP_INVENTORY}" && -f "${TMP_INVENTORY}" ]]; then
    rm -f "${TMP_INVENTORY}"
  fi
}
trap cleanup EXIT

sanitize_value() {
  # Все значения здесь — хосты, пользователи, slug'и и пути, то есть чистый ASCII.
  # Случайный невидимый байт (сочетание с Option на Mac, копипаста из мессенджера)
  # незаметен на экране, но ломает всё дальше по цепочке: ssh пытается зайти
  # пользователем `\201creators`, а сервер отвечает "Permission denied (publickey,password)",
  # и причина выглядит как проблема доступа, хотя дело во вводе.
  # Поэтому режем управляющие и не-ASCII символы, обрезаем краевые пробелы —
  # и обязательно сообщаем, если что-то удалили.
  local raw="$1" clean
  clean="$(printf '%s' "${raw}" | LC_ALL=C tr -cd '\11\40-\176')"
  clean="${clean#"${clean%%[![:space:]]*}"}"
  clean="${clean%"${clean##*[![:space:]]}"}"

  if [[ "${clean}" != "${raw}" ]]; then
    echo "  ! очищено от посторонних символов → '${clean}'" >&2
  fi

  printf '%s' "${clean}"
}

prompt() {
  # prompt "Label" "default" → writes answer to PROMPT_VALUE
  local label="$1"
  local default="${2:-}"
  local value
  if [[ -n "${default}" ]]; then
    read -r -p "${label} [${default}]: " value
    value="${value:-$default}"
  else
    read -r -p "${label}: " value
  fi
  PROMPT_VALUE="$(sanitize_value "${value}")"
}

prompt_required() {
  prompt "$@"
  if [[ -z "${PROMPT_VALUE}" ]]; then
    echo "Value is required."
    exit 1
  fi
}

ask_yes_no() {
  # ask_yes_no "Question" "Y"|"N" → sets PROMPT_YN to true|false
  local label="$1"
  local default="${2:-Y}"
  local hint reply
  if [[ "${default}" == "Y" ]]; then
    hint="Y/n"
  else
    hint="y/N"
  fi
  read -r -p "${label} [${hint}]: " reply
  reply="${reply:-$default}"
  case "${reply}" in
    y|Y|yes|YES) PROMPT_YN=true ;;
    *) PROMPT_YN=false ;;
  esac
}

ask_become() {
  # Playbooks run with `become: true`. As root no sudo password is needed; as any other
  # user it IS needed unless NOPASSWD sudo is configured on the server — otherwise the run
  # dies on the first task with "Missing sudo password".
  # So the default follows the connection user instead of always being "N".
  local default="N" non_root=""

  if [[ "${PROD_USER:-root}" != "root" ]]; then
    default="Y"
    non_root="${PROD_USER}"
  fi

  if [[ "${default}" == "Y" ]]; then
    echo
    echo "Connecting as non-root (${non_root}); tasks run through sudo (become: true)."
    echo "Answer 'n' only if NOPASSWD sudo is configured for that user."
  fi

  ask_yes_no "Ask sudo password on remote?" "${default}"
  if [[ "${PROMPT_YN}" == "true" ]]; then
    EXTRA_ARGS+=(--ask-become-pass)
  fi
}

ask_project_vars() {
  echo
  echo "Project settings"
  prompt_required "domain" "gcn.testing-nasa-notifications.com"
  DOMAIN="${PROMPT_VALUE}"
  # project_user обязан совпадать с секретом SSH_USER в GitHub Actions: CI ходит на сервер
  # именно этим пользователем и выкладывает релиз в /var/www/<SSH_USER>.
  prompt_required "project_user (= SSH_USER в GitHub Actions)" "nasa-notifications"
  PROJECT_USER="${PROMPT_VALUE}"
  prompt_required "project_group" "${PROJECT_USER}"
  PROJECT_GROUP="${PROMPT_VALUE}"
  prompt_required "project_slug (PROJECT_SLUG)" "nasa-notifications"
  PROJECT_SLUG="${PROMPT_VALUE}"

  # project_dir здесь НЕ спрашиваем: плейбук выводит его как /var/www/{{ project_user }},
  # ровно как workflow выводит REMOTE_DIR как /var/www/<SSH_USER>. Отдельный вопрос делал бы
  # каталог вторым независимым источником правды — и позволял бы ему молча разойтись
  # с каталогом деплоя. Нестандартный путь остаётся доступен при ручном запуске:
  # -e "project_dir=/своё/место".
  EXTRA_VARS+=(
    -e "domain=${DOMAIN}"
    -e "project_user=${PROJECT_USER}"
    -e "project_group=${PROJECT_GROUP}"
    -e "project_slug=${PROJECT_SLUG}"
  )
}

ask_production_host() {
  echo
  echo "Production host"
  prompt_required "ansible_host (IP)"
  PROD_HOST="${PROMPT_VALUE}"
  prompt_required "ansible_user" "root"
  PROD_USER="${PROMPT_VALUE}"
}

write_inventory() {
  TMP_INVENTORY="$(mktemp -t ansible-inventory.XXXXXX.ini)"

  cat >"${TMP_INVENTORY}" <<EOF
[production]
prod-1 ansible_host=${PROD_HOST} ansible_user=${PROD_USER}
EOF

  EXTRA_ARGS+=(-i "${TMP_INVENTORY}")
}

run_playbook() {
  local playbook="$1"
  ansible-playbook "${playbook}" "${EXTRA_ARGS[@]}" "${EXTRA_VARS[@]}"
}

run_setup() {
  echo
  echo "→ Production server setup (prod-routine.yml)"
  ask_production_host
  ask_project_vars
  ask_become
  write_inventory
  echo
  run_playbook playbooks/prod-routine.yml
}

echo
echo "Ansible — ${ROOT_DIR}"
echo "=============================="
echo "  1) Setup production server"
echo "  0) Exit"
echo
read -r -p "Choice [1/0]: " main_choice

case "${main_choice}" in
  1) run_setup ;;
  0) exit 0 ;;
  *)
    echo "Unknown choice: ${main_choice}"
    exit 1
    ;;
esac
