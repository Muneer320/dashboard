// Ascent — Merch Store
import React, { useState } from "react";
import { useMobile, NavBar, PageBackground } from "./shared";
import { useUserAuth } from "../lib/UserAuthContext";
import PaymentModal from "./PaymentModal";

const ITEMS = [
  {
    id: "badge",
    name: "Badge",
    description: "Collectible pin badge with the Ascent emblem.",
    price: 79,
    originalPrice: 99,
    image: "/merch/badge.jpeg",
    tag: null,
  },
  {
    id: "notepad",
    name: "Notepad",
    description: "Premium spiral notebook with exclusive Ascent cover art.",
    price: 299,
    originalPrice: 349,
    image: "/merch/notebook.jpeg",
    tag: null,
  },
  {
    id: "totebag",
    name: "Tote Bag",
    description: "Canvas tote with the full Escape the Ordinary artwork.",
    price: 449,
    originalPrice: 499,
    image: "/merch/tote2.jpeg",
    tag: null,
  },
  {
    id: "tshirt",
    name: "T-Shirt",
    description: "Oversized premium quality. Clean ASCENT branding, no name.",
    price: 549,
    originalPrice: 599,
    image: "/merch/tshirt2.jpeg",
    tag: null,
  },
  {
    id: "tshirt-name",
    name: "T-Shirt with Name",
    description: "Oversized premium quality. Your name printed on the back.",
    price: 649,
    originalPrice: 699,
    image: "/merch/tshirt2.jpeg",
    tag: "Bestseller",
    tagColor: "var(--violet)",
  },
  {
    id: "mug",
    name: "Mug",
    description: "Ceramic mug with Ascent artwork. Dropping soon.",
    price: null,
    originalPrice: null,
    image: "/merch/mainpic.jpeg",
    tag: "Coming Soon",
    tagColor: "var(--teal)",
    comingSoon: true,
  },
];

function MerchCard({ item, isMobile, onBuy }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 14,
        overflow: "hidden",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? "0 16px 48px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Image */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "100%", // square via padding trick
          overflow: "hidden",
          background: "#0a0a10",
        }}
      >
        <img
          src={item.image}
          alt={item.name}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",
            transition: "transform 0.4s ease",
            transform: hovered ? "scale(1.06)" : "scale(1)",
            filter: item.comingSoon ? "brightness(0.35) grayscale(0.4)" : "none",
          }}
        />
        {item.tag && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: item.tagColor ?? "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              padding: "3px 9px",
              borderRadius: 999,
              textTransform: "uppercase",
              fontFamily: "var(--f-mono)",
            }}
          >
            {item.tag}
          </div>
        )}
        {item.comingSoon && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "var(--teal)",
                textTransform: "uppercase",
                border: "1px solid var(--teal)",
                padding: "6px 16px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.6)",
              }}
            >
              Coming Soon
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          padding: "16px 18px 18px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--f-body)",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {item.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-dim)",
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {item.description}
        </div>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {item.price ? (
            <>
              <span
                style={{
                  fontFamily: "var(--f-mono)",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--ink)",
                }}
              >
                ₹{item.price}
              </span>
              {item.originalPrice && (
                <span
                  style={{
                    fontFamily: "var(--f-mono)",
                    fontSize: 12,
                    color: "var(--ink-dim)",
                    textDecoration: "line-through",
                    opacity: 0.6,
                  }}
                >
                  ₹{item.originalPrice}
                </span>
              )}
              {item.originalPrice && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#4ade80",
                    background: "rgba(74,222,128,0.1)",
                    border: "1px solid rgba(74,222,128,0.2)",
                    padding: "1px 6px",
                    borderRadius: 999,
                    fontFamily: "var(--f-mono)",
                  }}
                >
                  -{Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
                </span>
              )}
            </>
          ) : (
            <span
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: 12,
                color: "var(--teal)",
                letterSpacing: "0.06em",
              }}
            >
              TBA
            </span>
          )}
        </div>

        {/* Buy Now button */}
        {!item.comingSoon && (
          <button
            onClick={() => onBuy(item)}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "9px 0",
              borderRadius: 9,
              background: hovered
                ? "var(--violet)"
                : "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.35)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--f-mono)",
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            BUY NOW
          </button>
        )}
      </div>
    </div>
  );
}

export default function MerchStore() {
  const isMobile = useMobile();
  const { user } = useUserAuth();
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <PageBackground glows={true}>
      {selectedItem && (
        <PaymentModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
      <NavBar variant={user ? "app" : "public"} active="merch" />

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: isMobile ? "28px 16px 80px" : "48px 32px 100px",
        }}
      >
        {/* Hero — split layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: isMobile ? 28 : 48,
            alignItems: "center",
            marginBottom: isMobile ? 40 : 56,
          }}
        >
          {/* Left: text */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              § MERCH STORE · {ITEMS.filter((i) => !i.comingSoon).length} ITEMS
            </div>
            <h1
              className="display"
              style={{
                fontSize: isMobile ? 38 : 60,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                marginBottom: 16,
              }}
            >
              Wear the<br />ascent.
            </h1>
            <p
              style={{
                color: "var(--ink-dim)",
                fontSize: 14,
                lineHeight: 1.65,
                maxWidth: 380,
                marginBottom: 24,
              }}
            >
              Official Ascent × Scaler School of Technology merchandise.
              Limited stock — grab yours before it's gone.
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 999,
                fontSize: 12,
                color: "var(--ink-dim)",
                fontFamily: "var(--f-mono)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4ade80",
                  boxShadow: "0 0 6px #4ade80",
                  flexShrink: 0,
                }}
              />
              Available on-site · Techfest 2026
            </div>
          </div>

          {/* Right: collection image */}
          {!isMobile && (
            <div
              style={{
                borderRadius: 20,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                aspectRatio: "1/1",
                boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              }}
            >
              <img
                src="/merch/mainpic.jpeg"
                alt="Ascent Merch Collection"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  display: "block",
                }}
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.06)",
            marginBottom: isMobile ? 28 : 40,
          }}
        />

        {/* Product grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
            gap: isMobile ? 12 : 20,
          }}
        >
          {ITEMS.map((item) => (
            <MerchCard key={item.id} item={item} isMobile={isMobile} onBuy={setSelectedItem} />
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
