"use client";

import { Suspense, useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Text, OrbitControls, Environment } from "@react-three/drei";
import { useSpring, animated } from "@react-spring/three";
import * as THREE from "three";

const PAGE_W = 2.4;
const PAGE_H = 3.2;
const PAGE_GAP = 0.005;

export default function MemoriesBook({ places }) {
  // pageIndex: -1 = cover showing, 0..N-1 = showing places[pageIndex]
  const [pageIndex, setPageIndex] = useState(-1);

  const total = places.length;
  const canNext = pageIndex < total - 1;
  const canPrev = pageIndex > -1;

  return (
    <div className="book-stage">
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#fde2cf"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 6]} intensity={0.6} />
        <directionalLight position={[-3, -2, 4]} intensity={0.25} />

        <Suspense fallback={null}>
          <Book
            places={places}
            pageIndex={pageIndex}
            onTurnRight={() => canNext && setPageIndex(pageIndex + 1)}
            onTurnLeft={() => canPrev && setPageIndex(pageIndex - 1)}
          />
        </Suspense>

        {/* gentle orbit so you can rotate the book a bit — disabled zoom */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 1.8}
          minPolarAngle={Math.PI / 2.8}
          maxAzimuthAngle={Math.PI / 6}
          minAzimuthAngle={-Math.PI / 6}
        />
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

function Book({ places, pageIndex, onTurnRight, onTurnLeft }) {
  return (
    <group>
      {/* back cover sits permanently at the far left as the "base" */}
      <BackCover />

      {/* cover (flippable like a page) */}
      <FlipPage
        flipped={pageIndex > -1}
        z={(places.length + 1) * PAGE_GAP}
        onClickFront={onTurnRight}
        onClickBack={onTurnLeft}
      >
        <CoverFace />
      </FlipPage>

      {/* each memory is a page */}
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

function BackCover() {
  return (
    <group position={[-PAGE_W / 2, 0, -0.04]}>
      <mesh>
        <boxGeometry args={[PAGE_W, PAGE_H, 0.06]} />
        <meshStandardMaterial color="#5a3a1f" roughness={0.85} />
      </mesh>
    </group>
  );
}

function CoverFace() {
  return (
    <group>
      {/* the kraft / leather cover */}
      <mesh>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshStandardMaterial color="#7a4a25" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* gold border */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[PAGE_W - 0.18, PAGE_H - 0.18]} />
        <meshBasicMaterial color="#5a3a1f" />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[PAGE_W - 0.22, PAGE_H - 0.22]} />
        <meshStandardMaterial color="#7a4a25" roughness={0.9} />
      </mesh>

      {/* "Yours Truly" gold lettering */}
      <Text
        position={[0, 0.4, 0.01]}
        fontSize={0.32}
        color="#d4af37"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004La2Cf5b6jlg.woff"
        outlineWidth={0.008}
        outlineColor="#3a2a17"
      >
        Yours
      </Text>
      <Text
        position={[0, 0.0, 0.01]}
        fontSize={0.32}
        color="#d4af37"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004La2Cf5b6jlg.woff"
        outlineWidth={0.008}
        outlineColor="#3a2a17"
      >
        Truly
      </Text>
      <Text
        position={[0, -0.5, 0.01]}
        fontSize={0.09}
        color="#d4af37"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.3}
      >
        — a scrapbook of places —
      </Text>
      {/* small heart sticker */}
      <Text
        position={[0, -1.0, 0.01]}
        fontSize={0.22}
        color="#d4af37"
        anchorX="center"
        anchorY="middle"
      >
        ♡
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

  return (
    <group>
      {/* the paper page */}
      <mesh>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshStandardMaterial color="#fffdf7" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* peach paper wash */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshBasicMaterial color="#fde2cf" transparent opacity={0.35} />
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
      {place.photo_url ? (
        <PhotoMesh url={place.photo_url} />
      ) : (
        <mesh position={[0, 0.7, 0.01]}>
          <planeGeometry args={[PAGE_W * 0.78, PAGE_H * 0.4]} />
          <meshBasicMaterial color="#f7c8a9" />
        </mesh>
      )}

      {/* name */}
      <Text
        position={[0, -0.25, 0.012]}
        fontSize={0.18}
        color="#2a2a2a"
        anchorX="center"
        anchorY="middle"
        maxWidth={PAGE_W * 0.85}
        textAlign="center"
        font="https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004La2Cf5b6jlg.woff"
      >
        {place.name}
      </Text>

      {/* location */}
      {place.location && (
        <Text
          position={[0, -0.5, 0.012]}
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
          position={[0, -0.7, 0.012]}
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
          position={[0, -1.05, 0.012]}
          fontSize={0.082}
          color="#3a2a17"
          anchorX="center"
          anchorY="top"
          maxWidth={PAGE_W * 0.82}
          lineHeight={1.4}
          textAlign="center"
          font="https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjcB9eg.woff"
        >
          {`"${reviewLines}"`}
        </Text>
      )}
    </group>
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
