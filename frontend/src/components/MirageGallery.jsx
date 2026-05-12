import React from 'react';

import { mirage as mirageApi } from '../lib/api';
import { useUserAuth } from '../lib/UserAuthContext';
import { MirageEnrollmentCard } from './MirageEnrollmentCard';
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
    try {
      const result = await mirageApi.toggleLike(photoId);
      updatePhotoState(photoId, (photo) => ({
        ...photo,
        liked: result.liked,
        likeCount: result.likeCount,
      }));
    } catch (err) {
      setNotice(err.message || 'Could not update the like.');
    }
  }, [updatePhotoState]);

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

  return (
    <PageBackground bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg" blurAmount={18} dimAmount={0.80}>
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
            <h1 className="display" style={{ fontSize: isMobile ? 40 : 72, marginTop: 14, letterSpacing: '-0.03em' }}>The weekend, as seen.</h1>
            <div style={{ marginTop: 10, maxWidth: 700, color: 'var(--ink-dim)', fontSize: 14, lineHeight: 1.65 }}>
              A polished event gallery for every student: trending frames, event-wise highlights, curated collections, and shareable moments pulled straight from Mirage.
            </div>
          </div>
          {!isMobile && (
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
              {totalPhotos} PHOTOS · {overview.totalCollections || 0} COLLECTIONS
            </div>
          )}
        </div>

        {!locked && user?.id && (
          <div style={{ marginTop: 24 }}>
            <MirageEnrollmentCard />
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

        {loading && (
          <div style={{ marginTop: 28, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', fontSize: 12 }}>
            Building Mirage collections...
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

        {!loading && !error && visibleDayGroups.length === 0 && !locked && (
          <div style={{ marginTop: 28, color: 'var(--ink-mute)', fontSize: 14 }}>
            No Mirage folders are published yet.
          </div>
        )}

        {!loading && !error && (
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
                  <div style={{ marginTop: 16, color: 'var(--ink-mute)', fontSize: 12 }}>
                    Finding your approved Mirage photos...
                  </div>
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
                  <div style={{ marginTop: 18, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', fontSize: 12 }}>
                    Loading collection frames...
                  </div>
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
                <button
                  type="button"
                  className="btn sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleLike(lightbox.photoId);
                  }}
                  style={{ padding: '6px 12px', fontSize: 11 }}
                >
                  {lightbox.liked ? `Liked · ${lightbox.likeCount}` : `Like · ${lightbox.likeCount}`}
                </button>
                {selectedCollection && (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleShare(lightbox, selectedCollection);
                    }}
                    style={{ padding: '6px 12px', fontSize: 11 }}
                  >
                    Share
                  </button>
                )}
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
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => onToggleLike(image.photoId)}
            className="chip"
            style={{ padding: '6px 10px', fontSize: 10, cursor: 'pointer' }}
          >
            {image.liked ? `Liked · ${image.likeCount}` : `Like · ${image.likeCount}`}
          </button>
          <button
            type="button"
            onClick={() => onShare(image, collection)}
            className="chip"
            style={{ padding: '6px 10px', fontSize: 10, cursor: 'pointer' }}
          >
            {isMobile ? 'Share' : 'Share Link'}
          </button>
          {image.downloadUrl ? (
            <a
              href={image.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="chip"
              style={{ padding: '6px 10px', fontSize: 10, textDecoration: 'none' }}
            >
              Download
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
