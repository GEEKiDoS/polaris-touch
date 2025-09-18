import "./style.css"

import { TouchManager } from "./touch-manager";
import { SpiceConnection } from "./spice-connection";
import { listenHold } from "./listen-hold";

const FADER_DEAD_ZONE = 10;

function getSpiceHost(reset = false) {
  let spiceHost = reset ? null : window.localStorage.getItem("api_backend");
  if (spiceHost) {
    return spiceHost;
  }

  const ipPort = prompt("Enter SpiceAPI Endpoint (IP:PORT)\n\nREAD THIS:\nPlease disable password as I don't want to write the RC4 code.\n\nTouch the \"ws://.....\" on status bar for more than 2s then release for re-set SpiceAPI endpoint.\n\nThanks for your using, by GEEKi", "127.0.0.1:1337");
  if (!ipPort) {
    return getSpiceHost(true);
  }

  const [ip, port] = ipPort.split(':');
  spiceHost = `ws://${ip}:${parseInt(port) + 1}/`;
  window.localStorage.setItem("api_backend", spiceHost);

  return spiceHost;
}

if (window.location.protocol.toLowerCase() == "https:") {
  alert("Please use HTTP instead, You can't connect to insecure websocket in https environment.");
  throw new Error("NO_HTTPS");
}

let lastLaneState = new Array(12).fill(false);
function sendButtonState(laneState: boolean[]) {
  if (!window.ctx?.valid || !window.ctx.connected) {
    return;
  }

  const buttonDelta = [];
  for (let i = 0; i < laneState.length; i++) {
    const cur = laneState[i];
    const last = lastLaneState[i];
    if (cur != last) {
      buttonDelta.push([`Button ${i + 1}`, cur ? 1 : 0]);
    }
  }

  if (buttonDelta.length) {
    window.ctx.send({
      id: window.ctx.id,
      module: "buttons",
      function: "write",
      params: buttonDelta,
    });

    lastLaneState = laneState.slice();
  }
}

let lastFaderAnalog = [0, 0];
function sendAnalogState(faderAnalog: number[]) {
  if (!window.ctx?.valid || !window.ctx.connected) {
    return;
  }

  const analogDelta = [];
  for (let i = 0; i < faderAnalog.length; i++) {
    const cur = faderAnalog[i];
    const last = lastFaderAnalog[i];
    if (cur != last) {
      analogDelta.push([`Fader-${['L', 'R'][i]}`, cur]);
    }
  }

  if (analogDelta.length) {
    window.ctx.send({
      id: window.ctx.id,
      module: "analogs",
      function: "write",
      params: analogDelta,
    });

    lastFaderAnalog = faderAnalog.slice();
  }
}

window.touchMgr = new TouchManager();
window.ctx = new SpiceConnection(getSpiceHost());

setInterval(() => {
  if (!window.ctx || !window.ctx.valid) {
    window.ctx = new SpiceConnection(getSpiceHost());
  }
}, 1000);

const statusServer = document.querySelector<HTMLDivElement>("#server");
if (statusServer) {
  listenHold(statusServer, () => {
    window.ctx?.disconnect();
    window.ctx = new SpiceConnection(getSpiceHost(true));
  });
}

const lanes = Array.from(document.querySelectorAll<HTMLDivElement>(".lane>div"));
const faderPositions = Array.from(document.querySelectorAll<HTMLDivElement>(".fader .position"));

const laneState = new Array(12).fill(false);
const faderTouches: Array<Touch | null> = [null, null];
const lastFaderPositions: Array<number | null> = [null, null];
const faderDirs = [0, 0];
const faderAnalogs = [0.51, 0.51];

let frames = 0;
let lastUpdate = Date.now();
const statusFps = document.querySelector<HTMLDivElement>("#fps");
const statusFader = document.querySelector<HTMLDivElement>("#fader");

function updateFaderAnalog() {
  let updated = false;
  for (let i = 0; i < 2; i++) {
    let analog = faderAnalogs[i];
    const dir = faderDirs[i];

    if (dir == 0) {
      if (analog == 0.5) {
        continue;
      }

      analog += (0.5 - analog) * 1.7999;//(0.2 + p * 1.7999);

      if (Math.abs(0.5 - analog) < 0.01) {
        analog = 0.5;
      }
    } else {
      const dest = dir > 0 ? 1 : 0;
      if (analog == dest) {
        continue;
      }

      analog += (dest - analog) / 4;

      if (Math.abs(dest - analog) < 0.01) {
        analog = dest;
      }
    }

    // clamp to [0, 1]
    faderAnalogs[i] = Math.min(1, Math.max(0, analog));
    updated = true;
  }

  if (updated) {
    sendAnalogState(faderAnalogs);

    const areaWidth = document.body.clientWidth / 2;
    for (let i = 0; i < 2; i++) {
      const faderPosition = faderPositions[i];
      const x = faderAnalogs[i] * areaWidth;

      faderPosition.style = `left: ${x}px`;
    }
  }
}

let laneTouches: number[][] = new Array(12).fill([]);
function updateLaneState() {
  for (let i = 0; i < 12; i++) {
    laneState[i] = !!laneTouches[i].length;
  }
}

function removeTouches(touches: Touch[]): boolean {
  // remove ended touches
  let changed = false;

  // remove changed touches
  for (let i = 0; i < 12; i++) {
    const oldLen = laneTouches[i].length;
    laneTouches[i] =
      laneTouches[i].filter(v => touches.findIndex(t => t.identifier == v) == -1);

    if (oldLen != laneTouches[i].length) {
      changed = true;
    }
  }

  return changed
}

window.touchMgr.onTouchChange = (touches) => {
  const touchArr = Array.from(touches);
  const changed = removeTouches(touchArr);
  updateLaneState();

  for (const touch of touchArr) {
    const x = touch.clientX / document.body.clientWidth;
    const y = touch.clientY / document.body.clientHeight;

    // update touch bounded to fader
    if (touch.identifier == faderTouches[0]?.identifier) {
      faderTouches[0] = touch;
      continue;
    }

    if (touch.identifier == faderTouches[1]?.identifier) {
      faderTouches[1] = touch;
      continue;
    }

    // lane area touches
    if (y > 0.5) {
      const column = Math.floor(x * 12);
      laneTouches[column].push(touch.identifier);
      continue;
    }

    // find new touch for binding to fader
    if (faderTouches[1] && touch.clientX < faderTouches[1].clientX) {
      faderTouches[0] = touch;
    } else if (x < 0.5 && !faderTouches[0]) {
      faderTouches[0] = touch;
    }

    if (faderTouches[0] && touch.clientX > faderTouches[0].clientX) {
      faderTouches[1] = touch;
    } else if (x > 0.5 && !faderTouches[1]) {
      faderTouches[1] = touch;
    }
  }

  if (changed) {
    sendButtonState(laneState);
  }

  frames++;
};

window.touchMgr.onTouchEnd = (touches) => {
  const touchArr = Array.from(touches);
  const changed = removeTouches(touchArr);
  if (changed) {
    updateLaneState();
    sendButtonState(laneState);
  }

  // remove fader touches
  for (let i = 0; i < 2; i++) {
    const faderTouch = faderTouches[i];
    if (!faderTouch) {
      continue
    }

    for (const touch of touchArr) {
      if (faderTouch.identifier !== touch.identifier) {
        continue
      }

      faderTouches[i] = null;
      lastFaderPositions[i] = null;
      faderDirs[i] = 0;
      break;
    }
  }

  frames++;
};

const update = () => {
  for (let i = 0; i < lanes.length; i++) {
    const column = lanes[i];
    const isTouched = laneState[i];

    if (isTouched) {
      column.classList.add("active");
    } else {
      column.classList.remove("active");
    }
  }

  const areaWidth = document.body.clientWidth / 2;

  for (let i = 0; i < 2; i++) {
    const faderTouch = faderTouches[i];
    if (!faderTouch) {
      continue;
    }

    const x = faderTouch.clientX - (i * areaWidth);
    const lastX = lastFaderPositions[i];
    if (lastX !== null) {
      const delta = x - lastX;
      if (Math.abs(delta) > FADER_DEAD_ZONE) {
        faderDirs[i] = Math.sign(delta);
      }
    } else {
      faderDirs[i] = 0;
    }

    lastFaderPositions[i] = x;
  }

  // update status
  if (Date.now() - lastUpdate > 1000) {
    lastUpdate = Date.now();
    if (statusFps) {
      statusFps.innerHTML = `${frames} Hz`;
    }
    frames = 0;
  }

  if (statusFader) {
    statusFader.innerHTML = faderAnalogs.map(v => v.toFixed(2)).join(' | ');
  }

  updateFaderAnalog();
  window.requestAnimationFrame(update);
}

requestAnimationFrame(update);
