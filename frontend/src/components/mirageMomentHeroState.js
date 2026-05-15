export function sortedMirageMomentSlides(moment) {
  const list = Array.isArray(moment?.images) ? moment.images.slice() : [];
  list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  return list;
}

export function getMirageMomentHeroState(moment) {
  const slides = sortedMirageMomentSlides(moment);
  return {
    slides,
    isEmpty: Boolean(moment) && slides.length === 0,
  };
}
