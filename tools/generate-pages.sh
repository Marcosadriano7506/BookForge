#!/usr/bin/env bash
set -euo pipefail
PDF="${1:-assets/pdf/guia-drcm-computacao.pdf}"
OUT="${2:-assets/images/pages}"
WIDTH="${WIDTH:-1600}"
QUALITY="${QUALITY:-84}"
EXPECTED="${EXPECTED_PAGES:-26}"
test -f "$PDF" || { echo "Erro: PDF não encontrado: $PDF" >&2; exit 1; }
mkdir -p "$OUT"
rm -f "$OUT"/page-*.webp

if command -v pdftoppm >/dev/null && command -v cwebp >/dev/null; then
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  pdftoppm -png -r 180 "$PDF" "$tmp/page" >/dev/null 2>&1
  n=0
  for source in "$tmp"/page-*.png; do
    n=$((n+1)); target=$(printf '%s/page-%03d.webp' "$OUT" "$n")
    cwebp -quiet -q "$QUALITY" -resize "$WIDTH" 0 "$source" -o "$target"
  done
elif command -v pdftoppm >/dev/null && command -v convert >/dev/null; then
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  pdftoppm -png -r 180 "$PDF" "$tmp/page" >/dev/null 2>&1
  n=0
  for source in "$tmp"/page-*.png; do
    n=$((n+1)); target=$(printf '%s/page-%03d.webp' "$OUT" "$n")
    convert "$source" -resize "${WIDTH}x" -quality "$QUALITY" "$target"
  done
elif python3 - <<'PY' >/dev/null 2>&1
import fitz
from PIL import Image
PY
then
  python3 - "$PDF" "$OUT" "$WIDTH" "$QUALITY" <<'PY'
import sys
from io import BytesIO
from pathlib import Path
import fitz
from PIL import Image
pdf, out, width, quality = sys.argv[1], Path(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
doc = fitz.open(pdf)
for index, page in enumerate(doc, 1):
    pix = page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), alpha=False)
    image = Image.open(BytesIO(pix.tobytes('png')))
    height = round(image.height * width / image.width)
    image.resize((width, height), Image.Resampling.LANCZOS).save(out / f'page-{index:03d}.webp', 'WEBP', quality=quality, method=6)
PY
else
  echo 'Erro: instale pdftoppm+cwebp, pdftoppm+ImageMagick ou Python com PyMuPDF+Pillow.' >&2
  exit 1
fi

count=$(find "$OUT" -maxdepth 1 -type f -name 'page-*.webp' | wc -l)
[[ "$count" -eq "$EXPECTED" ]] || { echo "Erro: esperadas $EXPECTED páginas, geradas $count." >&2; exit 1; }
for n in $(seq 1 "$EXPECTED"); do
  file=$(printf '%s/page-%03d.webp' "$OUT" "$n")
  [[ -s "$file" ]] || { echo "Erro: arquivo ausente ou vazio: $file" >&2; exit 1; }
done
echo "$EXPECTED páginas WebP geradas e validadas em $OUT."
