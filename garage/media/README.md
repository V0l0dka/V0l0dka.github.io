# media for the garage page

Video, audio and stills live here. Nothing in this folder is generated - it is
all footage you provide, re-encoded for the web.

## why not GIF

A GIF is capped at 256 colours and is decoded frame by frame on the CPU. A ten
second 1080p clip lands somewhere around 40-80 MB and the forest greens band
visibly. The same clip as H.264 is 2-4 MB, keeps full colour, and is decoded by
the phone's dedicated video hardware - which also means it does not flatten the
battery.

A muted, autoplaying, looping `<video>` behaves exactly like a GIF on the page:
it starts by itself, repeats forever, has no controls, and makes no sound. Every
browser allows this **as long as it is muted**. Unmuted autoplay is blocked, and
that rule is not negotiable.

## the files the page expects

| filename          | what it is                                     |
| ----------------- | ---------------------------------------------- |
| `loop.mp4`        | the background loop, H.264                     |
| `loop.webm`       | same clip, VP9 - smaller, not universal        |
| `loop-poster.jpg` | first frame, shown before the video is ready   |
| `garage-theme.mp3`| optional background music                      |

The poster matters more than it looks. Video does not begin painting until
enough of it has downloaded; without a poster the page is a black rectangle for
the first second or two.

## making a seamless loop

The join is the whole problem. A clip that ends somewhere different from where
it started produces a visible jump every few seconds, and the eye catches it
immediately.

Two ways to solve it:

**1. Find a genuinely cyclic section.** Leaves moving in wind, light flickering.
Trim so the last frame looks close to the first. Best quality, needs luck.

**2. Boomerang it.** Play the clip forwards then backwards. The join is perfect
by construction, and on ambient footage - foliage, haze, slow camera drift -
nobody notices the reversal. It doubles the length for free. This is the
reliable option.

```bash
# 1. cut the section you want, without re-encoding, so it stays lossless
ffmpeg -ss 00:00:12 -to 00:00:20 -i source.mp4 -c copy cut.mp4

# 2. forwards + backwards, joined
ffmpeg -i cut.mp4 -filter_complex "[0]reverse[r];[0][r]concat=n=2:v=1[v]" -map "[v]" -an boomerang.mp4
```

`-an` drops the audio: background video on a web page must be silent, and
carrying an unused audio track just adds weight.

## encoding for the web

```bash
# H.264 - plays everywhere
ffmpeg -i boomerang.mp4 -vf "scale=1600:-2" -c:v libx264 -crf 26 -preset slow \
       -pix_fmt yuv420p -profile:v high -movflags +faststart -an loop.mp4

# VP9 - roughly 30% smaller, most browsers but not all
ffmpeg -i boomerang.mp4 -vf "scale=1600:-2" -c:v libvpx-vp9 -crf 34 -b:v 0 \
       -row-mt 1 -an loop.webm

# poster frame
ffmpeg -i loop.mp4 -frames:v 1 -q:v 3 loop-poster.jpg
```

What each flag is doing, since these are the ones worth understanding:

- `scale=1600:-2` - a background is blurred by motion and covered by content, so
  1600 px wide is plenty. `-2` keeps the aspect ratio and forces an even number,
  which H.264 requires.
- `-crf 26` - the quality dial. Lower is better and bigger. 23 to 28 is the
  useful range; background footage tolerates 26-28 because nobody studies it.
- `-pix_fmt yuv420p` - without this, some encodes produce a file Safari and
  older Android refuse to play at all. Non-negotiable for web video.
- `-movflags +faststart` - moves the index to the front of the file so playback
  can start before the download finishes. Without it the poster sits there until
  the whole file has arrived.

**Target: under 4 MB for `loop.mp4`.** Everyone who opens the page downloads it,
and it stays in git history permanently once committed. Check with `du -h`
before committing, not after.

## removing people from a shot

There is no tool here that can paint them out - that needs generative
inpainting, which this setup does not have. The options that actually exist:

- Use a take where nobody walked into frame.
- Crop them out, if they are near an edge: `-vf "crop=1080:1920:420:0"` where the
  numbers are width, height, x offset, y offset.
- Pick a moment in the clip before they walk in, even if it is only two seconds.
  Two seconds boomeranged is four, and four seconds of foliage loops fine.

## audio

The AUDIO button plays `garage-theme.mp3`. If the file is absent the button says
so and everything else works.

```bash
ffmpeg -i original.wav -c:a libmp3lame -b:a 160k garage-theme.mp3
```

Note that this site is public. Putting a commercially licensed track here is
publishing a copy of it, not private listening, and GitHub acts on DMCA notices
against Pages sites. Free Music Archive and the YouTube Audio Library both have
filters for tracks that permit reuse. Your call - record what you used below.

| track | artist | source | licence |
| ----- | ------ | ------ | ------- |
|       |        |        |         |
