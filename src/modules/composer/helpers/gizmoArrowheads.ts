import * as THREE from "three";

/**
 * Two cone arrowheads on each rotation ring, showing which way a drag turns the
 * joint. The rings are bare thin half-circles, so nothing on screen otherwise
 * says which direction is positive.
 *
 * Each tip is a child of its ring mesh, which is why nothing here runs per
 * frame: TransformControls already gives every ring its camera alignment, gizmo
 * scale, axis-highlight material and show/hide, and children inherit all of it.
 * Sharing the ring's material is what makes a tip turn yellow with its ring.
 *
 * Placement is the fiddly part, and both obvious spots are wrong. That alignment
 * swings each arc so its middle faces the camera, so on an arc seen edge-on the
 * middle projects onto the hub and the two ends sit on the silhouette with their
 * tangents down the view axis — an arrowhead there is end-on and collapses to a
 * dot. A quarter turn either side of the middle is clear of both.
 *
 * ponytail: reads the private `_gizmo` — three exposes no accessor for the
 * handles. Verified against three 0.185.1, which package.json pins exactly. If a
 * version bump renames it the loop finds no rings and the gizmo renders stock.
 */

/**
 * bake: the rotation setupGizmo() folded into that ring's geometry, which the
 *   holder has to repeat because the tips are positioned in the pre-bake frame.
 * spin: +1 where that bake leaves the arc sweeping the right-handed way round
 *   its own axis, -1 where it reverses it. Y and Z come out reversed, and an
 *   arrow advertising the opposite of what the drag does is worse than no arrow.
 */
const RINGS: Record<string, { bake: [number, number, number]; spin: number }> = {
  X: { bake: [0, 0, 0], spin: 1 },
  Y: { bake: [0, 0, -Math.PI / 2], spin: -1 },
  Z: { bake: [0, Math.PI / 2, 0], spin: -1 },
};

const RING_RADIUS = 0.5; // matches CircleGeometry(0.5, 0.5) in TransformControls
const ARC_MIDDLE = Math.PI / 2;
const arrowGeometry = new THREE.ConeGeometry(0.038, 0.11, 12);

export function addRingArrowheads(controls: any): void {
  for (const ring of controls._gizmo?.gizmo?.rotate?.children ?? []) {
    const spec = RINGS[ring.name];
    if (!spec) continue; // skips E and XYZE: no one axis to point along
    const holder = new THREE.Object3D();
    holder.rotation.set(...spec.bake);
    for (const theta of [ARC_MIDDLE - Math.PI / 4, ARC_MIDDLE + Math.PI / 4]) {
      const tip = new THREE.Mesh(arrowGeometry, ring.material);
      tip.position.set(0, RING_RADIUS * Math.cos(theta), RING_RADIUS * Math.sin(theta));
      tip.rotation.x = theta + (spec.spin * Math.PI) / 2; // cone's +Y onto the arc tangent
      tip.renderOrder = Infinity;
      holder.add(tip);
    }
    ring.add(holder);
  }
}
