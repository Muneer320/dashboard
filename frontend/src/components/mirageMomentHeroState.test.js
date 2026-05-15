import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMirageMomentHeroState,
  sortedMirageMomentSlides,
} from './mirageMomentHeroState.js';

test('reports an empty hero when a moment has no images', () => {
  const state = getMirageMomentHeroState({
    momentId: 'moment-empty',
    title: 'Opening Frames',
    images: [],
  });

  assert.equal(state.isEmpty, true);
  assert.deepEqual(state.slides, []);
});

test('sorts moment slides by display order', () => {
  const slides = sortedMirageMomentSlides({
    images: [
      { imageId: 'late', displayOrder: 4 },
      { imageId: 'first', displayOrder: 1 },
      { imageId: 'middle', displayOrder: 2 },
    ],
  });

  assert.deepEqual(
    slides.map((slide) => slide.imageId),
    ['first', 'middle', 'late'],
  );
});
