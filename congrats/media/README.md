# media for /congrats/

Drop files here using **exactly** these names. The page looks for them by
filename. Any file that is not here yet shows as a dashed grey box naming the
file it wants, so you can always see what is still missing by opening the page.

| filename              | what it is                | shape it is cropped to |
| --------------------- | ------------------------- | ---------------------- |
| `photo-1.jpg`         | the big single photo      | 4:3 (3:4 on phones)    |
| `video-1.mp4`         | first video, slide 3      | 9:16 upright           |
| `video-1-poster.jpg`  | still shown before video 1 plays | 9:16 upright    |
| `video-2.mp4`         | second video, slide 6     | 9:16 upright           |
| `video-2-poster.jpg`  | still shown before video 2 plays | 9:16 upright    |
| `gal-1.jpg` … `gal-6.jpg` | gallery thumbnails    | square                 |
| `music.mp3`           | optional background music | -                      |

Both video slots are shaped **9:16 upright**, because the footage is
phone video held vertically. Putting a landscape clip in one of those
slots will crop its sides off - the page fills the frame, it never
stretches. If you ever swap in landscape footage, change
`frame--reel` back to `frame--video` on that slide in
`/congrats/index.html`.

## the two clips already in hand

`encode.sh` in this folder converts them. Run it once:

```bash
sudo apt install ffmpeg        # once per machine
bash congrats/media/encode.sh
```

It reads the `.MOV` originals from `garage/media/` and writes all four
video files above. The originals are gitignored on purpose: at 145 MB
and 48 MB they are far past what belongs in a repo that GitHub Pages
serves. Keep them somewhere outside the repo as your masters.

The page crops to fill, it never stretches. So the subject wants to be near the
middle of the frame.

## size limits, and why they are real

This repo is what GitHub Pages serves, so **every file here is downloaded by
whoever opens the page**, over whatever connection they have. It is also stored
in git history permanently - deleting a 200 MB video later does not shrink the
repo, the old copy stays in history forever.

Practical budget:

- photos: **under 500 KB each**, longest side 2000 px
- video: **under 20 MB**, 1080p
- whole `media/` folder: **under 100 MB**

GitHub warns above 1 GB per repo and rejects any single file over 100 MB.

## shrinking files before committing

Install once:

```bash
sudo apt install ffmpeg imagemagick
```

Compress a video (H.264, 1080p, good quality-to-size trade):

```bash
ffmpeg -i original.mov -vf "scale=-2:1080" -c:v libx264 -crf 24 -preset slow \
       -c:a aac -b:a 128k -movflags +faststart video-1.mp4
```

`-crf 24` is the quality dial: lower is better looking and bigger, higher is
smaller and blurrier. 20 to 28 is the useful range.
`-movflags +faststart` puts the index at the front of the file so the video can
start playing before it has fully downloaded. Without it the viewer stares at a
black box.

Grab a poster frame at 2 seconds in:

```bash
ffmpeg -i video-1.mp4 -ss 2 -frames:v 1 -q:v 3 video-1-poster.jpg
```

Shrink a photo:

```bash
magick original.jpg -auto-orient -resize 2000x2000\> -quality 82 photo-1.jpg
```

`-auto-orient` matters for phone photos - without it, pictures taken sideways
show up rotated.

## adding more slots

Filenames are written into `/congrats/index.html`, in the `src` attribute and in
`data-filename`. Change both to point at a different name.
