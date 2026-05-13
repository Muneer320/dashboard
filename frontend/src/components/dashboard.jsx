// Ascent — Dashboard + Event Detail (fully wired to backend)
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useMobile,
  NavBar,
  PageBackground,
  QRCode,
  PosterPlaceholder,
} from "./shared";
import { useUserAuth } from "../lib/UserAuthContext";
import {
  users,
  events as eventsApi,
  schedule as scheduleApi,
  announcements as annApi,
} from "../lib/api";
import { MirageEnrollmentCard } from "./MirageEnrollmentCard";
import { SubmissionPanel } from "./submission";

// ── Event banner URL helper ─────────────────────────────────────────
const _BANNER_MAP = {
  'robo race':        'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878463/robo_race_dyouxs.png',
  'robo run':         'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878462/robo_run_hmmcla.png',
  'robo soccer':      'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878462/Robo_soccer_b7cvxt.png',
  'anvil hackathon':  'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878460/Anvil_poydj2.png',
  'launchpad':        'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878460/Launchpad_dixz7h.png',
  'rethesis':         'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878461/rethesis_ir27ii.png',
  'override.exe':     'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878461/Override.exe_kmhpwv.png',
  'impulse':          'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878460/Impulse_fhczet.png',
  'invariant':        'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878459/Invariant_s7bl8i.webp',
  'genesis':          'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878464/Genesis_tnwjgk.png',
  'quanta':           'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878459/Invariant_s7bl8i.webp',
  'synapse':          'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878463/Synapse_dtk2nc.png',
  'ai film conclave': 'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878462/AI_film_conclave_s789t6.png',
  'ship to scale':   'https://res.cloudinary.com/dt1hemzmb/image/upload/f_auto,q_auto/1000126955_jjytt0',
  'tech play zone':   'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878463/Tech_play_zone_emyf1q.png',
};
function getEventBannerUrl(name) {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  
  // First try an exact match
  if (_BANNER_MAP[normalized]) {
    return _BANNER_MAP[normalized];
  }
  
  // Then try a fuzzy match: see if the event name contains any of the keys
  for (const [key, url] of Object.entries(_BANNER_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return url;
    }
  }
  
  return null;
}

// Events hosted on an external platform — no dashboard submission form
const PLATFORM_EVENT_NAMES = ['override.exe', 'impulse', 'invariant', 'synapse'];
function isPlatformEvent(name) {
  if (!name) return false;
  const normalized = name.toLowerCase().trim();
  return PLATFORM_EVENT_NAMES.some(plat => normalized.includes(plat));
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Spinner() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: 32,
        color: "var(--ink-mute)",
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ animation: "spin 1s linear infinite" }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
export function Dashboard() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const { user } = useUserAuth();

  const [profile, setProfile] = useState(null);
  const [myEvents, setMyEvents] = useState([]); // [ { eventId, eventData, entry } ]
  const [meals, setMeals] = useState([]); // MealSlot[]
  const [schedule, setSchedule] = useState([]); // ScheduleItem[] for today
  const [anns, setAnns] = useState([]); // Announcement[]
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Run all fetches in parallel
      const [profileData, eventsData, mealsData, scheduleData, annsData] =
        await Promise.allSettled([
          users.get(user.id),
          eventsApi.list(),
          users.meals(user.id),
          scheduleApi.byDate(today).catch(() => null), // 404 if no schedule today → null
          annApi.list(50),
        ]);

      if (profileData.status === "fulfilled") setProfile(profileData.value);
      if (mealsData.status === "fulfilled") setMeals(mealsData.value ?? []);

      // Cross-reference registered events
      const allEvents = eventsData.status === "fulfilled" ? (eventsData.value ?? []) : [];
      if (
        profileData.status === "fulfilled" &&
        eventsData.status === "fulfilled"
      ) {
        const prof = profileData.value;
        const registered = prof.events || {}; // { eventId: { isAttending, submitted, ... } }
        const mine = allEvents
          .filter((ev) => registered[ev.id])
          .map((ev) => ({
            eventId: ev.id,
            eventData: ev,
            entry: registered[ev.id],
          }));
        setMyEvents(mine);
      }

      // Filter announcements: broadcast categories go to all, event-targeted only to registrants
      if (annsData.status === "fulfilled") {
        const BROADCAST = new Set(["general", "pinned", "schedule", "meal", "alert", "info"]);
        const allEventNames = new Set(allEvents.map(e => e.name.trim().toLowerCase()));
        const myEventNames = new Set(
          (profileData.status === "fulfilled" ? allEvents.filter(ev => (profileData.value.events || {})[ev.id]) : [])
            .map(e => e.name.trim().toLowerCase())
        );
        const filtered = (annsData.value ?? []).filter(a => {
          const cat = (a.category || "general").trim().toLowerCase();
          if (BROADCAST.has(cat)) return true;
          if (allEventNames.has(cat)) return myEventNames.has(cat);
          return true;
        });
        setAnns(filtered);
      }

      // Today's schedule — extract items
      if (scheduleData.status === "fulfilled" && scheduleData.value) {
        setSchedule(scheduleData.value.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = profile?.name ?? user?.name ?? "…";
  const userId = user?.id ?? "";
  const qrValue = userId ? `ASCENT:${userId}` : "ASCENT:UNKNOWN";
  const qrLabel = userId ? userId.slice(0, 8).toUpperCase() : "UNKNOWN";

  return (
    <PageBackground
      bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg"
      blurAmount={16}
      dimAmount={0.78}
    >
      <NavBar variant="app" active="dashboard" />
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: isMobile ? "24px 16px 60px" : "40px 28px 80px",
        }}
      >
        {/* Welcome header */}
        <div
          className="fade-up"
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isMobile ? "flex-start" : "flex-end",
            gap: isMobile ? 16 : 0,
          }}
        >
          <div>
            <div className="eyebrow">
              // {today} ·{" "}
              {new Date().toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              IST
            </div>
            <h1
              className="display"
              style={{
                fontSize: isMobile ? 36 : 52,
                marginTop: 14,
                letterSpacing: "-0.02em",
              }}
            >
              {greeting()},{" "}
              <span style={{ color: "var(--violet)" }}>
                {displayName.split(" ")[0]}
              </span>
              .
            </h1>
            <div
              style={{ marginTop: 10, color: "var(--ink-dim)", fontSize: 14 }}
            >
              You have{" "}
              <span style={{ color: "var(--ink)" }}>
                {myEvents.length} event{myEvents.length !== 1 ? "s" : ""}
              </span>{" "}
              registered.
              {schedule.length > 0 &&
                ` First up: ${schedule[0].title}, ${fmtTime(schedule[0].start_time)} at ${schedule[0].venue}.`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="chip teal">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--teal)",
                }}
              />{" "}
              All systems go
            </a>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <div
            style={{
              marginTop: 36,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.35fr 1fr",
              gap: 20,
            }}
          >
            {/* LEFT column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <MirageEnrollmentCard />

              {/* Registered events */}
              <div className="glass" style={{ padding: isMobile ? 18 : 26 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="eyebrow">§ REGISTERED EVENTS</div>
                  <a
                    onClick={() => navigate("/explore")}
                    style={{
                      fontSize: 11,
                      color: "var(--violet)",
                      cursor: "pointer",
                      fontFamily: "var(--f-mono)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    BROWSE →
                  </a>
                </div>
                <div
                  style={{
                    marginTop: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {myEvents.length === 0 ? (
                    <div
                      style={{
                        color: "var(--ink-mute)",
                        fontSize: 13,
                        textAlign: "center",
                        padding: "24px 0",
                      }}
                    >
                      No events registered yet.{" "}
                      <a
                        onClick={() => navigate("/explore")}
                        style={{ color: "var(--violet)", cursor: "pointer" }}
                      >
                        Browse events →
                      </a>
                    </div>
                  ) : (
                    myEvents.map((ev) => {
                      const tones = ["violet", "teal", "amber"];
                      const tone = tones[myEvents.indexOf(ev) % tones.length];
                      const venue = Array.isArray(ev.eventData.venue)
                        ? ev.eventData.venue.join(" · ")
                        : ev.eventData.venue || "";
                      const isLive = ev.entry?.isAttending;
                      // Detect submission from new per-phase shape
                      const submission = ev.entry?.submission;
                      const hasSubmitted =
                        submission && typeof submission === "object"
                          ? Object.values(submission).some(
                              (p) => p?.submitted === true,
                            )
                          : !!submission; // fallback for legacy bool shape
                      return (
                        <div
                          key={ev.eventId}
                          onClick={() =>
                            navigate(`/event-detail/${ev.eventId}`)
                          }
                          style={{
                            display: "grid",
                            gridTemplateColumns: isMobile
                              ? "44px 1fr"
                              : "52px 1fr auto",
                            alignItems: "center",
                            gap: 12,
                            padding: 14,
                            borderRadius: 10,
                            border: "1px solid var(--glass-border)",
                            background: "rgba(255,255,255,0.02)",
                            cursor: "pointer",
                            transition: "all .2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor =
                              "rgba(127,119,221,0.35)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor =
                              "var(--glass-border)")
                          }
                        >
                          <div
                            style={{
                              width: isMobile ? 44 : 52,
                              height: isMobile ? 44 : 52,
                              borderRadius: 8,
                              background: `linear-gradient(135deg, rgba(127,119,221,0.3), rgba(29,158,117,0.1))`,
                              border: "1px solid rgba(255,255,255,0.08)",
                              display: "grid",
                              placeItems: "center",
                              fontFamily: "var(--f-display)",
                              fontSize: 18,
                              fontWeight: 700,
                            }}
                          >
                            {(ev.eventData.title || ev.eventData.name)[0]}
                          </div>
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "var(--f-display)",
                                  fontSize: 15,
                                  fontWeight: 600,
                                }}
                              >
                                {ev.eventData.title || ev.eventData.name}
                              </span>
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                color: "var(--ink-mute)",
                                fontSize: 11,
                                fontFamily: "var(--f-mono)",
                              }}
                            >
                              {venue}
                            </div>
                            {isMobile && (
                              <div
                                style={{
                                  marginTop: 4,
                                  fontFamily: "var(--f-mono)",
                                  fontSize: 11,
                                  color: isLive
                                    ? "var(--violet)"
                                    : "var(--ink-dim)",
                                }}
                              >
                                {isLive
                                  ? "Attending"
                                  : hasSubmitted
                                    ? "Submitted"
                                    : "Registered"}
                              </div>
                            )}
                          </div>
                          {!isMobile && (
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontFamily: "var(--f-mono)",
                                  fontSize: 11,
                                  color: isLive
                                    ? "var(--violet)"
                                    : hasSubmitted
                                      ? "var(--teal)"
                                      : "var(--ink-dim)",
                                  letterSpacing: "0.08em",
                                }}
                              >
                                {isLive
                                  ? "Attending"
                                  : hasSubmitted
                                    ? "Submitted"
                                    : "Registered"}
                              </div>
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 18,
                                  color: "var(--ink-mute)",
                                }}
                              >
                                →
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Schedule snapshot */}
              <div className="glass" style={{ padding: isMobile ? 18 : 26 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="eyebrow">§ SUBMISSIONS</div>
                </div>
                <div
                  style={{
                    marginTop: 20,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {myEvents.length === 0 ? (
                    <div
                      style={{
                        color: "var(--ink-mute)",
                        fontSize: 13,
                        textAlign: "center",
                        padding: "20px 0",
                      }}
                    >
                      No events registered yet.
                    </div>
                  ) : (
                    myEvents.map((ev, i) => {
                      const submission = ev.entry?.submission;
                      const hasSubmitted =
                        submission && typeof submission === "object"
                          ? Object.values(submission).some(
                              (p) => p?.submitted === true,
                            )
                          : !!submission;

                      // Find the active phase label from rounds
                      const rounds = ev.eventData?.rounds ?? {};
                      const activePhase = Object.entries(rounds).find(
                        ([, v]) => v?.is_active
                      );
                      const phaseLabel = activePhase
                        ? activePhase[1]?.title
                        : Object.values(rounds)[0]?.title ?? "Phase 1";
                      const venue = Array.isArray(ev.eventData.venue)
                        ? ev.eventData.venue.join(" · ")
                        : ev.eventData.venue || "";

                      return (
                        <div
                          key={ev.eventId}
                          onClick={() => navigate(`/event-detail/${ev.eventId}`)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            padding: "13px 0",
                            borderTop: i === 0 ? "none" : "1px solid var(--glass-border)",
                            cursor: "pointer",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                              {ev.eventData.title || ev.eventData.name}
                            </div>
                            <div style={{
                              fontSize: 10, color: "var(--ink-mute)",
                              fontFamily: "var(--f-mono)", marginTop: 3,
                              letterSpacing: "0.06em",
                            }}>
                              {phaseLabel}{venue ? ` · ${venue}` : ""}
                            </div>
                          </div>
                          <div style={{
                            flexShrink: 0,
                            fontSize: 10,
                            fontFamily: "var(--f-mono)",
                            fontWeight: 600,
                            letterSpacing: "0.08em",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: hasSubmitted
                              ? "rgba(72, 199, 142, 0.12)"
                              : "rgba(220, 80, 80, 0.1)",
                            color: hasSubmitted ? "#48C78E" : "#E07070",
                            border: hasSubmitted
                              ? "1px solid rgba(72,199,142,0.35)"
                              : "1px solid rgba(220,80,80,0.3)",
                          }}>
                            {hasSubmitted ? "✓ SUBMITTED" : "PENDING"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* FOOD QR */}
              <div
                className="glass-strong"
                style={{
                  padding: isMobile ? 18 : 26,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -80,
                    right: -80,
                    width: 240,
                    height: 240,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(closest-side, rgba(127,119,221,0.25), transparent 70%)",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    position: "relative",
                  }}
                >
                  <div>
                    <div className="eyebrow" style={{ color: "var(--violet)" }}>
                      § FOOD QR
                    </div>
                    <div
                      className="display"
                      style={{
                        fontSize: 20,
                        marginTop: 10,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Scan at any meal counter.
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        color: "var(--ink-mute)",
                        fontSize: 12,
                      }}
                    >
                      One code · all meals · both days
                    </div>
                  </div>
                  <div
                    className="chip teal"
                    style={{ padding: "4px 10px", fontSize: 9.5 }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--teal)",
                        boxShadow: "0 0 8px var(--teal)",
                      }}
                    />
                    ACTIVE
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 22,
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    gap: 18,
                    alignItems: isMobile ? "center" : "flex-start",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.03)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(127,119,221,0.4)",
                      boxShadow: "0 0 40px rgba(127,119,221,0.25)",
                    }}
                  >
                    <QRCode size={isMobile ? 120 : 152} seed={qrValue} />
                  </div>
                  <div style={{ flex: 1, width: isMobile ? "100%" : "auto" }}>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>
                      MEAL LOG
                    </div>
                    {meals.length === 0 ? (
                      <div style={{ color: "var(--ink-mute)", fontSize: 12 }}>
                        Loading meals…
                      </div>
                    ) : (
                      meals.map((m, i) => (
                        <div
                          key={m.slot}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "6px 0",
                            borderTop:
                              i === 0
                                ? "none"
                                : "1px solid var(--glass-border)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: m.collected
                                ? "var(--ink)"
                                : "var(--ink-dim)",
                            }}
                          >
                            {m.collected ? "✓ " : "○ "}
                            {m.label}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--f-mono)",
                              fontSize: 10,
                              color: "var(--ink-mute)",
                            }}
                          >
                            {m.collected ? "Collected" : "Pending"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 18,
                    fontFamily: "var(--f-mono)",
                    fontSize: 10,
                    color: "var(--ink-mute)",
                    letterSpacing: "0.12em",
                    textAlign: "center",
                  }}
                >
                  ID · {qrLabel} · ASCENT 2026
                </div>
              </div>

              {/* Announcements feed */}
              <div className="glass" style={{ padding: isMobile ? 18 : 26 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="eyebrow">§ ANNOUNCEMENTS</div>
                  <a
                    onClick={() => navigate("/announcements")}
                    style={{
                      fontSize: 11,
                      color: "var(--violet)",
                      cursor: "pointer",
                      fontFamily: "var(--f-mono)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    ALL →
                  </a>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {anns.length === 0 ? (
                    <div
                      style={{
                        color: "var(--ink-mute)",
                        fontSize: 13,
                        textAlign: "center",
                        padding: "16px 0",
                      }}
                    >
                      No announcements yet.
                    </div>
                  ) : (
                    anns.slice(0, 3).map((a, i) => (
                      <div
                        key={a.id || i}
                        onClick={() => navigate("/announcements")}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 8,
                          border: (a.is_pinned || a.category === "pinned")
                            ? "1px solid rgba(127,119,221,0.4)"
                            : "1px solid var(--glass-border)",
                          background: (a.is_pinned || a.category === "pinned")
                            ? "rgba(127,119,221,0.08)"
                            : "rgba(255,255,255,0.02)",
                          cursor: "pointer",
                          transition: "background .15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = (a.is_pinned || a.category === "pinned") ? "rgba(127,119,221,0.13)" : "rgba(255,255,255,0.05)"}
                        onMouseLeave={e => e.currentTarget.style.background = (a.is_pinned || a.category === "pinned") ? "rgba(127,119,221,0.08)" : "rgba(255,255,255,0.02)"}
                      >
                        {/* Header row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <div>
                            {(a.is_pinned || a.category === "pinned") && (
                              <span
                                className="chip violet"
                                style={{ padding: "1px 6px", fontSize: 8 }}
                              >
                                📌 PIN
                              </span>
                            )}
                          </div>
                          <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {relTime(a.time)}
                          </span>
                        </div>
                        {/* Title */}
                        {a.title && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }}>
                            {a.title}
                          </div>
                        )}
                        {/* Body — 2-line clamp */}
                        <div style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {a.announcement}
                        </div>
                      </div>
                    ))
                  )}

                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageBackground>
  );
}

// ─────────────────────────────────────────────────────────────
// Event Detail
// ─────────────────────────────────────────────────────────────

/**
 * Map a round entry from event.rounds into a normalised shape used by the UI.
 * Derives live/done/upcoming state from is_active + is_locked flags.
 * Returns { key, phaseNum, title, state, desc, startTime, endTime, phaseData }
 */
function normaliseRound(key, val) {
  const phaseMatch = key.match(/^phase(\d+)$/);
  const phaseNum = phaseMatch ? parseInt(phaseMatch[1], 10) : null;
  const isActive = !!val?.is_active;
  const isLocked = !!val?.is_locked;
  const now = new Date();
  const endTime = val?.end_time ? new Date(val.end_time) : null;
  const startTime = val?.start_time ? new Date(val.start_time) : null;

  let state;
  if (isLocked) {
    // Only show "done" if it had a start_time that has already passed
    state = (startTime && startTime < now) ? "locked" : "upcoming";
  } else if (isActive) {
    // Auto-close by time: if end_time passed, treat as closed
    state = (endTime && now > endTime) ? "closed" : "live";
  } else {
    state = "upcoming";
  }

  return {
    key,
    phaseNum,
    title: val?.title || key,
    timeLabel: val?.start_time ? fmtTime(val.start_time) : (val?.time ?? ""),
    state,
    desc: val?.description ?? "",
    startTime: val?.start_time ?? null,
    endTime: val?.end_time ?? null,
    phaseData: val ?? null,
  };
}

/** Small dot indicator next to a round state label */
function RoundStateDot({ state }) {
  const colors = {
    live: "var(--violet)",
    locked: "var(--teal)",
    upcoming: "var(--ink-mute)",
    closed: "var(--ink-mute)",
  };
  const labels = { live: "LIVE", locked: "✓ DONE", upcoming: "SOON", closed: "CLOSED" };
  return (
    <span
      style={{
        fontFamily: "var(--f-mono)",
        fontSize: 9,
        letterSpacing: "0.1em",
        color: colors[state] ?? "var(--ink-mute)",
      }}
    >
      {labels[state] ?? state.toUpperCase()}
    </span>
  );
}

/** Phase timing ribbon shown below the selected round card */
function PhaseTimingRibbon({ phaseData }) {
  if (!phaseData) return null;
  const { start_time, end_time, is_active, is_locked } = phaseData;
  const items = [];
  if (start_time) items.push(["Opens", fmtDateTime(start_time)]);
  if (end_time) items.push(["Closes", fmtDateTime(end_time)]);
  if (items.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10 }}>
      {items.map(([label, val]) => (
        <div key={label}>
          <div
            style={{
              fontFamily: "var(--f-mono)",
              fontSize: 9,
              color: "var(--ink-mute)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "var(--f-mono)",
              fontSize: 11,
              color: "var(--ink-dim)",
              marginTop: 2,
            }}
          >
            {val}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function EventDetail() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const { eventId } = useParams();

  const [event, setEvent] = useState(null);
  const [team, setTeam] = useState(null);
  const [evSched, setEvSched] = useState([]);
  const [userEntry, setEntry] = useState(null); // users.events[eventId]
  const [profile, setProfile] = useState(null); // full user profile for submission prefill
  const [loading, setLoading] = useState(true);

  // Which round tab is selected (index into `rounds` array)
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Track if a submission just succeeded (to refresh the "submitted" badge)
  const [submittedPhases, setSubmittedPhases] = useState(new Set());

  // Stable reference: prevents SubmissionPanel's loadQuestions effect from
  // re-firing on every parent render (it has userData in its dependency array).
  const userData = useMemo(() => ({
    email:    profile?.username || user?.username || '',
    name:     profile?.name    || user?.name    || '',
    teamName: team?.name || '',
    college:  profile?.details?.college || '',
    phone:    profile?.details?.phone   || '',
    year:     profile?.details?.year    || '',
    branch:   profile?.details?.branch  || '',
    gender:   profile?.details?.gender  || '',
    city:     profile?.details?.city    || '',
  }), [profile, user, team]);

  const load = useCallback(async () => {
    if (!user || !eventId) return;
    setLoading(true);
    try {
      const [evData, teamData, schedData, profileData] =
        await Promise.allSettled([
          eventsApi.get(eventId),
          eventsApi.myTeam(eventId).catch(() => null),
          scheduleApi.forEvent(eventId).catch(() => null),
          users.get(user.id),
        ]);
      if (evData.status === "fulfilled") setEvent(evData.value);
      if (teamData.status === "fulfilled") setTeam(teamData.value);
      if (schedData.status === "fulfilled" && schedData.value)
        setEvSched(schedData.value.schedule ?? []);
      if (profileData.status === "fulfilled") {
        setProfile(profileData.value);
        const reg = profileData.value.events || {};
        const entry = reg[eventId] ?? null;
        setEntry(entry);
        // Pre-compute which phases already have submissions
        if (entry?.submission && typeof entry.submission === "object") {
          const already = new Set();
          Object.entries(entry.submission).forEach(([phaseKey, phaseVal]) => {
            if (phaseVal?.submitted) already.add(phaseKey);
          });
          setSubmittedPhases(already);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <PageBackground
        bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg"
        blurAmount={18}
        dimAmount={0.8}
      >
        <NavBar variant="app" active="explore" />
        <Spinner />
      </PageBackground>
    );

  if (!event)
    return (
      <PageBackground
        bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg"
        blurAmount={18}
        dimAmount={0.8}
      >
        <NavBar variant="app" active="explore" />
        <div
          style={{ textAlign: "center", padding: 80, color: "var(--ink-mute)" }}
        >
          Event not found.
        </div>
      </PageBackground>
    );

  // ── Build normalised rounds list ─────────────────────────────────────────
  // Build rounds sorted by phase number
  const rounds = Object.entries(event.rounds ?? {})
    .map(([key, val]) => normaliseRound(key, val))
    .sort((a, b) => (a.phaseNum ?? 99) - (b.phaseNum ?? 99));

  // Phase-ordering gate: a phase can't be live/locked if any earlier phase
  // hasn't completed yet. Walk forward and override states accordingly.
  for (let i = 1; i < rounds.length; i++) {
    const prev = rounds[i - 1];
    if (prev.phaseNum && rounds[i].phaseNum) {
      if (prev.state === "upcoming" || prev.state === "live") {
        // Previous phase not yet done → force this phase to upcoming
        rounds[i] = { ...rounds[i], state: "upcoming" };
      }
    }
  }

  const selectedRound = rounds[selectedIdx] ?? null;
  const isRegistered = !!userEntry;
  const isRestricted = !!userEntry?.restricted;
  const hasAnySubmission = submittedPhases.size > 0;

  // ── Restriction gate — block the entire event detail ────────────────────────
  if (isRestricted) {
    return (
      <PageBackground
        bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg"
        blurAmount={18}
        dimAmount={0.85}
      >
        <NavBar variant="app" active="explore" />
        <div
          style={{
            minHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              marginBottom: 24,
            }}
          >
            ⛔
          </div>

          {/* Event name */}
          <p
            style={{
              fontFamily: "var(--f-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "#f87171",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            {event.title || event.name}
          </p>

          {/* Main message */}
          <h2
            style={{
              fontSize: isMobile ? 26 : 32,
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              maxWidth: 480,
              marginBottom: 16,
            }}
          >
            Sorry, you're restricted from this event.
          </h2>

          <p
            style={{
              fontSize: 15,
              color: "var(--ink-dim)",
              lineHeight: 1.65,
              maxWidth: 400,
              marginBottom: 8,
            }}
          >
            You cannot view event details or submit for this event.
          </p>

          <p
            style={{
              fontSize: 14,
              color: "var(--ink-mute)",
              lineHeight: 1.6,
              maxWidth: 400,
              marginBottom: 36,
            }}
          >
            For any queries, please contact your <strong style={{ color: "var(--ink-dim)" }}>POC</strong>.
          </p>

          {/* Back link */}
          <a
            onClick={() => navigate("/dashboard")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--f-mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--ink-mute)",
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            ← Back to Dashboard
          </a>
        </div>
      </PageBackground>
    );
  }

  const venue = Array.isArray(event.venue)
    ? event.venue.join(" · ")
    : event.venue || "";

  // Which phase number does the selected round map to?
  const currentPhase = selectedRound?.phaseNum ?? null;

  return (
    <PageBackground
      bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg"
      blurAmount={18}
      dimAmount={0.8}
    >
      <NavBar variant="app" active="explore" />
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: isMobile ? "20px 16px 60px" : "32px 28px 80px",
        }}
      >
        <a
          onClick={() => navigate("/dashboard")}
          style={{
            color: "var(--ink-mute)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "var(--f-mono)",
            letterSpacing: "0.1em",
          }}
        >
          ← DASHBOARD
        </a>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr",
            gap: 32,
            alignItems: "start",
          }}
        >
          {/* ── Left column ─────────────────────────────────────────── */}
          <div>
            {/* Status badges */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              {userEntry?.isAttending && (
                <span className="chip teal">ATTENDING</span>
              )}
              {hasAnySubmission && (
                <span className="chip violet">SUBMITTED</span>
              )}
              {venue && <span className="chip">{venue}</span>}
            </div>

            <h1
              className="display"
              style={{
                fontSize: isMobile ? 52 : 72,
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
              }}
            >
              {event.title || event.name}.
            </h1>
            <div
              style={{
                marginTop: 20,
                color: "var(--ink-dim)",
                fontSize: 15,
                lineHeight: 1.6,
                maxWidth: 540,
              }}
            >
              {event.description || "No description available."}
            </div>

            {/* ── Round timeline ───────────────────────────────────── */}
            {rounds.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <div className="eyebrow">§ ROUND TIMELINE</div>

                {/* Round selector tabs */}
                <div
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? `repeat(${Math.min(rounds.length, 3)}, 1fr)`
                      : `repeat(${Math.min(rounds.length, 6)}, 1fr)`,
                    gap: 8,
                  }}
                >
                  {rounds.map((r, i) => {
                    const isSelected = selectedIdx === i;
                    const hasSubmitted =
                      r.phaseNum && submittedPhases.has(`phase${r.phaseNum}`);
                    return (
                      <div
                        key={r.key}
                        onClick={() => setSelectedIdx(i)}
                        style={{
                          padding: isMobile ? 10 : 12,
                          borderRadius: 8,
                          cursor: "pointer",
                          transition: "all .2s",
                          border: isSelected
                            ? "1px solid rgba(127,119,221,0.8)"
                            : r.state === "live"
                              ? "1px solid rgba(127,119,221,0.5)"
                              : "1px solid var(--glass-border)",
                          background: isSelected
                            ? "rgba(127,119,221,0.18)"
                            : r.state === "live"
                              ? "rgba(127,119,221,0.08)"
                              : r.state === "locked"
                                ? "rgba(29,158,117,0.05)"
                                : "rgba(255,255,255,0.02)",
                          boxShadow: isSelected
                            ? "0 0 20px rgba(127,119,221,0.2)"
                            : "none",
                          position: "relative",
                        }}
                      >
                        {/* Submitted indicator dot */}
                        {hasSubmitted && (
                          <div
                            style={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "var(--teal)",
                              boxShadow: "0 0 6px var(--teal)",
                            }}
                          />
                        )}
                        <RoundStateDot state={r.state} />
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "var(--ink)",
                            fontWeight: 500,
                          }}
                        >
                          {r.title}
                        </div>
                        {r.timeLabel && (
                          <div
                            style={{
                              marginTop: 2,
                              fontFamily: "var(--f-mono)",
                              fontSize: 10,
                              color: "var(--ink-mute)",
                            }}
                          >
                            {r.timeLabel}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected round detail card */}
                {selectedRound && (
                  <div
                    className="glass"
                    style={{
                      marginTop: 14,
                      padding: "18px 20px",
                      borderLeft: `2px solid ${
                        selectedRound.state === "live"
                          ? "var(--violet)"
                          : selectedRound.state === "locked"
                            ? "var(--teal)"
                            : "rgba(255,255,255,0.12)"
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          className="eyebrow"
                          style={{
                            color:
                              selectedRound.state === "live"
                                ? "var(--violet)"
                                : selectedRound.state === "locked"
                                  ? "var(--teal)"
                                  : "var(--ink-mute)",
                          }}
                        >
                          {selectedRound.title}
                          {selectedRound.timeLabel &&
                            ` · ${selectedRound.timeLabel}`}
                        </div>
                        {selectedRound.desc && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 13,
                              color: "var(--ink-dim)",
                              lineHeight: 1.5,
                            }}
                          >
                            {selectedRound.desc}
                          </div>
                        )}
                        <PhaseTimingRibbon
                          phaseData={selectedRound.phaseData}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {selectedRound.state === "live" && (
                          <a
                            onClick={() =>
                              document
                                .getElementById("submission-form")
                                ?.scrollIntoView({ behavior: "smooth" })
                            }
                            className="btn sm primary"
                          >
                            Submit ⤴
                          </a>
                        )}
                        {selectedRound.state === "upcoming" && (
                          <span
                            className="btn sm"
                            style={{ cursor: "default", opacity: 0.6 }}
                          >
                            Opening soon…
                          </span>
                        )}
                        {(selectedRound.state === "locked" || selectedRound.state === "closed") && (
                          <span
                            className="btn sm ghost"
                            style={{ cursor: "default", opacity: 0.6 }}
                          >
                            Phase closed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── WhatsApp community banner ────────────────────────── */}
            {event.community_link && (
              <div
                style={{
                  marginTop: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "16px 22px",
                  borderRadius: 14,
                  background: "rgba(37,211,102,0.07)",
                  border: "1px solid rgba(37,211,102,0.25)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* WhatsApp icon */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "rgba(37,211,102,0.15)",
                      border: "1px solid rgba(37,211,102,0.35)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#25d366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                      Are you in the event community?
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                      Join the WhatsApp group for updates and announcements.
                    </div>
                  </div>
                </div>
                <a
                  href={event.community_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 18px",
                    borderRadius: 8,
                    background: "#25d366",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    textDecoration: "none",
                    flexShrink: 0,
                    transition: "opacity 0.15s ease",
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  Join Now →
                </a>
              </div>
            )}

            {/* ── Submission panel ────────────────────────────────── */}
            <div id="submission-form" style={{ marginTop: 40 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div className="eyebrow">§ SUBMISSION</div>
                {selectedRound && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--f-mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.1em",
                        color:
                          selectedRound.state === "live"
                            ? "var(--violet)"
                            : "var(--ink-mute)",
                        border: "1px solid",
                        borderColor:
                          selectedRound.state === "live"
                            ? "rgba(127,119,221,0.4)"
                            : "var(--glass-border)",
                        borderRadius: 4,
                        padding: "2px 7px",
                      }}
                    >
                      {selectedRound.state === "live"
                        ? "● OPEN"
                        : selectedRound.state === "locked" || selectedRound.state === "closed"
                          ? "✓ CLOSED"
                          : "◌ NOT OPEN"}
                    </span>
                    {selectedRound.phaseNum && (
                      <span
                        style={{
                          fontFamily: "var(--f-mono)",
                          fontSize: 9.5,
                          color: "var(--ink-mute)",
                        }}
                      >
                        phase {selectedRound.phaseNum}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="glass" style={{ padding: isMobile ? 16 : 22 }}>
                {isPlatformEvent(event.name) ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 14, padding: '28px 16px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 36 }}>🖥️</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                      This event runs on an external platform
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-dim)', maxWidth: 400, lineHeight: 1.65 }}>
                      {event.name === 'Invariant' ? (
                        <span>
                          🔗 Contest Link:{' '}
                          <a
                            href="https://codeforces.com/contestInvitation/c3e58e74ce68fc59dac43d185f50f2c38320adef"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--violet)', textDecoration: 'underline', textUnderlineOffset: 2, wordBreak: 'break-all' }}
                          >
                            https://codeforces.com/contestInvitation/c3e58e74ce68fc59dac43d185f50f2c38320adef
                          </a>
                        </span>
                      ) : event.name === 'Impulse' ? (
                        'Impulse is hosted live on Codeforces / HackerRank. Head there to participate—your team\'s submission is tracked on the contest platform.'
                      ) : event.name?.toLowerCase().includes('synapse') ? (
                        isRegistered ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span>
                              🔗 Competition Link:{' '}
                              <a
                                href="https://www.kaggle.com/t/05ed16babc1145a48e60f59c731f1767"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--violet)', textDecoration: 'underline', textUnderlineOffset: 2, wordBreak: 'break-all' }}
                              >
                                https://www.kaggle.com/t/05ed16babc1145a48e60f59c731f1767
                              </a>
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                              📌 You can make multiple submissions — your best score will be considered.
                            </span>
                          </div>
                        ) : (
                          <span>
                            Synapse is hosted on Kaggle. Please <strong style={{ color: 'var(--ink)' }}>register</strong> for the event to view the competition link.
                          </span>
                        )
                      ) : (
                        'Override.exe is a live CTF event. The platform link will be shared before the event starts. Submit your flags directly on the CTF platform.'
                      )}
                    </div>
                    <div style={{
                      fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--violet)',
                      background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.3)',
                      borderRadius: 6, padding: '8px 16px', letterSpacing: '0.08em',
                    }}>
                      ● EVENT IS LIVE ON THE PLATFORM
                    </div>
                  </div>
                ) : currentPhase ? (
                  <SubmissionPanel
                    key={`${eventId}-phase${currentPhase}`}
                    eventId={eventId}
                    phase={currentPhase}
                    phaseData={selectedRound?.phaseData}
                    isRegistered={isRegistered}
                    isRestricted={isRestricted}
                    userData={userData}
                    onSuccess={() => {
                      setSubmittedPhases(
                        (prev) => new Set([...prev, `phase${currentPhase}`]),
                      );
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--ink-mute)', textAlign: 'center', padding: '20px 0' }}>
                    {rounds.length === 0
                      ? 'No phases configured for this event.'
                      : 'Select a round above to view its submission form.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right sidebar (sticky) ───────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              position: isMobile ? "static" : "sticky",
              top: 90,
            }}
          >
            {(() => {
              const bannerUrl = getEventBannerUrl(event.name);
              return bannerUrl ? (
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img
                    src={bannerUrl}
                    alt={event.name}
                    style={{ width: '100%', aspectRatio: '7/4', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ) : (
                <PosterPlaceholder
                  title={event.name.toUpperCase()}
                  sub="700 × 400"
                  w="100%"
                  h="auto"
                  style={{ aspectRatio: "7/4" }}
                  tone="violet"
                />
              );
            })()}

            {/* Team card */}
            {team && (
              <div className="glass" style={{ padding: 20 }}>
                <div className="eyebrow">
                  § YOUR TEAM · {team.name?.toUpperCase() ?? "TEAM"}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {(team.members ?? []).map((m, i) => (
                    <div
                      key={m.id ?? i}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, hsl(${i * 80 + 220} 40% 50%), hsl(${i * 80 + 160} 40% 40%))`,
                          border: "1px solid var(--glass-border)",
                          display: "grid",
                          placeItems: "center",
                          fontFamily: "var(--f-mono)",
                          fontSize: 10,
                          flexShrink: 0,
                        }}
                      >
                        {(m.name ?? "?")
                          .split(" ")
                          .map((x) => x[0])
                          .join("")}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>
                          {m.name}
                          {String(m.id) === String(user?.id) && (
                            <span
                              style={{
                                color: "var(--violet)",
                                fontSize: 10,
                                fontFamily: "var(--f-mono)",
                              }}
                            >
                              {" "}
                              · YOU
                            </span>
                          )}
                          {m.is_leader && (
                            <span
                              style={{
                                color: "var(--teal)",
                                fontSize: 10,
                                fontFamily: "var(--f-mono)",
                              }}
                            >
                              {" "}
                              · LEAD
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                          {m.username}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
