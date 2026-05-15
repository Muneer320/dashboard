import React from 'react';

import { mirage as mirageApi } from '../lib/api';
import { useUserAuth } from '../lib/UserAuthContext';
import { MirageEnrollmentCard } from './MirageEnrollmentCard';
import { MirageMomentHero } from './MirageMomentHero';
import { NavBar, PageBackground, useMobile } from './shared';

export function MirageGallery() {
  const isMobile = useMobile();
  const { user } = useUserAuth();
  const locked = !user?.is_attending;
  const [overview, setOverview] = React.useState({
    totalPhotos: 0,
    totalCollections: 0,
    dayLabels: [],
    highlights: [],
    trending: [],
    featuredCollections: [],
    collectionsByDay: [],
  });
  const [myPhotos, setMyPhotos] = React.useState([]);
  const [loadingMyPhotos, setLoadingMyPhotos] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState('All');
  const [loading, setLoading] = React.useState(!locked);
  const [loadingCollection, setLoadingCollection] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedCollectionId, setSelectedCollectionId] = React.useState(null);
  const [collectionDetail, setCollectionDetail] = React.useState(null);
  const [lightbox, setLightbox] = React.useState(null);
  const [notice, setNotice] = React.useState('');
  const [heroMoment, setHeroMoment] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [searchDetail, setSearchDetail] = React.useState(null);
  const [searchDetailLoading, setSearchDetailLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (locked) {
      setOverview({
        totalPhotos: 0,
        totalCollections: 0,
        dayLabels: [],
        highlights: [],
        trending: [],
        featuredCollections: [],
        collectionsByDay: [],
      });
      setSelectedDay('All');
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError('');
    mirageApi.overview()
      .then((data) => {
        if (cancelled) return;
        const nextOverview = data && typeof data === 'object' ? data : {
          totalPhotos: 0,
          totalCollections: 0,
          dayLabels: [],
          highlights: [],
          trending: [],
          featuredCollections: [],
          collectionsByDay: [],
        };
        setOverview(nextOverview);
        const params = new URLSearchParams(window.location.search);
        const requestedDay = params.get('day');
        const requestedCollection = params.get('collection');
        const hasRequestedDay = requestedDay && nextOverview.dayLabels?.includes(requestedDay);
        setSelectedDay(hasRequestedDay ? requestedDay : 'All');
        setSelectedCollectionId(
          requestedCollection
          || nextOverview.featuredCollections?.[0]?.id
          || nextOverview.collectionsByDay?.[0]?.collections?.[0]?.id
          || null,
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load Mirage yet.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [locked, user?.id]);

  React.useEffect(() => {
    let cancelled = false;
    if (locked) {
      setHeroMoment(null);
      return () => { cancelled = true; };
    }
    mirageApi
      .momentHero()
      .then((data) => {
        if (cancelled) return;
        setHeroMoment(data && typeof data === 'object' && data.momentId ? data : null);
      })
      .catch(() => {
        if (!cancelled) setHeroMoment(null);
      });
    return () => { cancelled = true; };
  }, [locked, user?.id]);

  React.useEffect(() => {
    let cancelled = false;
    if (locked || !user?.id) {
      setMyPhotos([]);
      return () => { cancelled = true; };
    }

    setLoadingMyPhotos(true);
    mirageApi.myPhotos()
      .then((data) => {
        if (!cancelled) setMyPhotos(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMyPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMyPhotos(false);
      });

    return () => { cancelled = true; };
  }, [locked, user?.id]);

  React.useEffect(() => {
    let cancelled = false;
    if (locked || !user?.id) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return () => { cancelled = true; };
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return () => { cancelled = true; };
    }

    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError('');
      mirageApi.searchPeople(trimmed, 8)
        .then((data) => {
          if (cancelled) return;
          setSearchResults(Array.isArray(data?.people) ? data.people : []);
        })
        .catch((err) => {
          if (cancelled) return;
          setSearchResults([]);
          setSearchError(err.message || 'Could not search Mirage participants.');
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [locked, searchQuery, user?.id]);

  React.useEffect(() => {
    let cancelled = false;
    if (!selectedCollectionId || locked) {
      setCollectionDetail(null);
      return () => { cancelled = true; };
    }

    setLoadingCollection(true);
    mirageApi.collection(selectedCollectionId)
      .then((data) => {
        if (cancelled) return;
        setCollectionDetail(data);
        const params = new URLSearchParams(window.location.search);
        const requestedPhoto = params.get('photo');
        if (requestedPhoto) {
          const match = data?.collection?.images?.find((item) => item.photoId === requestedPhoto);
          if (match) {
            setLightbox({
              ...match,
              sectionTitle: data.collection.sectionTitle,
              dayLabel: data.collection.dayLabel,
            });
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this collection.');
      })
      .finally(() => {
        if (!cancelled) setLoadingCollection(false);
      });

    return () => { cancelled = true; };
  }, [locked, selectedCollectionId]);

  React.useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const totalPhotos = overview.totalPhotos || 0;
  const dayOptions = ['All', ...(overview.dayLabels || [])];
  const visibleDayGroups = selectedDay === 'All'
    ? (overview.collectionsByDay || [])
    : (overview.collectionsByDay || []).filter((day) => day.dayLabel === selectedDay);
  const selectedCollection = collectionDetail?.collection || null;
  const allCollections = (overview.collectionsByDay || []).flatMap((group) => group.collections || []);
  const archivePulse = React.useMemo(() => buildArchivePulse(overview, myPhotos), [myPhotos, overview]);
  const hasArchiveContent = Boolean(
    totalPhotos > 0
    || (overview.highlights || []).length > 0
    || (overview.trending || []).length > 0
    || myPhotos.length > 0
    || allCollections.some((collection) =>
      (collection.imageCount || 0) > 0
      || collection.coverImage
      || (collection.previewImages || []).length > 0
      || (collection.highlightImages || []).length > 0
    )
  );

  const findPhotoState = React.useCallback((photoId) => {
    if (lightbox?.photoId === photoId) return lightbox;

    const selectedImages = selectedCollection?.images || [];
    const selectedMatch = selectedImages.find((photo) => photo.photoId === photoId);
    if (selectedMatch) return selectedMatch;

    const buckets = [
      overview.highlights || [],
      overview.trending || [],
      myPhotos || [],
      ...(overview.featuredCollections || []).map((collection) => ([
        collection.coverImage,
        ...(collection.previewImages || []),
        ...(collection.highlightImages || []),
      ])),
      ...(overview.collectionsByDay || []).map((group) =>
        (group.collections || []).flatMap((collection) => ([
          collection.coverImage,
          ...(collection.previewImages || []),
          ...(collection.highlightImages || []),
        ]))),
    ];

    for (const bucket of buckets.flat()) {
      if (bucket?.photoId === photoId) return bucket;
    }

    return null;
  }, [lightbox, myPhotos, overview, selectedCollection]);

  const syncUrlState = React.useCallback((next) => {
    const url = new URL(window.location.href);
    if (next.day) url.searchParams.set('day', next.day); else url.searchParams.delete('day');
    if (next.collection) url.searchParams.set('collection', next.collection); else url.searchParams.delete('collection');
    if (next.photo) url.searchParams.set('photo', next.photo); else url.searchParams.delete('photo');
    window.history.replaceState({}, '', url);
  }, []);

  const updatePhotoState = React.useCallback((photoId, updater) => {
    const touchPhoto = (photo) => {
      if (!photo || photo.photoId !== photoId) return photo;
      return updater(photo);
    };

    setOverview((current) => ({
      ...current,
      highlights: (current.highlights || []).map(touchPhoto),
      trending: (current.trending || []).map(touchPhoto),
      featuredCollections: (current.featuredCollections || []).map((collection) => ({
        ...collection,
        coverImage: touchPhoto(collection.coverImage),
        previewImages: (collection.previewImages || []).map(touchPhoto),
        highlightImages: (collection.highlightImages || []).map(touchPhoto),
      })),
      collectionsByDay: (current.collectionsByDay || []).map((group) => ({
        ...group,
        collections: (group.collections || []).map((collection) => ({
          ...collection,
          coverImage: touchPhoto(collection.coverImage),
          previewImages: (collection.previewImages || []).map(touchPhoto),
          highlightImages: (collection.highlightImages || []).map(touchPhoto),
        })),
      })),
    }));

    setCollectionDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        collection: {
          ...current.collection,
          coverImage: touchPhoto(current.collection.coverImage),
          previewImages: (current.collection.previewImages || []).map(touchPhoto),
          highlightImages: (current.collection.highlightImages || []).map(touchPhoto),
          images: (current.collection.images || []).map(touchPhoto),
        },
        relatedCollections: (current.relatedCollections || []).map((collection) => ({
          ...collection,
          coverImage: touchPhoto(collection.coverImage),
          previewImages: (collection.previewImages || []).map(touchPhoto),
          highlightImages: (collection.highlightImages || []).map(touchPhoto),
        })),
      };
    });

    setLightbox((current) => (current?.photoId === photoId ? updater(current) : current));
  }, []);

  const handleSelectCollection = React.useCallback((collection) => {
    setSelectedCollectionId(collection.id);
    syncUrlState({
      day: selectedDay === 'All' ? collection.dayLabel : selectedDay,
      collection: collection.id,
      photo: null,
    });
  }, [selectedDay, syncUrlState]);

  const handleOpenPhoto = React.useCallback((photo, collection) => {
    setLightbox({
      ...photo,
      sectionTitle: collection.sectionTitle,
      dayLabel: collection.dayLabel,
    });
    syncUrlState({
      day: collection.dayLabel,
      collection: collection.id,
      photo: photo.photoId,
    });
  }, [syncUrlState]);

  const handleCloseLightbox = React.useCallback(() => {
    setLightbox(null);
    syncUrlState({
      day: selectedCollection?.dayLabel || (selectedDay === 'All' ? null : selectedDay),
      collection: selectedCollection?.id || null,
      photo: null,
    });
  }, [selectedCollection, selectedDay, syncUrlState]);

  const handleToggleLike = React.useCallback(async (photoId) => {
    const current = findPhotoState(photoId);
    const previousLiked = Boolean(current?.liked);
    const previousLikeCount = Number(current?.likeCount || 0);
    const optimisticLiked = !previousLiked;
    const optimisticLikeCount = Math.max(
      0,
      previousLikeCount + (optimisticLiked ? 1 : -1),
    );

    updatePhotoState(photoId, (photo) => ({
      ...photo,
      liked: optimisticLiked,
      likeCount: optimisticLikeCount,
    }));

    try {
      const result = await mirageApi.toggleLike(photoId);
      updatePhotoState(photoId, (photo) => ({
        ...photo,
        liked: result.liked,
        likeCount: result.likeCount,
      }));
    } catch (err) {
      updatePhotoState(photoId, (photo) => ({
        ...photo,
        liked: previousLiked,
        likeCount: previousLikeCount,
      }));
      setNotice(err.message || 'Could not update the like.');
    }
  }, [findPhotoState, updatePhotoState]);

  const handleShare = React.useCallback(async (photo, collection) => {
    const url = new URL(window.location.href);
    url.searchParams.set('day', collection.dayLabel);
    url.searchParams.set('collection', collection.id);
    url.searchParams.set('photo', photo.photoId);
    const sharePayload = {
      title: `${collection.sectionTitle} · Mirage`,
      text: `${photo.name} from ${collection.sectionTitle}`,
      url: url.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else {
        await navigator.clipboard.writeText(sharePayload.url);
        setNotice('Share link copied.');
      }
    } catch {
      setNotice('Share cancelled.');
    }
  }, []);

  const imageSrc = React.useCallback((photo, mode = 'preview') => {
    if (!photo) return '';
    if (mode === 'thumb') {
      return photo.thumbnailUrl || photo.url;
    }
    return photo.url || photo.thumbnailUrl || '';
  }, []);

  const handleOpenSearchParticipant = React.useCallback(async (participant) => {
    if (!participant?.userId) return;
    setSearchDetailLoading(true);
    setSearchError('');
    try {
      const payload = await mirageApi.searchParticipant(participant.userId);
      setSearchDetail(payload && payload.participant ? payload : null);
    } catch (err) {
      setSearchError(err.message || 'Could not load that participant.');
      setSearchDetail(null);
    } finally {
      setSearchDetailLoading(false);
    }
  }, []);

  return (
    <PageBackground bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg" blurAmount={18} dimAmount={0.80}>
      <MirageSkeletonStyles />
      <NavBar variant="app" active="mirage" />

      {locked && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, zIndex: 10,
          backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
          background: 'rgba(8, 8, 14, 0.82)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          textAlign: 'center', padding: 24,
        }}>
          <div style={{ fontSize: 48 }}>Lock</div>
          <div style={{
            fontFamily: 'var(--f-mono)', fontSize: isMobile ? 18 : 22,
            letterSpacing: '0.12em', color: 'var(--ink)',
            textTransform: 'uppercase', fontWeight: 700,
          }}>
            Unlocks at Round 2
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-mute)', maxWidth: 320, lineHeight: 1.6 }}>
            Mirage opens its doors after Round 1. Come back for the full photo archive.
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: 12 }}>
          <div>
            <div className="eyebrow">Mirage · Photo Archive</div>
            <h1 className="display" style={{ fontSize: isMobile ? 38 : 58, marginTop: 10, letterSpacing: '-0.03em', lineHeight: 0.96 }}>The weekend, as seen.</h1>
          </div>
          {!isMobile && (
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
              {totalPhotos} PHOTOS · {overview.totalCollections || 0} COLLECTIONS
            </div>
          )}
        </div>

        {!locked && user?.id ? (
          <div style={{ marginTop: 18 }}>
            {loading ? <MirageEnrollmentSkeleton /> : <MirageEnrollmentCard compact />}
          </div>
        ) : null}

        {!locked && (
          <div
            style={{
              marginTop: 18,
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.25fr) minmax(300px, 0.62fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <div>
              {loading || !heroMoment
                ? <MirageHeroSkeleton isMobile={isMobile} />
                : <MirageMomentHero moment={heroMoment} isMobile={isMobile} />}
            </div>

            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              {user?.id && (
                loading ? (
                  <MirageSearchSkeleton isMobile={isMobile} />
                ) : (
                <div className="glass" style={{ padding: isMobile ? 16 : 18, borderRadius: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div className="eyebrow">Participant Search</div>
                      <div style={{ marginTop: 7, fontFamily: 'var(--f-display)', fontSize: isMobile ? 23 : 25, color: 'var(--ink)' }}>
                        Find people in Mirage
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                      SEARCH BY NAME · USERNAME · EMAIL
                    </div>
                  </div>

                  <div style={{ marginTop: 13 }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search any participant..."
                      style={{
                        width: '100%',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--ink)',
                        padding: isMobile ? '12px 13px' : '12px 14px',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)' }}>
                    {searchLoading
                      ? 'Searching Mirage participants...'
                      : searchQuery.trim().length < 2
                        ? 'Type at least 2 characters to start searching.'
                        : `${searchResults.length} participant${searchResults.length === 1 ? '' : 's'} found`}
                  </div>

                  {searchError && (
                    <div style={{
                      marginTop: 14,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'rgba(220, 80, 80, 0.1)',
                      border: '1px solid rgba(220, 80, 80, 0.28)',
                      color: '#f1b0b0',
                      fontSize: 13,
                    }}>
                      {searchError}
                    </div>
                  )}

                  {searchQuery.trim().length >= 2 && !searchError && !searchLoading && searchResults.length === 0 && (
                    <div style={{ marginTop: 16, color: 'var(--ink-mute)', fontSize: 13 }}>
                      No Mirage participant matched that search yet.
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div style={{
                      marginTop: 18,
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: 10,
                    }}>
                      {searchResults.map((participant) => (
                        <button
                          key={participant.userId}
                          type="button"
                          onClick={() => handleOpenSearchParticipant(participant)}
                          style={{
                            padding: 0,
                            borderRadius: 18,
                            overflow: 'hidden',
                            border: searchDetail?.participant?.userId === participant.userId
                              ? '1px solid rgba(127,119,221,0.48)'
                              : '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.025)',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr', gap: 0 }}>
                            <div style={{ minHeight: 76, background: 'rgba(255,255,255,0.04)' }}>
                              {participant.coverPhoto ? (
                                <img
                                  src={imageSrc(participant.coverPhoto, isMobile ? 'thumb' : 'preview')}
                                  alt={participant.name || participant.username || 'Mirage participant'}
                                  loading="lazy"
                                  decoding="async"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                              ) : null}
                            </div>
                            <div style={{ padding: 12 }}>
                              <div style={{ fontFamily: 'var(--f-display)', fontSize: 18, color: 'var(--ink)' }}>
                                {participant.name || participant.username || 'Mirage Participant'}
                              </div>
                              <div style={{ marginTop: 5, fontSize: 12, color: 'var(--ink-dim)' }}>
                                {participant.username || participant.email || participant.userId}
                              </div>
                              <div style={{ marginTop: 9, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                                {participant.photoCount || 0} PHOTOS
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {(searchDetailLoading || searchDetail?.participant) && (
                    <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
                      {searchDetailLoading ? (
                        <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>
                          Loading participant gallery...
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <div className="eyebrow">Participant Gallery</div>
                              <div style={{ marginTop: 8, fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 30, color: 'var(--ink)' }}>
                                {searchDetail.participant.name || searchDetail.participant.username || 'Participant'}
                              </div>
                              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-dim)' }}>
                                {searchDetail.participant.username || searchDetail.participant.email || searchDetail.participant.userId}
                              </div>
                            </div>
                            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                              {searchDetail.photos.length} MATCHED FRAMES
                            </div>
                          </div>

                          <div style={{
                            marginTop: 18,
                            display: 'grid',
                            gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                            gap: isMobile ? 10 : 12,
                          }}>
                            {searchDetail.photos.map((image) => {
                              const participantCollection = {
                                id: `participant-${searchDetail.participant.userId}-${image.photoId}`,
                                dayLabel: image.dayLabel || 'Mirage',
                                sectionTitle: `${searchDetail.participant.name || searchDetail.participant.username || 'Participant'} · Mirage`,
                              };
                              return (
                                <MiragePhotoCard
                                  key={`participant-${image.photoId}`}
                                  image={image}
                                  collection={participantCollection}
                                  isMobile={isMobile}
                                  onOpen={handleOpenPhoto}
                                  onToggleLike={handleToggleLike}
                                  onShare={handleShare}
                                />
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                )
              )}

              {loading ? (
                <ArchivePulseSkeleton isMobile={isMobile} />
              ) : (
                <ArchivePulsePanel
                  pulse={archivePulse}
                  isMobile={isMobile}
                />
              )}

            </div>
          </div>
        )}

        {!locked && (
          loading ? (
            <TrendingSkeleton isMobile={isMobile} />
          ) : (
            <TrendingCarousel
              photos={overview.trending || []}
              collections={allCollections}
              imageSrc={imageSrc}
              isMobile={isMobile}
              onOpenPhoto={handleOpenPhoto}
            />
          )
        )}

        {(loading || hasArchiveContent) && (
        <div style={{ marginTop: 22 }}>
          {loading ? (
            <OpeningFramesSkeleton isMobile={isMobile} />
          ) : (
          <div className="glass" style={{ padding: isMobile ? 16 : 18, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow">Opening Frames</div>
                <div style={{ marginTop: 7, fontFamily: 'var(--f-display)', fontSize: isMobile ? 23 : 28, color: 'var(--ink)' }}>
                  Start with the strongest shots
                </div>
              </div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                {Math.min((overview.highlights || []).length, 3)} FEATURED
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, minmax(0, 1fr))', gap: 12 }}>
              {(overview.highlights || []).slice(0, 3).map((photo, index) => {
                const collection = (overview.collectionsByDay || [])
                  .flatMap((group) => group.collections || [])
                  .find((item) => item.eventId === photo.eventId || item.eventName === photo.eventName)
                  || selectedCollection
                  || overview.featuredCollections?.[0];
                return (
                  <button
                    key={photo.photoId}
                    type="button"
                    onClick={() => collection && handleOpenPhoto(photo, collection)}
                    style={{
                      padding: 0,
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 18,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      gridColumn: isMobile ? undefined : index === 0 ? 'span 6' : 'span 3',
                      minHeight: index === 0 && !isMobile ? 320 : 0,
                    }}
                  >
                    <div style={{ aspectRatio: index === 0 && !isMobile ? '16 / 10' : '4 / 5', background: 'rgba(255,255,255,0.04)' }}>
                      <img
                        src={index === 0 && !isMobile ? imageSrc(photo, 'preview') : imageSrc(photo, 'thumb')}
                        alt={photo.name}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchpriority={index === 0 ? 'high' : 'auto'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <div style={{ padding: index === 0 && !isMobile ? 14 : 12 }}>
                      <div style={{ fontFamily: 'var(--f-display)', fontSize: index === 0 && !isMobile ? 22 : 16, color: 'var(--ink)' }}>
                        {photo.eventName || photo.name}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-dim)' }}>
                        {photo.dayLabel || 'Mirage'} · {photo.likeCount} likes
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>
        )}
            {/* Legacy stacked layout intentionally disabled after editorial grid refactor.
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow">Participant Search</div>
                <div style={{ marginTop: 8, fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 30, color: 'var(--ink)' }}>
                  Find people in Mirage
                </div>
              </div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                SEARCH BY NAME · USERNAME · EMAIL
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search any participant..."
                style={{
                  width: '100%',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--ink)',
                  padding: isMobile ? '13px 14px' : '14px 16px',
                  fontSize: 15,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-mute)' }}>
              {searchLoading
                ? 'Searching Mirage participants...'
                : searchQuery.trim().length < 2
                  ? 'Type at least 2 characters to start searching.'
                  : `${searchResults.length} participant${searchResults.length === 1 ? '' : 's'} found`}
            </div>

            {searchError && (
              <div style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(220, 80, 80, 0.1)',
                border: '1px solid rgba(220, 80, 80, 0.28)',
                color: '#f1b0b0',
                fontSize: 13,
              }}>
                {searchError}
              </div>
            )}

            {searchQuery.trim().length >= 2 && !searchError && !searchLoading && searchResults.length === 0 && (
              <div style={{ marginTop: 16, color: 'var(--ink-mute)', fontSize: 13 }}>
                No Mirage participant matched that search yet.
              </div>
            )}

            {searchResults.length > 0 && (
              <div style={{
                marginTop: 18,
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: 12,
              }}>
                {searchResults.map((participant) => (
                  <button
                    key={participant.userId}
                    type="button"
                    onClick={() => handleOpenSearchParticipant(participant)}
                    style={{
                      padding: 0,
                      borderRadius: 18,
                      overflow: 'hidden',
                      border: searchDetail?.participant?.userId === participant.userId
                        ? '1px solid rgba(127,119,221,0.48)'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.025)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '96px 1fr' : '112px 1fr', gap: 0 }}>
                      <div style={{ minHeight: isMobile ? 96 : 112, background: 'rgba(255,255,255,0.04)' }}>
                        {participant.coverPhoto ? (
                          <img
                            src={imageSrc(participant.coverPhoto, isMobile ? 'thumb' : 'preview')}
                            alt={participant.name || participant.username || 'Mirage participant'}
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : null}
                      </div>
                      <div style={{ padding: isMobile ? 14 : 16 }}>
                        <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 20 : 22, color: 'var(--ink)' }}>
                          {participant.name || participant.username || 'Mirage Participant'}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-dim)' }}>
                          {participant.username || participant.email || participant.userId}
                        </div>
                        <div style={{ marginTop: 12, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                          {participant.photoCount || 0} PHOTOS
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {(searchDetailLoading || searchDetail?.participant) && (
              <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
                {searchDetailLoading ? (
                  <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>
                    Loading participant gallery...
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div className="eyebrow">Participant Gallery</div>
                        <div style={{ marginTop: 8, fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 30, color: 'var(--ink)' }}>
                          {searchDetail.participant.name || searchDetail.participant.username || 'Participant'}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-dim)' }}>
                          {searchDetail.participant.username || searchDetail.participant.email || searchDetail.participant.userId}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                        {searchDetail.photos.length} MATCHED FRAMES
                      </div>
                    </div>

                    <div style={{
                      marginTop: 18,
                      display: 'grid',
                      gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                      gap: isMobile ? 10 : 12,
                    }}>
                      {searchDetail.photos.map((image) => {
                        const participantCollection = {
                          id: `participant-${searchDetail.participant.userId}-${image.photoId}`,
                          dayLabel: image.dayLabel || 'Mirage',
                          sectionTitle: `${searchDetail.participant.name || searchDetail.participant.username || 'Participant'} · Mirage`,
                        };
                        return (
                          <MiragePhotoCard
                            key={`participant-${image.photoId}`}
                            image={image}
                            collection={participantCollection}
                            isMobile={isMobile}
                            onOpen={handleOpenPhoto}
                            onToggleLike={handleToggleLike}
                            onShare={handleShare}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{
          marginTop: 26,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.25fr 0.75fr',
          gap: 16,
        }}>
          <div className="glass" style={{ padding: isMobile ? 18 : 22 }}>
            <div className="eyebrow">Highlights</div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: 12 }}>
              {(overview.highlights || []).slice(0, 3).map((photo, index) => {
                const collection = (overview.collectionsByDay || [])
                  .flatMap((group) => group.collections || [])
                  .find((item) => item.eventId === photo.eventId || item.eventName === photo.eventName)
                  || selectedCollection
                  || overview.featuredCollections?.[0];
                return (
                  <button
                    key={photo.photoId}
                    type="button"
                    onClick={() => collection && handleOpenPhoto(photo, collection)}
                    style={{
                      padding: 0,
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 18,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: index === 0 && !isMobile ? 360 : 180,
                    }}
                  >
                    <div style={{ aspectRatio: index === 0 && !isMobile ? '16 / 10' : '1 / 1.02', background: 'rgba(255,255,255,0.04)' }}>
                      <img
                        src={index === 0 && !isMobile ? imageSrc(photo, 'preview') : imageSrc(photo, 'thumb')}
                        alt={photo.name}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchpriority={index === 0 ? 'high' : 'auto'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <div style={{ padding: 14 }}>
                      <div style={{ fontFamily: 'var(--f-display)', fontSize: index === 0 ? 22 : 16, color: 'var(--ink)' }}>
                        {photo.eventName || photo.name}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-dim)' }}>
                        {photo.dayLabel || 'Mirage'} · {photo.likeCount} likes
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass" style={{ padding: isMobile ? 18 : 22 }}>
            <div className="eyebrow">Trending Now</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(overview.trending || []).slice(0, 5).map((photo, index) => {
                const collection = (overview.collectionsByDay || [])
                  .flatMap((group) => group.collections || [])
                  .find((item) => item.eventId === photo.eventId || item.eventName === photo.eventName);
                return (
                  <button
                    key={photo.photoId}
                    type="button"
                    onClick={() => collection && handleSelectCollection(collection)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '72px 1fr auto',
                      gap: 12,
                      alignItems: 'center',
                      padding: 0,
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.025)',
                      cursor: collection ? 'pointer' : 'default',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.04)' }}>
                      <img
                        src={imageSrc(photo, 'thumb')}
                        alt={photo.name}
                        loading={index < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {photo.eventName || photo.name}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)' }}>
                        {photo.likeCount} likes · trend {photo.trendScore || 0}
                      </div>
                    </div>
                    <div style={{ paddingRight: 14, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
                      #{index + 1}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        */}

        {(loading || hasArchiveContent || dayOptions.length > 1) && (
        <div style={{ marginTop: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {dayOptions.map((day) => (
            <div key={day} onClick={() => setSelectedDay(day)} className="chip" style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 11,
              background: selectedDay === day ? 'rgba(127,119,221,0.2)' : undefined,
              borderColor: selectedDay === day ? 'rgba(127,119,221,0.55)' : undefined,
              color: selectedDay === day ? '#F1EFE8' : undefined,
            }}>{day}</div>
          ))}
        </div>
        )}

        {!loading && error && (
          <div style={{
            marginTop: 28,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'rgba(220, 80, 80, 0.1)',
            border: '1px solid rgba(220, 80, 80, 0.28)',
            color: '#f1b0b0',
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && !hasArchiveContent && !locked && (
          <MirageArchiveEmptyState isMobile={isMobile} />
        )}

        {loading && !error && !locked && (
          <MirageContentSkeleton isMobile={isMobile} />
        )}

        {!loading && !error && hasArchiveContent && (
          <>
            <div style={{ marginTop: 28 }} className="glass">
              <div style={{ padding: isMobile ? 16 : 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div className="eyebrow">Matched For You</div>
                    <div style={{ marginTop: 8, fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 30, color: 'var(--ink)' }}>
                      Your Mirage picks
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                    {loadingMyPhotos ? 'LOADING' : `${myPhotos.length} MATCHES`}
                  </div>
                </div>

                {loadingMyPhotos ? (
                  <PhotoGridSkeleton count={isMobile ? 4 : 4} isMobile={isMobile} />
                ) : myPhotos.length === 0 ? (
                  <div style={{ marginTop: 16, color: 'var(--ink-mute)', fontSize: 13, lineHeight: 1.6 }}>
                    Your personal Mirage gallery will appear here after the review team approves face matches.
                  </div>
                ) : (
                  <div style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                    gap: 12,
                  }}>
                    {myPhotos.slice(0, 8).map((image) => {
                      const collection = (overview.collectionsByDay || [])
                        .flatMap((group) => group.collections || [])
                        .find((item) => item.id === image.jobId)
                        || {
                          id: image.jobId || 'my-photo',
                          dayLabel: image.dayLabel || 'Mirage',
                          sectionTitle: image.eventName || 'My photo',
                        };
                      return (
                        <MiragePhotoCard
                          key={`mine-${image.photoId}`}
                          image={image}
                          collection={collection}
                          isMobile={isMobile}
                          onOpen={handleOpenPhoto}
                          onToggleLike={handleToggleLike}
                          onShare={handleShare}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 30 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 26 : 32, color: 'var(--ink)' }}>
                  Event Collections
                </div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                  CURATED BY DAY · FAST PREVIEW
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {visibleDayGroups.map((day) => (
                  <div key={day.dayLabel}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 28, color: 'var(--ink)' }}>
                        {day.dayLabel}
                      </div>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                        {day.collections.reduce((sum, item) => sum + (item.imageCount || 0), 0)} FRAMES
                      </div>
                    </div>
                    <div style={{
                      marginTop: 14,
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                      gap: 14,
                    }}>
                      {day.collections.map((collection) => (
                        <button
                          key={collection.id}
                          type="button"
                          onClick={() => handleSelectCollection(collection)}
                          className="glass"
                          style={{
                            padding: 0,
                            overflow: 'hidden',
                            textAlign: 'left',
                            cursor: 'pointer',
                            border: selectedCollectionId === collection.id
                              ? '1px solid rgba(127,119,221,0.5)'
                              : '1px solid var(--glass-border)',
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.92fr 1.08fr', gap: 0 }}>
                            <div style={{ minHeight: 220, background: 'rgba(255,255,255,0.03)' }}>
                              {collection.coverImage ? (
                                <img
                                  src={imageSrc(collection.coverImage, 'preview')}
                                  alt={collection.sectionTitle}
                                  loading="lazy"
                                  decoding="async"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                              ) : null}
                            </div>
                            <div style={{ padding: isMobile ? 16 : 18 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ fontFamily: 'var(--f-display)', fontSize: 24, color: 'var(--ink)' }}>
                                    {collection.sectionTitle}
                                  </div>
                                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-dim)' }}>
                                    {collection.eventName || 'Custom collection'} · {collection.imageCount} shots
                                  </div>
                                </div>
                                <div className="chip" style={{ padding: '6px 10px', fontSize: 10 }}>
                                  {collection.recursive ? 'MULTI-FOLDER' : 'DIRECT'}
                                </div>
                              </div>

                              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                                {(collection.previewImages || []).slice(0, 3).map((image) => (
                                  <div key={image.photoId} style={{ aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
                                    <img
                                      src={imageSrc(image, 'thumb')}
                                      alt={image.name}
                                      loading="lazy"
                                      decoding="async"
                                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                  </div>
                                ))}
                              </div>

                              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)' }}>
                                  EVENT HIGHLIGHTS READY
                                </div>
                                <div className="btn sm" style={{ padding: '6px 12px', fontSize: 11 }}>
                                  Open Collection
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 30 }} className="glass">
              <div style={{ padding: isMobile ? 16 : 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div className="eyebrow">Selected Collection</div>
                    <div style={{ marginTop: 8, fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 30, color: 'var(--ink)' }}>
                      {selectedCollection?.sectionTitle || 'Choose a collection'}
                    </div>
                    {selectedCollection && (
                      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-dim)' }}>
                        {selectedCollection.eventName} · {selectedCollection.imageCount} images · {selectedCollection.dayLabel}
                      </div>
                    )}
                  </div>
                  {selectedCollection && (
                    <div className="chip" style={{ padding: '6px 10px', fontSize: 10 }}>
                      {selectedCollection.recursive ? 'FULL EVENT DROP' : 'DIRECT EVENT DROP'}
                    </div>
                  )}
                </div>

                {loadingCollection && (
                  <SelectedCollectionSkeleton isMobile={isMobile} />
                )}

                {!loadingCollection && selectedCollection && (
                  <>
                    <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 10 }}>
                      {(selectedCollection.highlightImages || []).map((image) => (
                        <button
                          key={image.photoId}
                          type="button"
                          onClick={() => handleOpenPhoto(image, selectedCollection)}
                          style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          <div style={{ aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
                            <img
                              src={imageSrc(image, 'thumb')}
                              alt={image.name}
                              loading="lazy"
                              decoding="async"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>

                    <div style={{
                      marginTop: 18,
                      display: 'grid',
                      gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                      gap: isMobile ? 10 : 12,
                    }}>
                      {(selectedCollection.images || []).map((image) => (
                        <MiragePhotoCard
                          key={image.photoId}
                          image={image}
                          collection={selectedCollection}
                          isMobile={isMobile}
                          onOpen={handleOpenPhoto}
                          onToggleLike={handleToggleLike}
                          onShare={handleShare}
                        />
                      ))}
                    </div>

                    {collectionDetail?.relatedCollections?.length > 0 && (
                      <div style={{ marginTop: 22 }}>
                        <div className="eyebrow">More Collections</div>
                        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                          {collectionDetail.relatedCollections.map((collection) => (
                            <button
                              key={collection.id}
                              type="button"
                              onClick={() => handleSelectCollection(collection)}
                              className="glass"
                              style={{ padding: 12, textAlign: 'left', cursor: 'pointer' }}
                            >
                              <div style={{ fontFamily: 'var(--f-display)', fontSize: 18, color: 'var(--ink)' }}>
                                {collection.sectionTitle}
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-dim)' }}>
                                {collection.eventName} · {collection.imageCount} frames
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {lightbox && (
        <div onClick={handleCloseLightbox} style={{
          position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.88)',
          display: 'grid', placeItems: 'center', zIndex: 100, padding: isMobile ? 16 : 40,
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ maxWidth: 1000, width: '100%', position: 'relative' }}>
            <div style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
              <img
                src={imageSrc(lightbox, 'preview')}
                alt={lightbox.name}
                decoding="async"
                style={{ width: '100%', maxHeight: isMobile ? '70vh' : '78vh', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--ink)', fontSize: 14 }}>
                {lightbox.sectionTitle} · {lightbox.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>
                  {lightbox.likeCount || 0} likes
                </div>
                <ActionIconButton
                  label={lightbox.liked ? 'Unlike photo' : 'Like photo'}
                  active={Boolean(lightbox.liked)}
                  accent="#ffb7bc"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleLike(lightbox.photoId);
                  }}
                >
                  <HeartIcon filled={Boolean(lightbox.liked)} />
                </ActionIconButton>
                {selectedCollection && (
                  <ActionIconButton
                    label="Share photo link"
                    accent="#cfc7ff"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleShare(lightbox, selectedCollection);
                    }}
                  >
                    <ShareIcon />
                  </ActionIconButton>
                )}
                {lightbox.downloadUrl ? (
                  <ActionIconButton
                    label="Download photo"
                    href={lightbox.downloadUrl}
                    accent="#ffe0a1"
                  >
                    <DownloadIcon />
                  </ActionIconButton>
                ) : null}
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)' }}>TAP · CLOSE</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!!notice && (
        <div style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          zIndex: 120,
          padding: '12px 14px',
          borderRadius: 14,
          background: 'rgba(20,20,28,0.92)',
          border: '1px solid rgba(127,119,221,0.35)',
          color: 'var(--ink)',
          fontSize: 12,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        }}>
          {notice}
        </div>
      )}
    </PageBackground>
  );
}

function MirageArchiveEmptyState({ isMobile }) {
  return (
    <section
      className="glass"
      style={{
        marginTop: isMobile ? 22 : 28,
        borderRadius: 18,
        padding: isMobile ? '28px 20px' : '34px 28px',
        minHeight: isMobile ? 220 : 260,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(24,25,31,0.88) 0%, rgba(21,23,29,0.72) 56%, rgba(18,20,26,0.88) 100%)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 22px 70px rgba(0,0,0,0.22)',
      }}
    >
      <div style={{ maxWidth: 520, display: 'grid', justifyItems: 'center' }}>
        <div
          aria-hidden="true"
          style={{
            width: isMobile ? 64 : 74,
            height: isMobile ? 64 : 74,
            borderRadius: 22,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035))',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.10)',
            color: 'rgba(246,244,238,0.9)',
          }}
        >
          <svg width={isMobile ? 30 : 34} height={isMobile ? 30 : 34} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
            <path d="M7 15.5l3.2-3.4 2.6 2.7 1.7-1.9L18 16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8.3" cy="9.2" r="1.2" fill="currentColor" />
          </svg>
        </div>

        <div
          className="eyebrow"
          style={{
            marginTop: 18,
            color: 'rgba(255,255,255,0.52)',
          }}
        >
          Mirage archive
        </div>
        <h2
          className="display"
          style={{
            margin: '8px 0 0',
            fontSize: isMobile ? 28 : 36,
            color: 'var(--ink)',
            lineHeight: 1.05,
          }}
        >
          No images yet
        </h2>
        <p
          style={{
            margin: '12px 0 0',
            maxWidth: 460,
            fontSize: isMobile ? 13 : 14,
            lineHeight: 1.6,
            color: 'rgba(244,242,236,0.66)',
          }}
        >
          Mirage collections will appear here after the event photos are uploaded and published.
        </p>
      </div>
    </section>
  );
}

function buildArchivePulse(overview, myPhotos) {
  const photoMap = new Map();
  const remember = (photo) => {
    if (!photo?.photoId || photoMap.has(photo.photoId)) return;
    photoMap.set(photo.photoId, photo);
  };

  (overview.highlights || []).forEach(remember);
  (overview.trending || []).forEach(remember);
  (myPhotos || []).forEach(remember);
  (overview.featuredCollections || []).forEach((collection) => {
    remember(collection.coverImage);
    (collection.previewImages || []).forEach(remember);
    (collection.highlightImages || []).forEach(remember);
  });
  (overview.collectionsByDay || []).forEach((group) => {
    (group.collections || []).forEach((collection) => {
      remember(collection.coverImage);
      (collection.previewImages || []).forEach(remember);
      (collection.highlightImages || []).forEach(remember);
    });
  });

  const photos = Array.from(photoMap.values());
  const totalLikes = photos.reduce((sum, photo) => sum + Number(photo.likeCount || 0), 0);
  const activeDays = (overview.dayLabels || []).length;
  const rankedFrames = (overview.trending || [])
    .slice()
    .sort((a, b) => {
      const likes = Number(b.likeCount || 0) - Number(a.likeCount || 0);
      if (likes !== 0) return likes;
      return Number(b.trendScore || 0) - Number(a.trendScore || 0);
    })
    .slice(0, 3)
    .map((photo, index) => ({
      id: photo.photoId,
      rank: index + 1,
      title: photo.eventName || photo.name || 'Mirage frame',
      likes: Number(photo.likeCount || 0),
    }));

  const leadFrame = rankedFrames[0] || null;
  const momentumLikes = rankedFrames.reduce((sum, item) => sum + item.likes, 0);

  return {
    totalPhotos: Number(overview.totalPhotos || 0),
    totalCollections: Number(overview.totalCollections || 0),
    totalLikes,
    activeDays,
    myMatches: Array.isArray(myPhotos) ? myPhotos.length : 0,
    leadFrame,
    momentumLikes,
    searchScope: Number(overview.totalPhotos || 0),
    rankedFrames,
  };
}

function MirageSkeletonStyles() {
  return (
    <style>{`
      @keyframes mirageShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .mirage-skeleton {
        background: linear-gradient(
          90deg,
          rgba(255,255,255,0.05) 0%,
          rgba(255,224,161,0.12) 35%,
          rgba(255,255,255,0.05) 70%
        );
        background-size: 200% 100%;
        animation: mirageShimmer 1.4s ease-in-out infinite;
      }
    `}</style>
  );
}

function MirageSkeletonBlock({ height, width = '100%', radius = 14, style = {} }) {
  return (
    <div
      className="mirage-skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

function MirageEnrollmentSkeleton() {
  return (
    <div className="glass" style={{ borderRadius: 999, padding: '14px 18px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr 120px', gap: 14, alignItems: 'center' }}>
        <MirageSkeletonBlock height={18} width={18} radius={999} />
        <div style={{ display: 'grid', gap: 8 }}>
          <MirageSkeletonBlock height={10} width={140} radius={999} />
          <MirageSkeletonBlock height={14} width="58%" radius={999} />
        </div>
        <MirageSkeletonBlock height={40} width={104} radius={999} style={{ justifySelf: 'end' }} />
      </div>
    </div>
  );
}

function MirageHeroSkeleton({ isMobile }) {
  return (
    <div className="glass" style={{ borderRadius: 18, overflow: 'hidden', padding: 0 }}>
      <div style={{ width: '100%', aspectRatio: isMobile ? '16 / 10' : '16 / 8.8', minHeight: isMobile ? 220 : 320, position: 'relative' }}>
        <MirageSkeletonBlock height="100%" width="100%" radius={0} />
        <div style={{ position: 'absolute', top: isMobile ? 14 : 18, left: isMobile ? 14 : 18 }}>
          <MirageSkeletonBlock height={28} width={178} radius={999} />
        </div>
        <div style={{ position: 'absolute', left: isMobile ? 16 : 22, bottom: isMobile ? 18 : 20, right: isMobile ? 16 : 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ display: 'grid', gap: 10, flex: 1 }}>
            <MirageSkeletonBlock height={isMobile ? 36 : 50} width={isMobile ? '82%' : '70%'} />
            <MirageSkeletonBlock height={10} width={120} radius={999} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <MirageSkeletonBlock height={10} width={36} radius={999} />
            <MirageSkeletonBlock height={40} width={40} radius={12} />
            <MirageSkeletonBlock height={40} width={40} radius={12} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MirageSearchSkeleton({ isMobile }) {
  return (
    <div className="glass" style={{ padding: isMobile ? 16 : 18, borderRadius: 16 }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <MirageSkeletonBlock height={10} width={124} radius={999} />
            <MirageSkeletonBlock height={28} width={260} />
          </div>
          <MirageSkeletonBlock height={10} width={176} radius={999} style={{ marginTop: 6 }} />
        </div>
        <MirageSkeletonBlock height={46} width="100%" radius={12} />
        <MirageSkeletonBlock height={10} width={220} radius={999} />
      </div>
    </div>
  );
}

function ArchivePulseSkeleton({ isMobile }) {
  return (
    <div className="glass" style={{ padding: isMobile ? 14 : 16, borderRadius: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <MirageSkeletonBlock height={10} width={104} radius={999} />
            <MirageSkeletonBlock height={22} width={150} />
          </div>
          <MirageSkeletonBlock height={10} width={78} radius={999} style={{ marginTop: 6 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {[0, 1, 2].map((item) => (
            <div key={item} style={{ borderRadius: 12, padding: isMobile ? '10px 9px' : '11px 10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
              <MirageSkeletonBlock height={9} width="70%" radius={999} />
              <MirageSkeletonBlock height={20} width="42%" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendingSkeleton({ isMobile }) {
  return (
    <section className="glass" style={{ marginTop: 20, padding: isMobile ? 16 : 18, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <MirageSkeletonBlock height={10} width={110} radius={999} />
          <MirageSkeletonBlock height={30} width={260} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <MirageSkeletonBlock height={42} width={42} radius={12} />
          <MirageSkeletonBlock height={42} width={42} radius={12} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: isMobile ? 12 : 16 }}>
        {Array.from({ length: isMobile ? 2 : 4 }).map((_, index) => (
          <div key={index} style={{ flex: `0 0 ${isMobile ? '220px' : '292px'}` }}>
            <MirageSkeletonBlock height={isMobile ? 148 : 182} width="100%" radius={14} />
          </div>
        ))}
      </div>
    </section>
  );
}

function OpeningFramesSkeleton({ isMobile }) {
  return (
    <div className="glass" style={{ padding: isMobile ? 16 : 18, borderRadius: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <MirageSkeletonBlock height={10} width={112} radius={999} />
          <MirageSkeletonBlock height={28} width={280} />
        </div>
        <MirageSkeletonBlock height={10} width={82} radius={999} style={{ marginTop: 6 }} />
      </div>
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, minmax(0, 1fr))', gap: 12 }}>
        <MirageSkeletonBlock height={isMobile ? 220 : 320} radius={18} style={{ gridColumn: isMobile ? undefined : 'span 6' }} />
        <MirageSkeletonBlock height={isMobile ? 220 : 220} radius={18} style={{ gridColumn: isMobile ? undefined : 'span 3' }} />
        <MirageSkeletonBlock height={isMobile ? 220 : 220} radius={18} style={{ gridColumn: isMobile ? undefined : 'span 3' }} />
      </div>
    </div>
  );
}

function PhotoGridSkeleton({ count, isMobile }) {
  return (
    <div style={{
      marginTop: 18,
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
      gap: 12,
    }}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', borderRadius: 14, overflow: 'hidden' }}>
          <MirageSkeletonBlock height={isMobile ? 164 : 220} width="100%" radius={0} />
          <div style={{ padding: '10px 11px 12px', display: 'grid', gap: 10 }}>
            <MirageSkeletonBlock height={12} width="72%" radius={999} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <MirageSkeletonBlock height={10} width={52} radius={999} />
              <div style={{ display: 'flex', gap: 8 }}>
                <MirageSkeletonBlock height={38} width={38} radius={12} />
                <MirageSkeletonBlock height={38} width={38} radius={12} />
                <MirageSkeletonBlock height={38} width={38} radius={12} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventCollectionsSkeleton({ isMobile }) {
  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <MirageSkeletonBlock height={30} width={220} />
        <MirageSkeletonBlock height={10} width={170} radius={999} style={{ marginTop: 8 }} />
      </div>
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="glass" style={{ padding: 0, overflow: 'hidden', borderRadius: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.92fr 1.08fr' }}>
              <MirageSkeletonBlock height={220} width="100%" radius={0} />
              <div style={{ padding: isMobile ? 16 : 18, display: 'grid', gap: 12 }}>
                <MirageSkeletonBlock height={24} width="58%" />
                <MirageSkeletonBlock height={12} width="68%" radius={999} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  <MirageSkeletonBlock height={70} radius={10} />
                  <MirageSkeletonBlock height={70} radius={10} />
                  <MirageSkeletonBlock height={70} radius={10} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <MirageSkeletonBlock height={10} width={130} radius={999} />
                  <MirageSkeletonBlock height={32} width={116} radius={999} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectedCollectionSkeleton({ isMobile }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 10 }}>
        {Array.from({ length: isMobile ? 3 : 6 }).map((_, index) => (
          <MirageSkeletonBlock key={index} height={isMobile ? 86 : 110} radius={12} />
        ))}
      </div>
      <PhotoGridSkeleton count={isMobile ? 4 : 8} isMobile={isMobile} />
    </div>
  );
}

function MirageContentSkeleton({ isMobile }) {
  return (
    <>
      <div style={{ marginTop: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <MirageSkeletonBlock key={index} height={28} width={index === 0 ? 42 : 64} radius={999} />
        ))}
      </div>

      <div style={{ marginTop: 28 }} className="glass">
        <div style={{ padding: isMobile ? 16 : 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <MirageSkeletonBlock height={10} width={110} radius={999} />
              <MirageSkeletonBlock height={30} width={240} />
            </div>
            <MirageSkeletonBlock height={10} width={84} radius={999} style={{ marginTop: 8 }} />
          </div>
          <PhotoGridSkeleton count={isMobile ? 4 : 4} isMobile={isMobile} />
        </div>
      </div>

      <EventCollectionsSkeleton isMobile={isMobile} />

      <div style={{ marginTop: 30 }} className="glass">
        <div style={{ padding: isMobile ? 16 : 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <MirageSkeletonBlock height={10} width={120} radius={999} />
              <MirageSkeletonBlock height={30} width={260} />
            </div>
            <MirageSkeletonBlock height={28} width={120} radius={999} style={{ marginTop: 6 }} />
          </div>
          <SelectedCollectionSkeleton isMobile={isMobile} />
        </div>
      </div>
    </>
  );
}

function ArchivePulsePanel({ pulse, isMobile }) {
  const statCards = [
    { label: 'Frames live', value: pulse.totalPhotos },
    { label: 'Collections', value: pulse.totalCollections },
    { label: 'Likes archived', value: pulse.totalLikes },
  ];

  return (
    <div
      className="glass"
      style={{
        padding: isMobile ? 14 : 16,
        borderRadius: 16,
        display: 'grid',
        gap: 10,
        background: 'linear-gradient(180deg, rgba(36,33,28,0.86) 0%, rgba(18,19,27,0.78) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Archive Pulse</div>
          <div style={{ marginTop: 5, fontFamily: 'var(--f-display)', fontSize: isMobile ? 19 : 20, color: '#f5e6bf', lineHeight: 1.04 }}>
            Essential stats
          </div>
        </div>
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
          LIVE SIGNAL
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {statCards.map((item) => (
          <div
            key={item.label}
            style={{
              borderRadius: 12,
              padding: isMobile ? '10px 9px' : '11px 10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-mute)', textTransform: 'uppercase' }}>
              {item.label}
            </div>
            <div style={{ marginTop: 7, fontFamily: 'var(--f-display)', fontSize: isMobile ? 18 : 21, color: 'var(--ink)', lineHeight: 1 }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendingCarousel({ photos, collections, imageSrc, isMobile, onOpenPhoto }) {
  const scrollerRef = React.useRef(null);
  const rankedPhotos = React.useMemo(() => {
    const list = Array.isArray(photos) ? photos.slice() : [];
    list.sort((a, b) => {
      const likes = (b.likeCount || 0) - (a.likeCount || 0);
      if (likes !== 0) return likes;
      return (b.trendScore || 0) - (a.trendScore || 0);
    });
    return list.slice(0, 12);
  }, [photos]);

  const scroll = React.useCallback((direction) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction * Math.min(760, Math.max(320, node.clientWidth * 0.82)),
      behavior: 'smooth',
    });
  }, []);

  if (!rankedPhotos.length) return null;

  const findCollection = (photo) =>
    (collections || []).find((item) =>
      item.id === photo.jobId ||
      item.eventId === photo.eventId ||
      item.eventName === photo.eventName
    );

  return (
    <section
      className="glass"
      style={{
        marginTop: 20,
        padding: isMobile ? 16 : 18,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(18,19,28,0.72), rgba(12,13,18,0.40))',
      }}
    >
      <style>{`
        .mirage-trending-scroller {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .mirage-trending-scroller::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Trending Now</div>
          <div style={{ marginTop: 7, fontFamily: 'var(--f-display)', fontSize: isMobile ? 25 : 32, color: '#ffe0a1', lineHeight: 1 }}>
            Most liked frames
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            aria-label="Previous trending photos"
            onClick={() => scroll(-1)}
            style={{
              width: isMobile ? 36 : 42,
              height: isMobile ? 36 : 42,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.07)',
              color: 'var(--ink)',
              cursor: 'pointer',
              fontSize: 20,
            }}
          >
            {'<'}
          </button>
          <button
            type="button"
            aria-label="Next trending photos"
            onClick={() => scroll(1)}
            style={{
              width: isMobile ? 36 : 42,
              height: isMobile ? 36 : 42,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.07)',
              color: 'var(--ink)',
              cursor: 'pointer',
              fontSize: 20,
            }}
          >
            {'>'}
          </button>
        </div>
      </div>

      <div
        className="mirage-trending-scroller"
        ref={scrollerRef}
        style={{
          display: 'flex',
          gap: isMobile ? 12 : 16,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '2px 2px 8px',
        }}
      >
        {rankedPhotos.map((photo, index) => {
          const collection = findCollection(photo);
          const title = photo.eventName || photo.name || 'Mirage frame';
          const rank = String(index + 1).padStart(2, '0');
          return (
            <button
              key={photo.photoId}
              type="button"
              onClick={() => collection && onOpenPhoto(photo, collection)}
              style={{
                flex: `0 0 ${isMobile ? '220px' : '292px'}`,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: collection ? 'pointer' : 'default',
                textAlign: 'left',
                scrollSnapAlign: 'start',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'end' }}>
                <div style={{
                  writingMode: isMobile ? 'horizontal-tb' : 'vertical-rl',
                  transform: isMobile ? 'none' : 'rotate(180deg)',
                  color: 'rgba(255,255,255,0.88)',
                  fontFamily: 'var(--f-display)',
                  fontSize: isMobile ? 14 : 18,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxHeight: isMobile ? undefined : 178,
                }}>
                  {title}
                </div>
                <div style={{
                  position: 'relative',
                  aspectRatio: '16 / 10',
                  borderRadius: 14,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
                }}>
                  <img
                    src={imageSrc(photo, index < 3 ? 'preview' : 'thumb')}
                    alt={photo.name || title}
                    loading={index < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.02) 35%, rgba(0,0,0,0.72) 100%)',
                  }} />
                  <div style={{
                    position: 'absolute',
                    left: 12,
                    right: 12,
                    bottom: 10,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--ink)', fontFamily: 'var(--f-display)', fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {title}
                      </div>
                      <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.66)', fontFamily: 'var(--f-mono)', fontSize: 10 }}>
                        {photo.likeCount || 0} likes
                      </div>
                    </div>
                    <div style={{
                      color: '#ffe0a1',
                      fontFamily: 'var(--f-display)',
                      fontSize: 26,
                      lineHeight: 1,
                      textShadow: '0 8px 20px rgba(0,0,0,0.5)',
                    }}>
                      {rank}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ActionIconButton({
  label,
  active = false,
  accent = '#f1efe8',
  onClick,
  href,
  children,
}) {
  const [burst, setBurst] = React.useState(false);

  const trigger = React.useCallback((event) => {
    setBurst(true);
    window.setTimeout(() => setBurst(false), 220);
    onClick?.(event);
  }, [onClick]);

  const commonStyle = {
    width: 38,
    height: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    border: active ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.10)',
    background: active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)',
    color: active ? accent : 'rgba(241,239,232,0.9)',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'transform 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
    transform: burst ? 'scale(0.92)' : 'scale(1)',
    boxShadow: burst ? `0 0 0 6px ${active ? `${accent}22` : 'rgba(255,255,255,0.08)'}` : 'none',
  };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        title={label}
        onClick={trigger}
        style={commonStyle}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={trigger}
      style={commonStyle}
    >
      {children}
    </button>
  );
}

function HeartIcon({ filled = false }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-6.716-4.35-9.192-8.153C1.36 10.62 2.042 6.93 5.4 5.51c2.11-.894 4.26-.29 5.6 1.35c1.34-1.64 3.49-2.244 5.6-1.35c3.359 1.42 4.04 5.11 2.592 7.338C18.716 16.65 12 21 12 21Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51L15.42 17.49" />
      <path d="M15.41 6.51L8.59 10.49" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function MiragePhotoCard({ image, collection, isMobile, onOpen, onToggleLike, onShare }) {
  const cardSrc = image.thumbnailUrl || image.url;
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(image, collection)}
        style={{ padding: 0, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.03)' }}>
          {image.matchedForCurrentUser && (
            <div style={{
              position: 'absolute',
              margin: 8,
              zIndex: 1,
              padding: '5px 8px',
              borderRadius: 999,
              background: 'rgba(29,158,117,0.82)',
              color: '#f4fff8',
              fontSize: 10,
              fontFamily: 'var(--f-mono)',
              letterSpacing: '0.08em',
            }}>
              YOU
            </div>
          )}
          <img
            src={cardSrc}
            alt={image.name}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </button>
      <div style={{ padding: '10px 11px 12px' }}>
        <div style={{
          fontSize: 12,
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {image.name}
        </div>
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>
            {image.likeCount || 0} likes
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ActionIconButton
              label={image.liked ? 'Unlike photo' : 'Like photo'}
              active={Boolean(image.liked)}
              accent="#ffb7bc"
              onClick={() => onToggleLike(image.photoId)}
            >
              <HeartIcon filled={Boolean(image.liked)} />
            </ActionIconButton>
            <ActionIconButton
              label="Share photo link"
              accent="#cfc7ff"
              onClick={() => onShare(image, collection)}
            >
              <ShareIcon />
            </ActionIconButton>
            {image.downloadUrl ? (
              <ActionIconButton
                label="Download photo"
                href={image.downloadUrl}
                accent="#ffe0a1"
              >
                <DownloadIcon />
              </ActionIconButton>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
