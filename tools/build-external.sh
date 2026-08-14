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
