#!/usr/bin/env bash
#
# Turn the two phone clips into web-ready files for /congrats/.
#
# Run it from anywhere:
#     bash congrats/media/encode.sh
#
# It reads the .MOV originals out of garage/media/ and writes
# video-1.mp4, video-2.mp4 and their poster frames into this folder.
# Re-running it overwrites those outputs. The originals are never
# touched, and they are never committed - see .gitignore.

set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
src="$repo/garage/media"
out="$repo/congrats/media"

# Which original becomes which slide. Swap the two filenames to swap
# the order they appear in the deck.
declare -A CLIP=(
  [video-1]="$src/IMG_5495.MOV"   # 24s - slide 3, "A message"
  [video-2]="$src/IMG_5489.MOV"   # 73s - slide 6, "And one more"
)

command -v ffmpeg >/dev/null || {
  echo "ffmpeg is not installed. Run:  sudo apt install ffmpeg" >&2
  exit 1
}

for name in video-1 video-2; do
  in="${CLIP[$name]}"
  [[ -f "$in" ]] || { echo "missing source: $in" >&2; exit 1; }

  echo "==> $name  <-  $(basename "$in")"

  # -map 0:v:0 -map 0:a:0
  #     These iPhone files carry SIX extra tracks: a second audio track in
  #     Apple's spatial-audio codec (apac) plus five timed-metadata tracks.
  #     Without an explicit map, ffmpeg may pick the spatial track - which
  #     browsers cannot decode - and the video plays silently. Take exactly
  #     one video and one ordinary AAC audio track, drop the rest.
  # hqdn3d=2:1:3:3
  #     A light denoise. This footage is handheld and grainy, and grain is
  #     random - the encoder cannot predict it, so it spends a large share
  #     of the bitrate storing noise. Smoothing it first is what takes
  #     these files from ~35 MB to ~10 MB with no visible quality loss.
  # scale=720:-2
  #     The clips are 1080x1920 held upright. ffmpeg applies the rotation
  #     automatically, so this scales the upright frame to 720 px wide.
  #     -2 keeps the aspect ratio and forces an even height, which H.264
  #     requires. The frame is at most ~370 px wide on screen, so 720
  #     still looks sharp on a 2x retina display.
  # -crf 27 -maxrate 2200k -bufsize 4400k
  #     CRF is the quality dial: lower looks better and weighs more.
  #     On its own CRF gives no size guarantee - a busy scene can spike to
  #     7 Mbps. maxrate caps that spike, which is what makes the output
  #     size predictable instead of a surprise.
  # -pix_fmt yuv420p
  #     Without it some encodes produce a file Safari refuses to play.
  # -movflags +faststart
  #     Puts the index at the front so playback starts before the download
  #     finishes. Without it the viewer stares at the poster frame.
  ffmpeg -y -loglevel warning -i "$in" \
    -map 0:v:0 -map 0:a:0 \
    -vf "hqdn3d=2:1:3:3,scale=720:-2" \
    -c:v libx264 -crf 27 -preset slow -profile:v high -pix_fmt yuv420p \
    -maxrate 2200k -bufsize 4400k \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    "$out/$name.mp4"

  # Poster frame at 1s. The page shows this until the video is playable;
  # without it the slide is a black rectangle on first open.
  # -update 1 tells the image muxer this is one still, not a numbered
  # sequence. Without it ffmpeg warns on every run.
  # The poster is only ever seen for a moment, so it is written at half
  # width - a 400 KB still would cost more to download than it is worth.
  ffmpeg -y -loglevel warning -ss 1 -i "$out/$name.mp4" \
    -frames:v 1 -update 1 -vf "scale=540:-2" -q:v 5 \
    "$out/$name-poster.jpg"
done

echo
echo "done. sizes:"
du -h "$out"/video-*.mp4 "$out"/video-*-poster.jpg
echo
echo "Budget: each .mp4 should be under 20 MB. GitHub hard-rejects any"
echo "single file over 100 MB, and whatever you commit stays in git"
echo "history permanently - deleting it later does not shrink the repo."
