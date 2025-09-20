import "./style.css"

import { TouchManager, type Finger } from "./touch-manager";
import { SpiceConnection } from "./spice-connection";
import { listenHold } from "./listen-hold";

const FADER_DEAD_ZONE = 10;

function getSpiceHost(reset = false, text: string | null = null) {
  let spiceHost = reset ? null : window.localStorage.getItem("api_backend");
  if (spiceHost) {
    return spiceHost;
  }

  const ipPort = prompt(text ?? "Enter SpiceAPI Endpoint (IP:PORT)\n\nREAD THIS:\nPlease disable password as I don't want to write the RC4 code.\n\nTouch the \"ws://.....\" on status bar for more than 2s then release for re-set SpiceAPI endpoint.\n\nThanks for your using, by GEEKi", "192.168.1.100:1337");
  if (!ipPort) {
    return getSpiceHost(true, "Please enter SpiceAPI Endpoint");
  }

  if (!/\d+\.\d+\.\d+\.\d+\:\d+/.test(ipPort)) {
    return getSpiceHost(true, "Please enter a correct SpiceAPI Endpoint\n(example: 192.168.1.100:1337):");
  }

  const [ip, port] = ipPort.split(':');
  spiceHost = `ws://${ip}:${parseInt(port) + 1}/`;
  window.localStorage.setItem("api_backend", spiceHost);

  return spiceHost;
}

if (window.location.protocol.toLowerCase() == "https:") {
  alert("Please use HTTP instead, You can't connect to insecure websocket in https environment.");
  window.location.protocol = "http:"
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
const faderTouches: Array<Finger | null> = [null, null];
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

window.touchMgr.onTouchStart = (finger) => {
  const x = finger.x / document.body.clientWidth;
  const y = finger.y / document.body.clientHeight;

  if (y > 0.35) {
    return;
  }

  // find new touch for binding to fader
  if (faderTouches[1] && finger.x < faderTouches[1].x) {
    faderTouches[0] = finger;
  } else if (x < 0.5 && !faderTouches[0]) {
    faderTouches[0] = finger;
  }

  if (faderTouches[0] && finger.x > faderTouches[0].x) {
    faderTouches[1] = finger;
  } else if (x > 0.5 && !faderTouches[1]) {
    faderTouches[1] = finger;
  }
};

window.touchMgr.onTouchChange = (fingers) => {
  laneState.fill(false);

  for (const finger of fingers) {
    const x = finger.x / document.body.clientWidth;
    const y = finger.y / document.body.clientHeight;

    // update touch bounded to fader
    if (finger.id == faderTouches[0]?.id) {
      faderTouches[0] = finger;
      continue;
    }

    if (finger.id == faderTouches[1]?.id) {
      faderTouches[1] = finger;
      continue;
    }

    // lane area touches
    if (y < 0.35) {
      continue;
    }

    const column = Math.max(0, Math.min(Math.floor(x * 12), 11));
    laneState[column] = true;
  }

  frames++;
};

window.touchMgr.onTouchEnd = (finger) => {
  // remove fader touches
  for (let i = 0; i < 2; i++) {
    const faderTouch = faderTouches[i];
    if (!faderTouch) {
      continue;
    }

    if (faderTouch.id !== finger.id) {
      continue;
    }

    faderTouches[i] = null;
    lastFaderPositions[i] = null;
    faderDirs[i] = 0;
    break;
  }
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

    const x = faderTouch.x - (i * areaWidth);
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

setInterval(() => {
  sendButtonState(laneState);
}, 8);

const errorDisplay = document.querySelector<HTMLDivElement>("#errors")!;
if (errorDisplay) {
  window.onerror = (...args) => {
    errorDisplay.innerText += JSON.stringify(args) + "\n";
    errorDisplay.scrollTop = errorDisplay.scrollHeight;
  }
}
