#!/usr/bin/env bash
#
# Generate the small "easter egg" loops used by js/media.js.
#
#     bash tools/build-external.sh
#
# Everything here is SYNTHESISED by ffmpeg from noise and maths.
# Nothing is downloaded, so there is no third-party material in
# the repo and nothing to license. Outputs go to
# assets/external/reactions/ and are committed.
#
# They are deliberately monochrome apart from the acid green, so
# they sit inside the site's palette instead of fighting it.

set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$repo/assets/external/reactions"
mkdir -p "$out"

command -v ffmpeg >/dev/null || { echo "ffmpeg not installed. Run: sudo apt install ffmpeg" >&2; exit 1; }

# Shared encode settings. These are decorative loops a few hundred
# pixels wide, so quality can be low and the files tiny.
enc=(-c:v libx264 -crf 36 -preset slow -pix_fmt yuv420p -movflags +faststart -an)

# NOTE ON SIZE
# Per-pixel random noise is the worst case for a video codec: every
# frame is uncorrelated with the last, so nothing can be predicted
# and the file balloons (a 320x180 full-resolution version of the
# static below came out at 444 KB for three seconds).
#
# So the noise is generated COARSE - a fraction of final size - and
# scaled up with nearest-neighbour. That gives chunky digital
# corruption, which reads better here than fine TV snow anyway, and
# compresses roughly 10x smaller because each block is flat.

# --- 1. dead-channel static, for 2024 "архив повреждён" ---------
# geq generates each luma pixel from random(); chroma pinned to 128
# keeps it neutral grey rather than coloured confetti.
ffmpeg -y -loglevel error \
  -f lavfi -i "nullsrc=s=80x45:r=10:d=3,geq=lum='random(1)*255':cb=128:cr=128,scale=320:180:flags=neighbor" \
  "${enc[@]}" "$out/static.mp4"

# --- 2. horizontal tear, for 2025 ERROR 404 ---------------------
# Scanline structure plus noise: bright rows punched through
# low-level grain, so it reads as a broken signal not TV snow.
ffmpeg -y -loglevel error \
  -f lavfi -i "nullsrc=s=80x45:r=10:d=3,geq=lum='if(lt(mod(Y+random(1)*3\,5),1),210+random(1)*45,random(1)*40)':cb=128:cr=128,scale=320:180:flags=neighbor" \
  "${enc[@]}" "$out/glitch.mp4"

# --- 3. pulse trace, for 60+ ТРАВМ ------------------------------
# An audio waveform rendered as a line. The source is a decaying
# sine pulse twice a second, which draws as a heartbeat. Coloured
# acid green, then the silent audio track is dropped.
ffmpeg -y -loglevel error \
  -f lavfi -i "aevalsrc='0.7*sin(2*PI*t*30)*exp(-9*mod(t*2\,1))':d=4:s=44100" \
  -filter_complex "showwaves=s=480x120:mode=line:rate=25:colors=0xD7FF00,format=yuv420p" \
  "${enc[@]}" "$out/pulse.mp4"

echo "generated:"
du -h "$out"/*.mp4

# ===============================================================
# PROVIDED MEDIA
#
# Converts the reaction GIFs, TMNT clips, cut-out PNGs and Sur-Ron
# stills that live outside the repo. Set SRC to point at them:
#
#     SRC="/mnt/c/Users/Volodka/Desktop/miracle" bash tools/build-external.sh
#
# Skipped silently when SRC is absent, so the procedural loops above
# can still be rebuilt on a machine without the originals.
# ===============================================================

SRC="${SRC:-/mnt/c/Users/Volodka/Desktop/miracle}"
[[ -d "$SRC" ]] || { echo; echo "SRC not found ($SRC) - skipping provided media."; exit 0; }

ext="$repo/assets/external"
mkdir -p "$ext"/{reactions,tmnt,surron,hookah,diving,gift}

# --- GIF -> MP4 -------------------------------------------------
# The supplied GIFs total ~58 MB. None of them uses transparency
# (checked: every one is a fully opaque rectangle), so MP4 is safe
# and lands roughly 20x smaller. A GIF is 256 colours decoded frame
# by frame on the CPU; the MP4 keeps full colour and is decoded by
# video hardware, which is what keeps a phone from getting hot.
#
# fps=18 and 420px wide: these play at thumbnail size in the layout,
# so the source resolution is far past what is visible.
gif2mp4() {
  local in="$1" out_file="$2"
  [[ -f "$in" ]] || { echo "  MISSING $in"; return; }
  ffmpeg -y -loglevel error -i "$in" \
    -vf "fps=18,scale=420:-2:flags=lanczos" \
    -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p \
    -movflags +faststart -an "$out_file"
}

echo
echo "reaction clips:"
for pair in \
  "reaction1.gif:reactions/reaction1.mp4" \
  "reaction2.gif:reactions/reaction2.mp4" \
  "reaction3.gif:reactions/reaction3.mp4" \
  "absurd1.gif:reactions/absurd1.mp4" \
  "absurd2.gif:reactions/absurd2.mp4" \
  "celebration1.gif:reactions/celebration1.mp4" \
  "celebretion2.gif:reactions/celebration2.mp4" \
  "fail1.gif:reactions/fail1.mp4" \
  "fail2.gif:reactions/fail2.mp4" \
  "TMNT1.gif:tmnt/tmnt1.mp4" \
  "TMNT2.gif:tmnt/tmnt2.mp4" \
  "TMNT3.gif:tmnt/tmnt3.mp4" \
  "reveal.gif:tmnt/reveal.mp4" ; do
  gif2mp4 "$SRC/${pair%%:*}" "$ext/${pair##*:}"
  echo "  ${pair##*:}"
done

# --- cut-out PNGs ----------------------------------------------
# These six are genuine cut-outs: 38-75% of their pixels are fully
# transparent. That alpha is the whole point - the hookah stands on
# the game's own background, the diving objects sit in the water -
# so they must NOT go through the JPEG path used for photographs.
#
# Written as lossy WebP, which keeps the alpha channel at roughly a
# third of the PNG size, plus the PNG itself as a fallback.
cutout() {
  local in="$1" name="$2" dir="$3" max="${4:-900}"
  [[ -f "$in" ]] || { echo "  MISSING $in"; return; }
  local vf="scale='min(iw,$max)':-2:flags=lanczos"
  ffmpeg -y -loglevel error -i "$in" -vf "$vf" -c:v libwebp -quality 82 \
         -compression_level 6 "$ext/$dir/$name.webp"
  ffmpeg -y -loglevel error -i "$in" -vf "$vf" "$ext/$dir/$name.png"
  echo "  $dir/$name"
}

echo
echo "cut-outs:"
cutout "$SRC/hookah.png"          hookah    hookah 620
cutout "$SRC/Revo.png"            revo      diving 420
cutout "$SRC/keys.png"            keys      diving 420
cutout "$SRC/earrings.png"        earring   diving 420
cutout "$SRC/present.png"         present   gift   1200
cutout "$SRC/sur-ron силуэт.png"  silhouette surron 900

# --- Sur-Ron stills (opaque photographs) -----------------------
echo
echo "sur-ron stills:"
for n in 1 2 3 4 5; do
  f="$SRC/sur-ron$n.jpg"
  [[ -f "$f" ]] || { echo "  MISSING $f"; continue; }
  ffmpeg -y -loglevel error -i "$f" -vf "scale='min(iw,900)':-2:flags=lanczos" \
         -c:v libwebp -quality 80 "$ext/surron/surron$n.webp"
  ffmpeg -y -loglevel error -i "$f" -vf "scale='min(iw,900)':-2:flags=lanczos" \
         -q:v 4 "$ext/surron/surron$n.jpg"
  echo "  surron/surron$n"
done

echo
echo "external total: $(du -sh "$ext" | cut -f1)"
