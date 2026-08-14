import * as THREE from "three";

export type CharacterType = "male" | "female" | "child";

/** Reused so grounding, which runs per animation frame during a motion, allocates nothing. */
const groundBox = new THREE.Box3();
const groundScale = new THREE.Vector3();

/**
 * Plants the figure's lowest point on y = 0. The one grounding routine — nothing
 * in this app may call mannequin-js's own `stepOnGround()`.
 *
 * `stepOnGround()` is wrong here twice over. It lands the feet on
 * `GROUND_LEVEL = -0.7`, the height of the ground disc in mannequin-js's
 * built-in Stage, which this app does not use — its grid is at y = 0, so every
 * call sank the figure 0.7, about 40% of a 1.8-unit body, taking it under the
 * grid and under the invisible deselect plane. And it writes a *world*-space
 * measurement straight into a *local* `position.y`, which is only the same thing
 * when the figure is a direct child of the scene, as it is in the prototype.
 * Here every figure hangs off a wrapper Group carrying the object transform, so
 * the wrapper's own Y was silently cancelled out.
 *
 * Same three steps as the original — clear the offset, measure, re-offset — with
 * the measurement converted back through the parent's world Y scale. The 0.01
 * sink is mannequin-js's own, and keeps the soles out of the grid plane.
 */
export function groundFigure(figure: THREE.Object3D): void {
  figure.position.y = 0;
  figure.updateWorldMatrix(true, true);

  groundBox.setFromObject(figure);
  if (groundBox.isEmpty()) return;

  const scaleY = figure.parent?.getWorldScale(groundScale).y || 1;
  figure.position.y = (-0.01 - groundBox.min.y) / scaleY;
  figure.updateWorldMatrix(true, true);
}

export interface CharacterOptions {
  type?: CharacterType;
}

async function loadMannequin(type: CharacterType): Promise<THREE.Object3D> {
  let mannequin: THREE.Object3D;
  switch (type) {
    case "male": {
      const { Male } = await import("mannequin-js/src/bodies/Male.js");
      mannequin = new Male() as unknown as THREE.Object3D;
      break;
    }
    case "female": {
      const { Female } = await import("mannequin-js/src/bodies/Female.js");
      mannequin = new Female() as unknown as THREE.Object3D;
      break;
    }
    case "child": {
      const { Child } = await import("mannequin-js/src/bodies/Child.js");
      mannequin = new Child() as unknown as THREE.Object3D;
      break;
    }
    default: {
      const { Male } = await import("mannequin-js/src/bodies/Male.js");
      mannequin = new Male() as unknown as THREE.Object3D;
      break;
    }
  }
  return mannequin;
}

export function createMannequin(
  options: CharacterOptions = {}
): Promise<THREE.Object3D> {
  return (async () => {
    const { type = "male" } = options;

    let mannequin = await loadMannequin(type);

    // Remove the mannequin from any parent created internally.
    mannequin.parent?.remove(mannequin);

    // mannequin-js creates a fixed-position canvas in document.body on construction.
    // Remove any such stray canvases so they don't intercept pointer events.
    removeMannequinCanvases();

    // The constructor ends on stepOnGround(), which left the figure at -0.71.
    groundFigure(mannequin);

    return mannequin;
  })();
}

/** Removes all <canvas> elements directly under document.body that were injected by mannequin-js. */
export function removeMannequinCanvases(): void {
  if (typeof document !== "undefined") {
    document
      .querySelectorAll("body > canvas")
      .forEach((c) => c.remove());
  }
}