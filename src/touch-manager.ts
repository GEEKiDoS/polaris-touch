export interface Finger {
  id: number | string;
  x: number;
  y: number;
}

export class TouchManager {
  onTouchStart: ((touch: Finger) => void) | undefined = undefined;
  onTouchChange: ((touches: Finger[]) => void) | undefined = undefined;
  onTouchEnd: ((touches: Finger) => void) | undefined = undefined;

  touches: Map<number | string, Finger> = new Map();

  constructor() {
    document.addEventListener("pointerdown", (e) => {
      const finger = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      };

      if (this.onTouchStart) {
        this.onTouchStart(finger);
      }

      this.touches.set(e.pointerId, finger);
      const touches = Array.from(this.touches.values());

      if (this.onTouchChange) {
        this.onTouchChange(touches);
      }

      e.preventDefault();
    });

    document.addEventListener("pointermove", (e) => {
      if (!this.touches.has(e.pointerId)) {
        return;
      }

      this.touches.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      });

      const touches = Array.from(this.touches.values());

      if (this.onTouchChange) {
        this.onTouchChange(touches);
      }

      e.preventDefault();
    });

    document.addEventListener("pointerup", (e) => {
      this.touchEnd({
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      });
    });
  }

  touchEnd(finger: Finger) {
    this.touches.delete(finger.id);

    const touches = Array.from(this.touches.values());

    if (this.onTouchChange) {
      this.onTouchChange(touches);
    }

    if (this.onTouchEnd) {
      this.onTouchEnd(finger);
    }
  }
}
