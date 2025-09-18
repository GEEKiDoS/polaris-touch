export function listenHold(element: HTMLElement, callback: () => void, duration: number = 2000) {
    let down = false;
    element.addEventListener("touchstart", () => {
        if (down) {
            return;
        }

        down = true;
        const timer = setTimeout(() => {
            callback();
        }, duration);

        element.addEventListener("touchend", () => {
            down = false;
            clearTimeout(timer);
        });

        element.addEventListener("touchcancel", () => {
            down = false;
            clearTimeout(timer);
        });
    });

    element.addEventListener("mousedown", () => {
        if (down) {
            return;
        }
        
        down = true;
        const timer = setTimeout(() => {
            callback();
        }, duration);

        element.addEventListener("mouseup", () => {
            down = false;
            clearTimeout(timer);
        });
    });
}
