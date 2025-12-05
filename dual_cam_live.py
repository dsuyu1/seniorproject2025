#!/usr/bin/env python3
# Dual USB camera MJPEG streamer for headless Raspberry Pi.
# Adds per-camera FPS overlay, YOLOv11n face detection, and a /stats endpoint.
# Open http://<pi-ip>:8080/ in a browser. Quit with Ctrl+C.

import cv2
import time
from collections import deque
from flask import Flask, Response, render_template_string, jsonify
import argparse
from ultralytics import YOLO
from huggingface_hub import hf_hub_download

# -------- YOLO model load --------
print(" Loading local YOLO model: best.pt ...")
model = YOLO("best_SeniorProj.pt") 
print(" Local YOLO model loaded successfully.")


# -------- Small FPS helper --------
class FPSMeter:
    """Simple moving-average FPS meter."""
    def __init__(self, window=30):
        self.t_prev = None
        self.dts = deque(maxlen=window)
        self.fps = 0.0

    def tick(self) -> float:
        now = time.time()
        if self.t_prev is not None:
            self.dts.append(now - self.t_prev)
            if self.dts:
                avg = sum(self.dts) / len(self.dts)
                self.fps = (1.0 / avg) if avg > 0 else 0.0
        self.t_prev = now
        return self.fps

# -------- Minimal HTML UI --------
HTML = """
<!doctype html>
<title>Dual Cam Live (with FPS + YOLO Face Detection)</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #111; color: #eee; font-family: system-ui, sans-serif; }
  .wrap { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; }
  .card { background: #1c1c1c; padding: 10px; border-radius: 10px; box-shadow: 0 2px 8px #0008; }
  h3 { margin: 0 0 6px 0; font-weight: 600; font-size: 16px; }
  .meta { font-size: 13px; opacity: 0.85; margin-bottom: 6px; }
  img { max-width: 46vw; height: auto; display: block; border-radius: 6px; }
  @media (max-width: 800px) { img { max-width: 100vw; } }
</style>
<div class="wrap">
  <div class="card">
    <h3>Camera 0</h3>
    <div class="meta">FPS: <span id="fps0">--</span></div>
    <img src="/cam0" />
  </div>
  <div class="card">
    <h3>Camera 1</h3>
    <div class="meta">FPS: <span id="fps1">--</span></div>
    <img src="/cam1" />
  </div>
</div>
<script>
  async function poll() {
    try {
      const r = await fetch('/stats', {cache: 'no-store'});
      const j = await r.json();
      document.getElementById('fps0').textContent = j.cam0_fps.toFixed(1);
      document.getElementById('fps1').textContent = j.cam1_fps.toFixed(1);
    } catch (e) { /* ignore */ }
  }
  setInterval(poll, 1000);
  poll();
</script>
"""

# -------- Camera helpers --------
def open_cam(dev: str, width: int, height: int) -> cv2.VideoCapture:
    """Open a camera by index ('0') or path ('/dev/video0') with MJPEG."""
    dev_id = int(dev) if str(dev).isdigit() else dev
    cap = cv2.VideoCapture(dev_id, cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, float(width))
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, float(height))
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap

def mjpeg_generator(cap: cv2.VideoCapture, meter: FPSMeter, label: str):
    """Yield a motion-JPEG stream with YOLO face detection + FPS overlay."""
    while True:
        ok, frame = cap.read()
        if not ok:
            continue

        # --- YOLO face detection ---
        try:
            results = model.predict(frame, imgsz=320, conf=0.5, verbose=False)
            for r in results:
                frame = r.plot()
        except Exception as e:
            print(f"[{label}] YOLO error:", e)

        # --- FPS overlay ---
        fps = meter.tick()
        text = f"{label}  FPS: {fps:.1f}"
        cv2.putText(frame, text, (10, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        ok, buf = cv2.imencode(".jpg", frame)
        if not ok:
            continue

        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" +
               buf.tobytes() + b"\r\n")

# -------- Flask app --------
def build_app(cap0, cap1, fps0: FPSMeter, fps1: FPSMeter) -> Flask:
    app = Flask(__name__)

    @app.route("/")
    def index():
        return render_template_string(HTML)

    @app.route("/cam0")
    def cam0():
        return Response(
            mjpeg_generator(cap0, fps0, "cam0"),
            mimetype="multipart/x-mixed-replace; boundary=frame"
        )

    @app.route("/cam1")
    def cam1():
        return Response(
            mjpeg_generator(cap1, fps1, "cam1"),
            mimetype="multipart/x-mixed-replace; boundary=frame"
        )

    @app.route("/stats")
    def stats():
        return jsonify({
            "cam0_fps": round(fps0.fps, 2),
            "cam1_fps": round(fps1.fps, 2)
        })

    return app

# -------- Main --------
def main():
    ap = argparse.ArgumentParser(description="Dual camera MJPEG streamer with YOLOv11n face detection and FPS")
    ap.add_argument("--cam0", type=str, default="0")
    ap.add_argument("--cam1", type=str, default="2")
    ap.add_argument("--width", type=int, default=640)
    ap.add_argument("--height", type=int, default=360)
    ap.add_argument("--host", type=str, default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()

    cap0 = open_cam(args.cam0, args.width, args.height)
    cap1 = open_cam(args.cam1, args.width, args.height)
    if not cap0.isOpened():
        raise RuntimeError(f"Cannot open camera {args.cam0}")
    if not cap1.isOpened():
        raise RuntimeError(f"Cannot open camera {args.cam1}")

    fps0 = FPSMeter()
    fps1 = FPSMeter()

    app = build_app(cap0, cap1, fps0, fps1)
    app.run(host=args.host, port=args.port, threaded=True)

if __name__ == "__main__":
    main()
