export type TouchEventCallback = (touches: ArrayLike<Touch>) => void;
export class TouchManager {
  onTouchEnd: TouchEventCallback | undefined = undefined;
  onTouchChange: TouchEventCallback | undefined = undefined;

  touchStartTimes: Map<number, number> = new Map();

  constructor() {
    document.body.addEventListener("touchmove", (e) => {
      if (this.onTouchChange) {
        this.onTouchChange(e.changedTouches);
      }
      e.preventDefault();
    });

    document.body.addEventListener("touchstart", (e) => {
      for (const touch of e.changedTouches) {
        this.touchStartTimes.set(touch.identifier, Date.now());
      }

      if (this.onTouchChange) {
        this.onTouchChange(e.changedTouches);
      }
      e.preventDefault();
    });

    document.body.addEventListener("touchend", (e) => {
      this.touchEnd(e);
      e.preventDefault();
    });

    document.body.addEventListener("touchcancel", (e) => {
      this.touchEnd(e);
      e.preventDefault();
    });
  }

  touchEnd(e: TouchEvent) {
    if (this.onTouchChange) {
      this.onTouchChange(e.touches);
    }

    const instaRelease = [];

    for (const touch of e.changedTouches) {
      const startTime = this.touchStartTimes.get(touch.identifier);
      if (startTime == undefined) {
        throw new Error("?");
      }

      const duration = Date.now() - startTime;
      this.touchStartTimes.delete(touch.identifier);

      // delay touch end event if it releases too fast
      if (duration > 16) {
        instaRelease.push(touch);
        continue;
      }

      setTimeout(() => {
        if (this.onTouchEnd) {
          this.onTouchEnd([touch]);
        }
      }, 16 - duration);
    }

    if (this.onTouchEnd) {
      this.onTouchEnd(instaRelease);
    }
  }
}
