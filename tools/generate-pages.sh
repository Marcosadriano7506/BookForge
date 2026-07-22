#!/usr/bin/env bash
set -euo pipefail
PDF="${1:-assets/pdf/guia-drcm-computacao.pdf}"
OUT="${2:-assets/images/pages}"
WIDTH="${WIDTH:-1600}"
QUALITY="${QUALITY:-84}"
command -v pdftoppm >/dev/null || { echo 'Erro: pdftoppm não encontrado.' >&2; exit 1; }
command -v cwebp >/dev/null || { echo 'Erro: cwebp não encontrado.' >&2; exit 1; }
test -f "$PDF" || { echo "Erro: PDF não encontrado: $PDF" >&2; exit 1; }
mkdir -p "$OUT"; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
pdftoppm -png -r 180 "$PDF" "$tmp/page" >/dev/null 2>&1
n=0
for source in "$tmp"/page-*.png; do n=$((n+1)); target=$(printf '%s/page-%03d.webp' "$OUT" "$n"); cwebp -quiet -q "$QUALITY" -resize "$WIDTH" 0 "$source" -o "$target"; done
[[ $n -eq 26 ]] || { echo "Erro: esperadas 26 páginas, geradas $n." >&2; exit 1; }
echo "26 páginas WebP geradas em $OUT."
