/* ============================================================
   THE ASSET MAP

   Every path the site uses is declared here and nowhere else.
   To move, swap or add a photograph you edit this file only.

   Filenames are the lowercased stems of the camera originals, so
   `2015_1.JPG` becomes `2015_1`. tools/build-assets.sh produces a
   .jpg and a .webp for every still; the page requests .webp first
   and falls back to .jpg on browsers that cannot take it.
   ============================================================ */

const PHOTO_DIR = '/assets/photos';
const VIDEO_DIR = '/assets/videos';

export const photo = (name) => ({
  webp: `${PHOTO_DIR}/${name}.webp`,
  jpg: `${PHOTO_DIR}/${name}.jpg`,
});

export const video = (name) => ({
  mp4: `${VIDEO_DIR}/${name}.mp4`,
  poster: `${VIDEO_DIR}/${name}-poster.jpg`,
});

/* ------------------------------------------------------------
   CHAPTER 03 - THE ARCHIVE

   `provisional: true` marks a year whose images were chosen by
   eye, not by a date in the filename. 2021 and 2023 have no dated
   assets at all, so whatever sits there is a guess - swap the
   `media` entries freely.

   `empty: true` years are deliberately blank. 2024 and 2025 carry
   the story precisely by having nothing in them. Do not "fix"
   them by adding a photograph.
   ------------------------------------------------------------ */
export const ARCHIVE = [
  {
    year: '2015',
    caption: 'всё только начинается',
    media: [photo('2015'), photo('2015-0'), photo('2015_1'), photo('2015_2')],
  },
  {
    year: '2016',
    caption: 'характер начинает формироваться',
    media: [photo('2016'), photo('2016_1')],
  },
  {
    year: '2017',
    caption: 'становится интереснее',
    media: [photo('2017'), photo('2017_1')],
  },
  {
    year: '2018',
    caption: 'появляются первые признаки',
    media: [photo('2018')],
  },
  {
    year: '2019',
    caption: 'ну тут уже всё понятно',
    media: [video('2019')],
  },
  {
    year: '2020',
    caption: 'процесс уже необратим',
    media: [photo('2020')],
  },
  {
    year: '2021',
    caption: '',
    provisional: true,
    media: [photo('img_8299'), photo('img_0029')],
  },
  {
    year: '2022',
    caption: 'появляется тяга к СВО',
    media: [photo('2022'), photo('2022_1')],
  },
  {
    year: '2023',
    caption: 'дальше событий становится слишком много, чтобы вести нормальный архив',
    provisional: true,
    media: [photo('img_4208'), photo('img_1425'), photo('img_2940')],
  },
  { year: '2024', empty: true },
  { year: '2025', empty: true },
];

/* The comeback. Deliberately separate from the loop above - it gets
   its own pinned, slow reveal rather than an archive row. */
export const REVEAL_2026 = photo('2026');

/* ------------------------------------------------------------
   CHAPTER 04 - ACTIVITIES

   One cinematic panel each. `media` may be a photo or a video.
   These pairings were made by looking at the pictures, not by
   filename, so treat them as a starting point.
   ------------------------------------------------------------ */
export const ACTIVITIES = [
  { id: 'photoshoot', label: 'ФОТОСЕССИЯ', media: photo('img_0831'), kind: 'photo' },

  // New photograph. The previous travel shot (img_0353) is no longer
  // shown in this chapter; the file stays in assets/photos.
  { id: 'travel', label: 'ПУТЕШЕСТВИЯ', media: photo('trips'), kind: 'photo' },

  // Same photograph as before, relabelled: it was ВЕЙКБОРД and is
  // now ДАЙВИНГ. The picture itself is untouched.
  { id: 'diving', label: 'ДАЙВИНГ', media: photo('img_8752'), kind: 'photo' },

  // The beach shot that used to carry the ДАЙВИНГ label. It is two
  // blokes on a beach, so it gets the label it deserves.
  { id: 'muzhlany', label: 'МУЖЛАНЫ', media: photo('img_8746'), kind: 'photo' },

  { id: 'surron', label: 'SUR-RON', media: photo('img_8660'), kind: 'photo' },
  { id: 'hookah', label: 'КАЛЬЯН', media: video('img_0572'), kind: 'video' },
  { id: 'metan', label: 'METAN', media: video('img_1433'), kind: 'video' },

  // New photograph takes the snowboard slot...
  { id: 'snow', label: 'СНОУБОРД', media: photo('snowboard'), kind: 'photo' },

  // ...and the clip that used to be here keeps its place in the
  // montage, immediately after, under a more honest label.
  { id: 'violence', label: 'НАСИЛИЕ', media: video('img_8672'), kind: 'video' },
];

/* Smoke exhale. Used as the visual bridge from HOOKAH into the
   black screen that opens the statistics chapter. */
export const SMOKE_BRIDGE = video('2019');

/* ------------------------------------------------------------
   CHAPTER 05 - STATISTICS
   `detail` is revealed on click, in place, without navigating.
   ------------------------------------------------------------ */
export const STATS = [
  {
    id: 'hookah',
    value: '554',
    plus: true,
    label: 'КАЛЬЯНОВ',
    note: 'минимальная оценка',
    detail: '≈1 в неделю × 52 недели × 10 лет (2016–2026) = 520. Плюс то, что не считали.',
    kind: 'breakdown',
  },
  {
    id: 'countries',
    value: 'ХУЕВА ТУЧА',
    label: 'СТРАН',
    note: 'осталась Америка, Малибу',
    detail: 'Список неполный. Он всегда неполный.',
    kind: 'text',
  },
  {
    id: 'events',
    value: '200',
    plus: true,
    label: 'СОБЫТИЙ',
    detail: '',
    kind: 'particles',
  },
  {
    id: 'injuries',
    value: '60',
    plus: true,
    label: 'ТРАВМ',
    detail: 'ВЫЖИВАЕМОСТЬ: ПОДОЗРИТЕЛЬНО ВЫСОКАЯ',
    kind: 'text',
  },
  {
    id: 'decisions',
    value: '∞',
    label: 'РЕШЕНИЙ',
    note: 'нескончаемо',
    detail: '',
    kind: 'infinite',
  },
];

/* ------------------------------------------------------------
   CHAPTER 10 - FINAL
   The message itself is intentionally left for you to write.
   ------------------------------------------------------------ */
export const FINAL_PHOTO = photo('img_8753');

/* Assets the first screen must not wait for the scroll to load. */
export const PRELOAD = [REVEAL_2026.webp, photo('2015').webp];
