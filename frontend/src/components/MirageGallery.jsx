import React from 'react';
import { useNavigate } from 'react-router-dom';

import { mirage as mirageApi } from '../lib/api';
import { useUserAuth } from '../lib/UserAuthContext';
import { MirageEnrollmentCard } from './MirageEnrollmentCard';
import { MirageMomentHero } from './MirageMomentHero';
import { NavBar, PageBackground, useMobile } from './shared';

const SEARCH_PHOTOS_PAGE_SIZE = 12;

function MirageEmptyPublishedState({ isMobile }) {
  const navigate = useNavigate();
  return (
    <section
      className="glass"
      aria-labelledby="mirage-empty-title"
      style={{
        marginTop: isMobile ? 28 : 36,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 26,
        padding: isMobile ? '48px 22px 52px' : '72px 48px 80px',
        border: '1px solid rgba(255,255,255,0.09)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 'min(92vw, 520px)',
          height: 'min(92vw, 520px)',
          left: '50%',
          top: '42%',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle at 50% 45%, rgba(127,119,221,0.22) 0%, rgba(127,119,221,0.06) 38%, transparent 62%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
        <div
          aria-hidden
          style={{
            position: 'relative',
            width: isMobile ? 168 : 200,
            height: isMobile ? 148 : 172,
            margin: '0 auto 40px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: isMobile ? 108 : 124,
              height: isMobile ? 126 : 142,
              left: isMobile ? 4 : 8,
              top: isMobile ? 18 : 22,
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'linear-gradient(145deg, rgba(127,119,221,0.12), rgba(8,12,28,0.5))',
              transform: 'rotate(-10deg)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: isMobile ? 108 : 124,
              height: isMobile ? 126 : 142,
              right: isMobile ? 2 : 6,
              top: isMobile ? 14 : 18,
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(8,12,28,0.55))',
              transform: 'rotate(11deg)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              width: isMobile ? 118 : 134,
              height: isMobile ? 138 : 154,
              borderRadius: 20,
              border: '1px solid rgba(127,119,221,0.35)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(10,14,36,0.65) 100%)',
              boxShadow: '0 22px 56px rgba(0,0,0,0.45)',
              display: 'grid',
              placeItems: 'center',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden style={{ opacity: 0.85 }}>
              <path
                d="M4 7a2 2 0 012-2h2l1-2h6l1 2h2a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                stroke="rgba(241,239,232,0.55)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.25" stroke="rgba(127,119,221,0.75)" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        <div className="eyebrow" style={{ letterSpacing: '0.28em', opacity: 0.65 }}>
          Mirage archive
        </div>
        <h2
          id="mirage-empty-title"
          style={{
            marginTop: 14,
            fontFamily: 'var(--f-display)',
            fontSize: isMobile ? 30 : 40,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            color: 'var(--ink)',
          }}
        >
          Your gallery opens here
        </h2>
        <p
          style={{
            marginTop: 18,
            fontSize: isMobile ? 15 : 16,
            lineHeight: 1.75,
            color: 'var(--ink-dim)',
          }}
        >
          When organizers publish event folders to Mirage, collections and previews appear automatically.
          Build your face profile so approved matches surface under{' '}
          <span style={{ color: 'var(--ink)', opacity: 0.92 }}>Matched for you</span>.
        </p>
        <div
          style={{
            marginTop: 36,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button type="button" className="btn primary" onClick={() => navigate('/mirage/profile')}>
            Build face profile
          </button>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              const el = document.querySelector('[aria-label="Search Mirage photos by name or email"]');
              el?.focus?.();
              el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            }}
          >
            Search people
          </button>
        </div>
      </div>
    </section>
  );
}

function MiragePaginationControls({
  page,
  totalPages,
  onPrev,
  onNext,
  disabled,
}) {
  if (totalPages <= 1) return null;
  return (
    <div
      style={{
        marginTop: 14,
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        className="chip"
        style={{ cursor: 'pointer' }}
        disabled={disabled || page <= 0}
        onClick={onPrev}
      >
        Previous
      </button>
      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, opacity: 0.7 }}>
        Page {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        className="chip"
        style={{ cursor: 'pointer' }}
        disabled={disabled || page >= totalPages - 1}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}

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
  const [gallerySearchInput, setGallerySearchInput] = React.useState('');
  const [gallerySearchDebounced, setGallerySearchDebounced] = React.useState('');
  const [peopleSearchResult, setPeopleSearchResult] = React.useState(null);
  const [peopleSearchLoading, setPeopleSearchLoading] = React.useState(false);
  const [searchPhotoPage, setSearchPhotoPage] = React.useState(0);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setGallerySearchDebounced(gallerySearchInput.trim());
    }, 380);
    return () => window.clearTimeout(id);
  }, [gallerySearchInput]);

  React.useEffect(() => {
    setSearchPhotoPage(0);
  }, [gallerySearchDebounced]);

  React.useEffect(() => {
    let cancelled = false;
    if (locked || gallerySearchDebounced.length < 2) {
      setPeopleSearchResult(null);
      setPeopleSearchLoading(false);
      return () => { cancelled = true; };
    }
    setPeopleSearchLoading(true);
    mirageApi
      .searchPeople(gallerySearchDebounced)
      .then((data) => {
        if (!cancelled) setPeopleSearchResult(data && typeof data === 'object' ? data : null);
      })
      .catch(() => {
        if (!cancelled) setPeopleSearchResult(null);
      })
      .finally(() => {
        if (!cancelled) setPeopleSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [gallerySearchDebounced, locked]);

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
        const ok =
          data
          && typeof data === 'object'
          && data.momentId
          && Array.isArray(data.images)
          && data.images.length > 0;
        setHeroMoment(ok ? data : null);
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

  const editorialMoment =
    heroMoment != null
    && Array.isArray(heroMoment.images)
    && heroMoment.images.length > 0
      ? heroMoment
      : null;

  const fallbackGallerySlides = React.useMemo(() => {
    const featured = overview.featuredCollections || [];
    const byDay = (overview.collectionsByDay || []).flatMap((group) => group.collections || []);
    const seenIds = new Set(featured.map((c) => c.id));
    const ordered = [...featured, ...byDay.filter((c) => c?.id && !seenIds.has(c.id))];

    const seen = new Set();
    const out = [];
    for (const collection of ordered) {
      if (!collection) continue;
      const pools = [
        ...(collection.highlightImages || []),
        ...(collection.previewImages || []),
        ...(collection.coverImage ? [collection.coverImage] : []),
      ];
      for (const photo of pools) {
        if (!photo?.photoId || seen.has(photo.photoId)) continue;
        seen.add(photo.photoId);
        const imageUrl = photo.url || photo.thumbnailUrl;
        const thumbnailUrl = photo.thumbnailUrl || photo.url;
        if (!imageUrl && !thumbnailUrl) continue;
        out.push({
          imageId: photo.photoId,
          displayOrder: out.length + 1,
          storagePath: '',
          filename: photo.name || String(photo.photoId),
          mimeType: 'image/jpeg',
          isCover: false,
          imageUrl,
          thumbnailUrl,
          slideTitle: photo.eventName || photo.name || null,
          participants: [],
        });
        if (out.length >= 10) break;
      }
      if (out.length >= 10) break;
    }
    return out;
  }, [overview.collectionsByDay, overview.featuredCollections]);

  const fallbackMoment = React.useMemo(() => {
    if (!fallbackGallerySlides.length) return null;
    return {
      momentId: '__mirage_gallery_fallback',
      title: 'The weekend, as seen.',
      images: fallbackGallerySlides,
    };
  }, [fallbackGallerySlides]);

  const heroMomentResolved = editorialMoment ?? fallbackMoment;

  const showMomentHero =
    !locked
    && heroMomentResolved != null
    && (heroMomentResolved.images?.length ?? 0) > 0
    && (!!editorialMoment || !loading);

  const heroEyebrow = editorialMoment ? 'Moment of the day' : 'Mirage spotlight';

  const resolveCollectionForPhoto = React.useCallback(
    (photo) => {
      const cols = (overview.collectionsByDay || []).flatMap((group) => group.collections || []);
      return cols.find((item) => item.id === photo.jobId || item.eventId === photo.eventId);
    },
    [overview.collectionsByDay],
  );

  const searchPhotosFlat = React.useMemo(() => {
    const people = peopleSearchResult?.people;
    if (!Array.isArray(people) || !people.length) return [];
    const seen = new Set();
    const out = [];
    people.forEach((person) => {
      (person.photos || []).forEach((ph) => {
        if (!ph?.photoId || seen.has(ph.photoId)) return;
        seen.add(ph.photoId);
        out.push({
          ...ph,
          _matchLabel: [person.name, person.email].filter(Boolean).join(' · '),
        });
      });
    });
    return out;
  }, [peopleSearchResult]);

  const gallerySearchActive = gallerySearchDebounced.length >= 2;

  const searchPhotoTotalPages = Math.max(
    1,
    Math.ceil(searchPhotosFlat.length / SEARCH_PHOTOS_PAGE_SIZE) || 1,
  );
  const safeSearchPhotoPage = Math.min(Math.max(0, searchPhotoPage), searchPhotoTotalPages - 1);
  const paginatedSearchPhotos = searchPhotosFlat.slice(
    safeSearchPhotoPage * SEARCH_PHOTOS_PAGE_SIZE,
    safeSearchPhotoPage * SEARCH_PHOTOS_PAGE_SIZE + SEARCH_PHOTOS_PAGE_SIZE,
  );

  const dayOptions = ['All', ...(overview.dayLabels || [])];
  const visibleDayGroups = selectedDay === 'All'
    ? (overview.collectionsByDay || [])
    : (overview.collectionsByDay || []).filter((day) => day.dayLabel === selectedDay);
  const noPublishedMirage =
    !locked && !loading && !error && visibleDayGroups.length === 0;
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
        {showMomentHero ? (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'flex-end',
                gap: 12,
              }}
            >
              <div className="eyebrow">Mirage · Photo Archive</div>
              <div
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: 11,
                  color: 'var(--ink-mute)',
                  letterSpacing: '0.1em',
                }}
              >
                {totalPhotos} PHOTOS · {overview.totalCollections || 0} COLLECTIONS
              </div>
            </div>
            <MirageMomentHero
              moment={heroMomentResolved}
              isMobile={isMobile}
              eyebrowLabel={heroEyebrow}
            />
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'flex-end',
              gap: 12,
            }}
          >
            <div>
              <div className="eyebrow">Mirage · Photo Archive</div>
              <h1
                className="display"
                style={{
                  fontSize: isMobile ? 40 : 72,
                  marginTop: 14,
                  letterSpacing: '-0.03em',
                }}
              >
                The weekend, as seen.
              </h1>
              <div
                style={{
                  marginTop: 10,
                  maxWidth: 700,
                  color: 'var(--ink-dim)',
                  fontSize: 14,
                  lineHeight: 1.65,
                }}
              >
                A polished event gallery for every student: curated collections and shareable moments pulled straight from Mirage.
              </div>
            </div>
            {!isMobile && (
              <div
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: 11,
                  color: 'var(--ink-mute)',
                  letterSpacing: '0.1em',
                }}
              >
                {totalPhotos} PHOTOS · {overview.totalCollections || 0} COLLECTIONS
              </div>
            )}
          </div>
        )}

        {!locked && user?.id && (
          <div style={{ marginTop: noPublishedMirage ? (isMobile ? 28 : 36) : 24 }}>
            <MirageEnrollmentCard />
          </div>
        )}

        {!locked && (
          <div
            className="glass"
            style={{
              marginTop: noPublishedMirage ? (isMobile ? 28 : 34) : 22,
              padding: noPublishedMirage
                ? (isMobile ? '22px 20px 26px' : '26px 32px 30px')
                : (isMobile ? '14px 16px' : '16px 20px'),
              borderRadius: 18,
            }}
          >
            <div className="eyebrow">Find people</div>
            <input
              type="search"
              value={gallerySearchInput}
              onChange={(e) => setGallerySearchInput(e.target.value)}
              placeholder="Search by student name or email…"
              aria-label="Search Mirage photos by name or email"
              style={{
                marginTop: 12,
                width: '100%',
                maxWidth: 520,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--ink)',
                fontSize: 14,
              }}
            />
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
              Enter at least 2 characters. Shows photos linked to matching students in published Mirage galleries.
            </div>
          </div>
        )}

        {gallerySearchActive ? (
          <div className="glass" style={{ marginTop: 26, padding: isMobile ? 18 : 22 }}>
            <div className="eyebrow">Search results</div>
            {peopleSearchLoading ? (
              <div style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-mute)' }}>Searching…</div>
            ) : searchPhotosFlat.length === 0 ? (
              <div
                style={{
                  marginTop: 28,
                  padding: isMobile ? '44px 20px 48px' : '56px 36px 60px',
                  textAlign: 'center',
                  borderRadius: 22,
                  border: '1px dashed rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 28, color: 'var(--ink)' }}>
                  No photos matched
                </div>
                <div style={{ marginTop: 14, fontSize: 14, color: 'var(--ink-mute)', lineHeight: 1.7, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                  Try another name or email fragment. Only students with published Mirage links appear here.
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginTop: 14,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                  }}
                >
                  {paginatedSearchPhotos.map((photo) => {
                    const collection = resolveCollectionForPhoto(photo);
                    return (
                      <button
                        key={photo.photoId}
                        type="button"
                        disabled={!collection}
                        onClick={() => collection && handleOpenPhoto(photo, collection)}
                        style={{
                          padding: 0,
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 16,
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.03)',
                          cursor: collection ? 'pointer' : 'default',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }}>
                          <img
                            src={imageSrc(photo, 'thumb')}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                        {photo._matchLabel ? (
                          <div
                            style={{
                              padding: '8px 10px',
                              fontSize: 11,
                              color: 'var(--ink-dim)',
                              lineHeight: 1.35,
                              wordBreak: 'break-word',
                            }}
                          >
                            {photo._matchLabel}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <MiragePaginationControls
                  page={safeSearchPhotoPage}
                  totalPages={searchPhotoTotalPages}
                  disabled={peopleSearchLoading}
                  onPrev={() => setSearchPhotoPage((p) => Math.max(0, p - 1))}
                  onNext={() =>
                    setSearchPhotoPage((p) => Math.min(searchPhotoTotalPages - 1, p + 1))}
                />
              </>
            )}
          </div>
        ) : noPublishedMirage ? (
          <MirageEmptyPublishedState isMobile={isMobile} />
        ) : !locked && !loading ? (
          <div style={{ marginTop: isMobile ? 32 : 44 }}>
            <p style={{ fontSize: 14, color: 'var(--ink-mute)', maxWidth: 560, lineHeight: 1.65 }}>
              Tip: search finds photos linked to a student once live galleries are published.
            </p>
          </div>
        ) : null}

        {!noPublishedMirage && (
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

        {loading && (
          <div
            style={{
              marginTop: isMobile ? 40 : 52,
              minHeight: noPublishedMirage ? '28vh' : '22vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-mute)',
              fontFamily: 'var(--f-mono)',
              fontSize: 12,
              letterSpacing: '0.1em',
            }}
          >
            Loading Mirage…
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

        {!loading && !error && !noPublishedMirage && (
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
