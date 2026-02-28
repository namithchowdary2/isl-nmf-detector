"""
Gunicorn production config.
Run: gunicorn -c gunicorn.conf.py app:app
"""
import multiprocessing
import os

# ── Workers ────────────────────────────────────────────────────────────────
# gevent async workers for high concurrency (no GIL issues with MediaPipe
# because each worker creates its own FaceMesh via threading.local)
worker_class  = "gevent"
workers       = int(os.getenv("WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_connections = 1000
threads       = 1  # gevent handles concurrency via greenlets

# ── Network ────────────────────────────────────────────────────────────────
bind          = f"0.0.0.0:{os.getenv('PORT', '5000')}"
backlog       = 2048

# ── Timeouts ───────────────────────────────────────────────────────────────
timeout       = 60      # Hard kill after 60s
graceful_timeout = 30   # SIGTERM grace period
keepalive     = 5

# ── Logging ────────────────────────────────────────────────────────────────
accesslog     = "-"
errorlog      = "-"
loglevel      = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(M)sms'

# ── Process naming ─────────────────────────────────────────────────────────
proc_name     = "isl-nmf-detector"

# ── Lifecycle hooks ────────────────────────────────────────────────────────
def on_starting(server):
    server.log.info("ISL NMF Detector starting up...")

def post_fork(server, worker):
    # Each forked worker initializes its own MediaPipe on first request
    server.log.info(f"Worker {worker.pid} forked")

def worker_exit(server, worker):
    server.log.info(f"Worker {worker.pid} exiting")
