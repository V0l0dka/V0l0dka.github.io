/* ============================================================
   04 - ACTIVITIES

   A montage, not a gallery. Each activity is a full-bleed panel
   with its label sitting over the picture, alternating sides.

   Videos here are muted, looping and only play while on screen -
   eight autoplaying clips at once would stall a phone.
   ============================================================ */

import { $, $$, el, picture, loopVideo, autoplayInView } from './dom.js';
import { ACTIVITIES } from './assets.js';

export function buildActivities() {
  const root = $('[data-activities]');
  if (!root) return;

  for (const item of ACTIVITIES) {
    const media = item.kind === 'video'
      ? loopVideo(item.media)
      : picture(item.media, { alt: item.label });

    root.append(
      el('article', { class: 'activity', 'data-activity': item.id },
        el('div', { class: 'activity__media' }, media),
        el('div', { class: 'activity__scrim' }),
        el('h3', { class: 'activity__label', text: item.label }),
      ),
    );
  }

  playOnlyWhatIsVisible();
}

/* Start a clip when its panel is on screen, pause it when it is not.
   Without this every video decodes continuously for the whole scroll,
   which is the single biggest battery cost on a page like this.

   These are the heaviest files on the site - the hookah clip alone is
   1.1 MB - so they get the longest run-up of anything on the page. */
function playOnlyWhatIsVisible() {
  autoplayInView($$('.activity video'), { margin: '1600px 0px 1600px 0px' });
}
