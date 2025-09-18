export type TouchEventCallback = (touches: ArrayLike<Touch>, noSend?: boolean) => void;
export class TouchManager {
  onTouchEnd: TouchEventCallback | undefined = undefined;
  onTouchChange: TouchEventCallback | undefined = undefined;
  onTouchStart: TouchEventCallback | undefined = undefined;

  touchStartTimes: Map<number | string, number> = new Map();

  constructor() {
    document.addEventListener("touchmove", (e) => {
      if (this.onTouchChange) {
        this.onTouchChange(e.changedTouches);
      }
      e.preventDefault();
    });

    document.addEventListener("touchstart", (e) => {
      for (const touch of e.changedTouches) {
        this.touchStartTimes.set(touch.identifier, Date.now());
      }

      if (this.onTouchStart) {
        this.onTouchStart(e.changedTouches);
      }

      if (this.onTouchChange) {
        this.onTouchChange(e.changedTouches);
      }
      e.preventDefault();
    });

    document.addEventListener("touchend", (e) => {
      this.touchEnd(e.changedTouches);
      e.preventDefault();
    });

    document.addEventListener("touchcancel", (e) => {
      this.touchEnd(e.changedTouches);
      e.preventDefault();
    });

    document.addEventListener("mousedown", (e) => {
      const fakeTouch = {
        clientX: e.clientX,
        clientY: e.clientY,
        identifier: 'MOUSE' as any,
      } as Touch;

      this.touchStartTimes.set(fakeTouch.identifier, Date.now());
      if (this.onTouchStart) {
        this.onTouchStart([fakeTouch]);
      }

      if (this.onTouchChange) {
        this.onTouchChange([fakeTouch]);
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.touchStartTimes.has('MOUSE')) {
        return;
      }

      const fakeTouch = {
        clientX: e.clientX,
        clientY: e.clientY,
        identifier: 'MOUSE' as any,
      } as Touch;

      if (this.onTouchChange) {
        this.onTouchChange([fakeTouch]);
      }
    });

    document.addEventListener("mouseup", (e) => {
      const fakeTouch = {
        clientX: e.clientX,
        clientY: e.clientY,
        identifier: 'MOUSE' as any,
      } as Touch;

      this.touchEnd([fakeTouch]);
    });
  }

  touchEnd(changedTouches: TouchList | Touch[]) {
    if (this.onTouchChange) {
      this.onTouchChange(changedTouches, true);
    }

    const instaRelease = [];

    for (const touch of changedTouches) {
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

    if (this.onTouchEnd && instaRelease.length) {
      this.onTouchEnd(instaRelease);
    }
  }
}
