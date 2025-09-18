/// <reference types="vite/client" />

import type { SpiceConnection } from "./spice-connection";
import type { TouchManager } from "./touch-manager";

declare global {
    interface Window {
        ctx: SpiceConnection | undefined;
        touchMgr: TouchManager | undefined;
    }
}
