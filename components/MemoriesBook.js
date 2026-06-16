"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useSpring, animated } from "@react-spring/three";
import * as THREE from "three";

// Convert 2D-stored decorations to 3D world coords on a page
function decorationToWorld(dec) {
  return {
    x: (dec.x / 100 - 0.5) * PAGE_W,
    y: -(dec.y / 100 - 0.5) * PAGE_H,
    size: dec.size / 200, // px → world units (calibrated so 120px ≈ 0.6 world)
    rotation: -((dec.rotation || 0) * Math.PI) / 180, // CSS clockwise → Three CCW
  };
}

const PAGE_W = 3.6;
const PAGE_H = 4.8;
const PAGE_GAP = 0.03; // separation between pages — must be > any internal z offset

// Singleton notebook-paper texture: light blue with horizontal rules + red margin
let _notebookTexture = null;
function getNotebookTexture() {
  if (typeof document === "undefined") return null;
  if (_notebookTexture) return _notebookTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  // soft blue paper
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#eef4fa");
  grad.addColorStop(1, "#dde9f3");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // horizontal rule lines
  ctx.strokeStyle = "#a8c5e0";
  ctx.lineWidth = 1.6;
  const lineCount = 22;
  const topPad = 80;
  const bottomPad = 60;
  const usable = canvas.height - topPad - bottomPad;
  const spacing = usable / lineCount;
  for (let i = 0; i <= lineCount; i++) {
    const y = topPad + i * spacing;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // red margin line down the left
  ctx.strokeStyle = "#e07856";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(80, 0);
  ctx.lineTo(80, canvas.height);
  ctx.stroke();

  // three subtle hole-punches on the left edge
  ctx.fillStyle = "#fde2cf";
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  for (let h = 0; h < 3; h++) {
    const cy = canvas.height * (0.18 + h * 0.32);
    ctx.beginPath();
    ctx.arc(28, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  _notebookTexture = tex;
  return tex;
}

export default function MemoriesBook({ places }) {
  // pageIndex: -1 = cover showing, 0..N-1 = showing places[pageIndex]
  const [pageIndex, setPageIndex] = useState(-1);

  const total = places.length;
  const canNext = pageIndex < total - 1;
  const canPrev = pageIndex > -1;

  return (
    <div className="book-stage">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 42 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
        dpr={[1, 2]}
        flat
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 4, 6]} intensity={0.5} />
        <directionalLight position={[-3, -2, 4]} intensity={0.2} />

        <Suspense fallback={<DebugCube />}>
          {/* offset so the closed book is centered horizontally in the canvas */}
          <group scale={1.15} position={[-PAGE_W / 2, 0, 0]}>
            <Book
              places={places}
              pageIndex={pageIndex}
              onTurnRight={() => canNext && setPageIndex(pageIndex + 1)}
              onTurnLeft={() => canPrev && setPageIndex(pageIndex - 1)}
            />
          </group>
        </Suspense>
      </Canvas>

      {/* UI overlay */}
      <div className="book-controls">
        <button onClick={() => canPrev && setPageIndex(pageIndex - 1)} disabled={!canPrev}>
          ← prev
        </button>
        <span className="book-counter">
          {pageIndex === -1 ? "cover" : `memory ${pageIndex + 1} / ${total}`}
        </span>
        <button onClick={() => canNext && setPageIndex(pageIndex + 1)} disabled={!canNext}>
          next →
        </button>
      </div>
    </div>
  );
}

function DebugCube() {
  // shown while Suspense waits — if you see a coral cube, three.js works
  // but something in the Book subtree is still loading.
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#e07856" />
    </mesh>
  );
}

function Book({ places, pageIndex, onTurnRight, onTurnLeft }) {
  return (
    <group>
      {/* cover (flippable like a page) — sits on top of the stack */}
      <FlipPage
        flipped={pageIndex > -1}
        z={(places.length + 1) * PAGE_GAP}
        onClickFront={onTurnRight}
        onClickBack={onTurnLeft}
      >
        <CoverFace />
      </FlipPage>

      {/* each memory is a page, stacked behind the cover */}
      {places.map((place, i) => (
        <FlipPage
          key={place.id}
          flipped={i < pageIndex}
          z={(places.length - i) * PAGE_GAP}
          onClickFront={onTurnRight}
          onClickBack={onTurnLeft}
        >
          <MemoryFace place={place} index={i} />
        </FlipPage>
      ))}
    </group>
  );
}

function FlipPage({ flipped, z, children, onClickFront, onClickBack }) {
  const { rotation } = useSpring({
    rotation: flipped ? -Math.PI : 0,
    config: { mass: 1.4, tension: 65, friction: 22 },
  });
  return (
    <animated.group rotation-y={rotation} position={[0, 0, z]}>
      {/* offset content to the right so left edge of the page is the spine */}
      <group position={[PAGE_W / 2, 0, 0]}>
        {children}
        {/* invisible click hitboxes — front and back of the page */}
        <mesh position={[0, 0, 0.001]} onClick={(e) => { e.stopPropagation(); onClickFront(); }}>
          <planeGeometry args={[PAGE_W, PAGE_H]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        <mesh position={[0, 0, -0.001]} rotation={[0, Math.PI, 0]} onClick={(e) => { e.stopPropagation(); onClickBack(); }}>
          <planeGeometry args={[PAGE_W, PAGE_H]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
    </animated.group>
  );
}

function CoverFace() {
  const GOLD = "#e6c358";
  const GOLD_DEEP = "#b8961f";
  const LEATHER = "#3a2010";
  const LEATHER_LIGHT = "#5a3018";

  return (
    <group>
      {/* base leather — deep rich brown */}
      <mesh>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshBasicMaterial color={LEATHER} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {/* outer gold band */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[PAGE_W - 0.12, PAGE_H - 0.12]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>

      {/* leather inset between two gold lines */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[PAGE_W - 0.16, PAGE_H - 0.16]} />
        <meshBasicMaterial color={LEATHER_LIGHT} toneMapped={false} />
      </mesh>

      {/* inner gold thin line */}
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={[PAGE_W - 0.26, PAGE_H - 0.26]} />
        <meshBasicMaterial color={GOLD} toneMapped={false} />
      </mesh>

      {/* main inner panel where the title sits */}
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[PAGE_W - 0.30, PAGE_H - 0.30]} />
        <meshBasicMaterial color={LEATHER_LIGHT} toneMapped={false} />
      </mesh>

      {/* corner gold diamonds */}
      {[
        [-(PAGE_W / 2) + 0.32, (PAGE_H / 2) - 0.32],
        [ (PAGE_W / 2) - 0.32, (PAGE_H / 2) - 0.32],
        [-(PAGE_W / 2) + 0.32, -(PAGE_H / 2) + 0.32],
        [ (PAGE_W / 2) - 0.32, -(PAGE_H / 2) + 0.32],
      ].map(([x, y], i) => (
        <Text
          key={`corner-${i}`}
          position={[x, y, 0.005]}
          fontSize={0.16}
          color={GOLD}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor={LEATHER}
        >
          ✦
        </Text>
      ))}

      {/* "Yours" — big embossed gold */}
      <Text
        position={[0, 0.7, 0.008]}
        fontSize={0.46}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor={LEATHER}
        letterSpacing={0.04}
      >
        Yours
      </Text>

      {/* "Truly" */}
      <Text
        position={[0, 0.15, 0.008]}
        fontSize={0.46}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor={LEATHER}
        letterSpacing={0.04}
      >
        Truly
      </Text>

      {/* gold flourish divider */}
      <Text
        position={[0, -0.32, 0.008]}
        fontSize={0.18}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.3}
      >
        ✦ · ♡ · ✦
      </Text>

      {/* subtitle */}
      <Text
        position={[0, -0.62, 0.008]}
        fontSize={0.075}
        color={GOLD_DEEP}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.35}
        outlineWidth={0.001}
        outlineColor={LEATHER}
      >
        A SCRAPBOOK OF PLACES
      </Text>

      {/* bottom imprint stamp */}
      <Text
        position={[0, -1.18, 0.008]}
        fontSize={0.065}
        color={GOLD}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.5}
      >
        — VOL. I · MMXXVI —
      </Text>
    </group>
  );
}

function MemoryFace({ place, index }) {
  const stars = place.rating > 0 ? "★".repeat(place.rating) + "☆".repeat(5 - place.rating) : "";
  const reviewLines = useMemo(() => {
    const r = (place.review || "").trim();
    return r;
  }, [place.review]);

  // prefer the first original photo (clean) over the collage which has text baked in
  const pageImageUrl = useMemo(() => {
    if (Array.isArray(place.photos) && place.photos.length > 0) return place.photos[0];
    return place.photo_url || null;
  }, [place.photos, place.photo_url]);

  const notebookTexture = getNotebookTexture();

  return (
    <group>
      {/* lined notebook paper — light blue with horizontal rules + red margin */}
      <mesh>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshBasicMaterial
          map={notebookTexture}
          color={notebookTexture ? "#ffffff" : "#dde9f3"}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* page number top-right */}
      <Text
        position={[PAGE_W / 2 - 0.15, PAGE_H / 2 - 0.15, 0.01]}
        fontSize={0.08}
        color="#8a7259"
        anchorX="right"
        anchorY="top"
      >
        — {index + 1} —
      </Text>

      {/* the photo area */}
      {pageImageUrl ? (
        <PhotoMesh url={pageImageUrl} />
      ) : (
        <mesh position={[0, 0.7, 0.01]}>
          <planeGeometry args={[PAGE_W * 0.78, PAGE_H * 0.4]} />
          <meshBasicMaterial color="#f7c8a9" />
        </mesh>
      )}

      {/* name */}
      <Text
        position={[0, -0.25, 0.008]}
        fontSize={0.18}
        color="#2a2a2a"
        anchorX="center"
        anchorY="middle"
        maxWidth={PAGE_W * 0.85}
        textAlign="center"
      >
        {place.name}
      </Text>

      {/* location */}
      {place.location && (
        <Text
          position={[0, -0.5, 0.008]}
          fontSize={0.08}
          color="#6a4f3e"
          anchorX="center"
          anchorY="middle"
          maxWidth={PAGE_W * 0.85}
          textAlign="center"
        >
          {`📍 ${place.location}`}
        </Text>
      )}

      {/* stars */}
      {stars && (
        <Text
          position={[0, -0.7, 0.008]}
          fontSize={0.13}
          color="#f4b400"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.1}
        >
          {stars}
        </Text>
      )}

      {/* review */}
      {reviewLines && (
        <Text
          position={[0, -1.05, 0.008]}
          fontSize={0.082}
          color="#3a2a17"
          anchorX="center"
          anchorY="top"
          maxWidth={PAGE_W * 0.82}
          lineHeight={1.4}
          textAlign="center"
        >
          {`"${reviewLines}"`}
        </Text>
      )}

      {/* user-added decorations: stickers + text overlays */}
      {Array.isArray(place.decorations) && place.decorations.map((dec) => (
        <DecorationOnPage key={dec.id} decoration={dec} />
      ))}
    </group>
  );
}

function DecorationOnPage({ decoration }) {
  const { x, y, size, rotation } = decorationToWorld(decoration);
  const Z = 0.02; // above all page content

  // text or emoji sticker → drei <Text>
  if (decoration.type === "text" || (decoration.type === "sticker" && !decoration.imageUrl)) {
    const isText = decoration.type === "text";
    return (
      <Text
        position={[x, y, Z]}
        rotation={[0, 0, rotation]}
        fontSize={size}
        color={isText ? (decoration.color || "#e07856") : "#000000"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={isText ? size * 0.02 : 0}
        outlineColor="#fffdf7"
        outlineBlur={isText ? size * 0.04 : 0}
      >
        {isText ? decoration.content : decoration.emoji}
      </Text>
    );
  }

  // image sticker (cropped dataURL / image URL)
  if (decoration.type === "sticker" && decoration.imageUrl) {
    return <ImageStickerOnPage url={decoration.imageUrl} x={x} y={y} size={size} rotation={rotation} z={Z} />;
  }

  return null;
}

function ImageStickerOnPage({ url, x, y, size, rotation, z }) {
  const [texture, setTexture] = useState(null);
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
      setAspect(img.width / Math.max(1, img.height));
    };
    img.onerror = () => { if (!cancelled) setTexture(null); };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);

  if (!texture) return null;

  const width = size;
  const height = size / aspect;

  return (
    <mesh position={[x, y, z]} rotation={[0, 0, rotation]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function PhotoMesh({ url }) {
  // Load texture client-side, gracefully fail if blocked by CORS
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    return loader.load(url);
  }, [url]);

  return (
    <mesh position={[0, 0.7, 0.01]}>
      <planeGeometry args={[PAGE_W * 0.78, PAGE_H * 0.4]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
