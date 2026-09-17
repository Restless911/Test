// Secret X💢 Bee Swarm Event Hub — backend
// Tracks servers submitted by clients and which events are currently live in them.

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY; // set this in Railway's Variables tab
const STALE_MS = 3 * 60 * 1000; // drop a server if it hasn't heartbeat in 3 min

// jobId -> { placeId, jobId, playerCount, events, submittedBy, updatedAt }
const servers = new Map();

const EVENT_KEYS = ["mondoChick", "puffshroom", "windyBee", "viciousBee", "stickBug"];

function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // no key configured = open (fine for testing, not for prod)
  const key = req.header("x-api-key");
  if (key !== API_KEY) {
    return res.status(401).json({ error: "invalid or missing x-api-key" });
  }
  next();
}

function cleanupStale() {
  const now = Date.now();
  for (const [jobId, s] of servers) {
    if (now - s.updatedAt > STALE_MS) servers.delete(jobId);
  }
}

app.get("/", (_req, res) => {
  res.json({ ok: true, name: "Secret X💢 Bee Swarm Event Hub" });
});

// Client calls this every ~30s to say "I'm alive, here's what's happening in my server"
app.post("/submit", requireApiKey, (req, res) => {
  const { placeId, jobId, playerCount, events, submittedBy } = req.body || {};

  if (!placeId || !jobId) {
    return res.status(400).json({ error: "placeId and jobId are required" });
  }

  const cleanEvents = {};
  for (const k of EVENT_KEYS) {
    cleanEvents[k] = !!(events && events[k]);
  }

  servers.set(jobId, {
    placeId: String(placeId),
    jobId: String(jobId),
    playerCount: Number(playerCount) || 0,
    events: cleanEvents,
    submittedBy: submittedBy ? String(submittedBy).slice(0, 50) : "unknown",
    updatedAt: Date.now(),
  });

  res.json({ ok: true });
});

// Client calls this to get the current list. Optional ?event=mondoChick to filter.
app.get("/servers", (req, res) => {
  cleanupStale();

  const { placeId, event } = req.query;
  let list = Array.from(servers.values());

  if (placeId) list = list.filter((s) => s.placeId === String(placeId));
  if (event) {
    if (!EVENT_KEYS.includes(event)) {
      return res.status(400).json({ error: `unknown event '${event}'`, validEvents: EVENT_KEYS });
    }
    list = list.filter((s) => s.events[event]);
  }

  list.sort((a, b) => b.updatedAt - a.updatedAt);

  res.json({ servers: list, validEvents: EVENT_KEYS });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bee Swarm hub listening on ${PORT}`));
