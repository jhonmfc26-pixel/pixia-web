#!/usr/bin/env bash
#
# deploy.sh — herramienta personal de flujo de trabajo, NO es parte del
# producto. Commitea y pushea a main; Cloudflare Pages despliega solo al
# detectar el push.
#
# Uso:
#   ./deploy.sh "mensaje del commit"
#   ./deploy.sh          (pide el mensaje por input)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "── git status ──────────────────────────────────────────────"
git status
echo "─────────────────────────────────────────────────────────────"
echo

if [ -z "$(git status --porcelain)" ]; then
  echo "No hay cambios que commitear. Nada que hacer — saliendo."
  exit 0
fi

commit_msg="${1:-}"
if [ -z "$commit_msg" ]; then
  read -r -p "Mensaje del commit: " commit_msg
fi

if [ -z "$commit_msg" ]; then
  echo "Mensaje de commit vacío — cancelado, no se hizo nada."
  exit 1
fi

git add -A
git commit -m "$commit_msg"
git push origin main

echo
echo "Push hecho. Cloudflare va a desplegar solo en unos minutos — revisa el log en el dashboard de Cloudflare Pages."
