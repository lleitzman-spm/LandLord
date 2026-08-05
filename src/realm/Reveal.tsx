/**
 * The fog of war — a foglike darkness that thins over a few heartbeats as
 * the ink takes (the writ's image), then an ink-soft edge that closes over
 * the still-unrevealed sea, as if the ink were still wet at the map's rim.
 *
 * `RevealGroup` wraps everything the reveal paints in. While unrevealed it
 * renders nothing; on `revealed` flipping true it runs the thin-in and then
 * hands the children to the light. Everything the realm stands on that is
 * NOT drawn (the blank continent, the sea, the rose, the lettering) lives
 * OUTSIDE this group, so the fog has somewhere to sit.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';


/** Seconds the ink takes to run. */
const THIN_SECONDS = 2.2;

/**
 * Owns the scene fog. `amount` runs 1 (full fog) → 0 (clear). Sets
 * scene.fog to a dense, close fog while the ink is out and relaxes it as the
 * ink thins; at 0 the fog lifts entirely (the golden hour needs a clear sky).
 */
/** The ink-in. Edwin retired the fog of war (2026-07-27): "I'd rather dispense
 *  with the fog of war idea, and just allow the surrounding to flow more
 *  naturally out." So nothing is hidden behind haze and nothing dissolves at
 *  the frame's edge — the water simply runs on to the horizon.
 *
 *  What the reveal keeps is the MOMENT: when the horn sounds the realm settles
 *  in rather than snapping on. This lifts the whole drawn world the last of the
 *  way up as the ink dries, which reads as the map being drawn, not as a video
 *  fading in. It owns no fog at all.
 */
export function RisingLand({
  amount,
  children,
}: {
  amount: React.MutableRefObject<number>;
  children?: React.ReactNode;
}) {
  const group = useRef<THREE.Group | null>(null);
  const { scene } = useThree();

  useEffect(() => {
    // Any fog a previous build left on the scene is cleared for good.
    scene.fog = null;
  }, [scene]);

  useFrame(() => {
    if (!group.current) return;
    const ease = 1 - amount.current * amount.current;
    group.current.position.y = (ease - 1) * 1.6;
  });

  // The children ride the group that MOVES. They used to be mounted in a
  // sibling group, so the rise was computed every frame on an empty node and
  // the realm snapped on instead of settling in — the animation ran perfectly
  // and was invisible. (Audit, 2026-07-27.)
  return <group ref={group}>{children}</group>;
}

/**
 * Runs the reveal. Children are mounted only when revealed (the realm simply
 * is not there before the muster), and while the ink thins the group sits
 * under the fog; the fog itself is owned by FogOfWar above.
 */
export function RevealGroup({
  revealed,
  children,
}: {
  revealed: boolean;
  children: ReactNode;
}) {
  const amount = useRef(revealed ? 1 : 0);
  const started = useRef(revealed);

  useEffect(() => {
    if (revealed && !started.current) {
      // The rising edge — the horn has sounded. The ink goes out thick and
      // thins over the next heartbeats; without this reset the reveal would
      // pop in with no transition at all.
      amount.current = 1;
      started.current = true;
    }
  }, [revealed]);

  useFrame((_, dt) => {
    if (started.current && amount.current > 0) {
      amount.current = Math.max(0, amount.current - dt / THIN_SECONDS);
    }
  });

  return (
    <>
      <RisingLand amount={amount}>{revealed && <group>{children}</group>}</RisingLand>
    </>
  );
}

