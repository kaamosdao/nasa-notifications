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
TMP_DB_DUMP=""
TMP_UPLOADS_DIR=""

cleanup() {
  if [[ -n "${TMP_INVENTORY}" && -f "${TMP_INVENTORY}" ]]; then
    rm -f "${TMP_INVENTORY}"
  fi
  if [[ -n "${TMP_DB_DUMP}" && -f "${TMP_DB_DUMP}" ]]; then
    rm -f "${TMP_DB_DUMP}"
  fi
  if [[ -n "${TMP_UPLOADS_DIR}" && -d "${TMP_UPLOADS_DIR}" ]]; then
    rm -rf "${TMP_UPLOADS_DIR}"
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

  if [[ -n "${SOURCE_USER:-}" && "${SOURCE_USER}" != "root" ]]; then
    default="Y"
    non_root="${non_root:+${non_root}, }${SOURCE_USER}"
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
  prompt_required "domain (apex)" "familydom-production.snpdev.ru"
  DOMAIN="${PROMPT_VALUE}"
  prompt_required "project_user" "familydom"
  PROJECT_USER="${PROMPT_VALUE}"
  prompt_required "project_group" "${PROJECT_USER}"
  PROJECT_GROUP="${PROMPT_VALUE}"
  prompt_required "project_slug (PROJECT_SLUG)" "${PROJECT_USER}"
  PROJECT_SLUG="${PROMPT_VALUE}"
  prompt_required "project_dir on server" "/var/www/${PROJECT_USER}"
  PROJECT_DIR="${PROMPT_VALUE}"
  EXTRA_VARS+=(
    -e "domain=${DOMAIN}"
    -e "project_user=${PROJECT_USER}"
    -e "project_group=${PROJECT_GROUP}"
    -e "project_slug=${PROJECT_SLUG}"
    -e "project_dir=${PROJECT_DIR}"
  )
}

ask_production_host() {
  echo
  echo "Production host"
  prompt_required "ansible_host (IP)" "109.73.197.61"
  PROD_HOST="${PROMPT_VALUE}"
  prompt_required "ansible_user" "root"
  PROD_USER="${PROMPT_VALUE}"
}

write_inventory() {
  # write_inventory [with_source]
  local with_source="${1:-false}"
  TMP_INVENTORY="$(mktemp -t ansible-inventory.XXXXXX.ini)"

  cat >"${TMP_INVENTORY}" <<EOF
[production]
prod-1 ansible_host=${PROD_HOST} ansible_user=${PROD_USER}
EOF

  if [[ "${with_source}" == "true" ]]; then
    cat >>"${TMP_INVENTORY}" <<EOF

[source]
old-1 ansible_host=${SOURCE_HOST} ansible_user=${SOURCE_USER}
EOF
  fi

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
  write_inventory false
  echo
  run_playbook playbooks/prod-routine.yml
}

run_migrate_remote() {
  echo
  echo "→ Migrate data: remote → production"
  ask_production_host
  echo
  echo "Source host"
  prompt_required "source ansible_host (IP)"
  SOURCE_HOST="${PROMPT_VALUE}"
  prompt_required "source ansible_user" "ubuntu"
  SOURCE_USER="${PROMPT_VALUE}"

  ask_project_vars
  prompt_required "source_project_slug" "${PROJECT_SLUG}"
  SOURCE_PROJECT_SLUG="${PROMPT_VALUE}"

  ask_yes_no "Backup current prod data before import?" "Y"
  MIGRATE_BACKUP="${PROMPT_YN}"
  ask_yes_no "Stop backend/imgproxy during import?" "Y"
  MIGRATE_STOP="${PROMPT_YN}"

  EXTRA_VARS+=(
    -e "migrate_source=remote"
    -e "source_project_slug=${SOURCE_PROJECT_SLUG}"
    -e "migrate_backup=${MIGRATE_BACKUP}"
    -e "migrate_stop_services=${MIGRATE_STOP}"
  )

  ask_become
  write_inventory true
  echo
  run_playbook playbooks/migrate-data-to-prod.yml
}

run_migrate_local() {
  local db_path uploads_path postgres_container backend_container uploads_volume image_id

  echo
  echo "→ Migrate data: local → production"
  ask_production_host
  ask_project_vars

  postgres_container="${PROJECT_SLUG}_postgres"
  backend_container="${PROJECT_SLUG}_backend"
  uploads_volume="${PROJECT_SLUG}_strapi-uploads"

  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not found. Install Docker to export local Postgres and uploads."
    exit 1
  fi

  if ! docker ps --format '{{.Names}}' | grep -qx "${postgres_container}"; then
    echo "Running postgres container not found: ${postgres_container}"
    echo "Start the local stack (docker compose up) and check project_slug matches PROJECT_SLUG."
    exit 1
  fi

  if ! docker volume inspect "${uploads_volume}" >/dev/null 2>&1; then
    echo "Docker volume not found: ${uploads_volume}"
    echo "Start the local stack (docker compose up) and check project_slug matches PROJECT_SLUG."
    exit 1
  fi

  echo
  echo "Dumping local Postgres from ${postgres_container}..."
  TMP_DB_DUMP="$(mktemp -t migrate-db.XXXXXX.dump)"
  docker exec "${postgres_container}" \
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    > "${TMP_DB_DUMP}"
  db_path="${TMP_DB_DUMP}"
  echo "Dump ready: ${db_path}"

  echo
  echo "Exporting uploads from volume ${uploads_volume}..."
  TMP_UPLOADS_DIR="$(mktemp -d -t migrate-uploads.XXXXXX)"
  # Prefer docker cp from backend (volume already mounted) — no image pull.
  # Fallback: reuse the local postgres image id so Docker Hub is not needed.
  if docker ps -a --format '{{.Names}}' | grep -qx "${backend_container}"; then
    docker cp "${backend_container}:/opt/app/public/uploads/." "${TMP_UPLOADS_DIR}/"
  else
    image_id="$(docker inspect -f '{{.Image}}' "${postgres_container}")"
    docker run --rm \
      --entrypoint sh \
      -v "${uploads_volume}:/source:ro" \
      -v "${TMP_UPLOADS_DIR}:/export" \
      "${image_id}" \
      -c 'cp -a /source/. /export/'
  fi
  uploads_path="${TMP_UPLOADS_DIR}"
  echo "Uploads ready: ${uploads_path}"

  ask_yes_no "Backup current prod data before import?" "Y"
  MIGRATE_BACKUP="${PROMPT_YN}"
  ask_yes_no "Stop backend/imgproxy during import?" "Y"
  MIGRATE_STOP="${PROMPT_YN}"

  EXTRA_VARS+=(
    -e "migrate_source=local"
    -e "migrate_local_db_path=${db_path}"
    -e "migrate_local_uploads_path=${uploads_path}"
    -e "migrate_backup=${MIGRATE_BACKUP}"
    -e "migrate_stop_services=${MIGRATE_STOP}"
  )

  ask_become
  write_inventory false
  echo
  run_playbook playbooks/migrate-data-to-prod.yml
}

run_migrate() {
  echo
  echo "Migrate source:"
  echo "  1) From remote server"
  echo "  2) From local Docker (auto db.dump + uploads)"
  echo "  0) Back"
  echo
  local choice
  read -r -p "Choice [1/2/0]: " choice
  case "${choice}" in
    1) run_migrate_remote ;;
    2) run_migrate_local ;;
    0) return 0 ;;
    *)
      echo "Unknown choice: ${choice}"
      exit 1
      ;;
  esac
}

echo
echo "Ansible — ${ROOT_DIR}"
echo "=============================="
echo "  1) Setup production server"
echo "  2) Migrate data to production"
echo "  0) Exit"
echo
read -r -p "Choice [1/2/0]: " main_choice

case "${main_choice}" in
  1) run_setup ;;
  2) run_migrate ;;
  0) exit 0 ;;
  *)
    echo "Unknown choice: ${main_choice}"
    exit 1
    ;;
esac
