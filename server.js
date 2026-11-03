const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "GrandStayAdmin2026!";
const SESSION_SECRET = process.env.SESSION_SECRET || "development-only-change-this-secret";
const DB_PATH = path.join(__dirname, "data", "db.json");

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}
function writeDB(db) {
  const temp = DB_PATH + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DB_PATH);
}
function clean(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}
function validDate(s) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(s))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function nightsBetween(checkIn, checkOut) {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000);
}
function overlaps(aIn, aOut, bIn, bOut) {
  return aIn < bOut && bIn < aOut;
}
function bookingRef() {
  return "GS-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

// Signed, HTTP-only cookie session. This keeps the demo dependency-light.
function makeToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return body + "." + sig;
}
function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
function requireAdmin(req, res, next) {
  const token = (req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith("gs_admin="))?.slice(9);
  const session = verifyToken(token);
  if (!session || session.role !== "admin") return res.status(401).json({ error: "Please sign in as an administrator." });
  next();
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "GrandStay booking API" }));

app.get("/api/rooms", (req, res) => {
  const db = readDB();
  const rooms = db.rooms.filter(r => r.active !== false);
  const { checkIn, checkOut, guests } = req.query;
  if (!checkIn && !checkOut) return res.json({ rooms });
  if (!validDate(checkIn) || !validDate(checkOut) || nightsBetween(checkIn, checkOut) < 1) {
    return res.status(400).json({ error: "Choose valid check-in and check-out dates. Check-out must be after check-in." });
  }
  const party = Math.max(1, Math.min(10, Number(guests) || 1));
  const available = rooms.filter(room => room.capacity >= party &&
    !db.bookings.some(b => b.roomId === room.id && ["confirmed", "checked-in"].includes(b.status) &&
      overlaps(checkIn, checkOut, b.checkIn, b.checkOut)));
  res.json({ rooms: available, nights: nightsBetween(checkIn, checkOut) });
});

app.post("/api/bookings", (req, res) => {
  const checkIn = clean(req.body.checkIn, 10);
  const checkOut = clean(req.body.checkOut, 10);
  const roomId = clean(req.body.roomId, 40);
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 160).toLowerCase();
  const phone = clean(req.body.phone, 40);
  const guests = Number(req.body.guests);
  if (!validDate(checkIn) || !validDate(checkOut) || nightsBetween(checkIn, checkOut) < 1)
    return res.status(400).json({ error: "Please enter valid stay dates." });
  if (!name || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !phone)
    return res.status(400).json({ error: "Enter your name, a valid email address and phone number." });
  if (!Number.isInteger(guests) || guests < 1 || guests > 10)
    return res.status(400).json({ error: "Guest count must be between 1 and 10." });

  const db = readDB();
  const room = db.rooms.find(r => r.id === roomId && r.active !== false);
  if (!room) return res.status(404).json({ error: "That room is not available." });
  if (guests > room.capacity) return res.status(400).json({ error: `This room accommodates up to ${room.capacity} guests.` });
  const conflict = db.bookings.some(b => b.roomId === roomId && ["confirmed", "checked-in"].includes(b.status) &&
    overlaps(checkIn, checkOut, b.checkIn, b.checkOut));
  if (conflict) return res.status(409).json({ error: "Sorry, this room was just booked for those dates. Please search again." });

  const nights = nightsBetween(checkIn, checkOut);
  const subtotal = room.price * nights;
  const taxes = Math.round(subtotal * 0.12 * 100) / 100;
  const booking = {
    id: crypto.randomUUID(), reference: bookingRef(), roomId, roomName: room.name,
    guestName: name, email, phone, guests, checkIn, checkOut, nights,
    nightlyRate: room.price, subtotal, taxes, total: Math.round((subtotal + taxes) * 100) / 100,
    status: "confirmed", createdAt: new Date().toISOString()
  };
  db.bookings.push(booking);
  writeDB(db);
  res.status(201).json({ booking });
});

app.get("/api/bookings/:reference", (req, res) => {
  const ref = clean(req.params.reference, 30).toUpperCase();
  const email = clean(req.query.email, 160).toLowerCase();
  const booking = readDB().bookings.find(b => b.reference === ref && b.email === email);
  if (!booking) return res.status(404).json({ error: "We couldn't find a booking with that reference and email." });
  res.json({ booking });
});

app.post("/api/bookings/:reference/cancel", (req, res) => {
  const ref = clean(req.params.reference, 30).toUpperCase();
  const email = clean(req.body.email, 160).toLowerCase();
  const db = readDB();
  const booking = db.bookings.find(b => b.reference === ref && b.email === email);
  if (!booking) return res.status(404).json({ error: "Booking not found. Check your reference and email." });
  if (booking.status !== "confirmed") return res.status(409).json({ error: "Only confirmed bookings can be cancelled in this demo." });
  booking.status = "cancelled";
  booking.cancelledAt = new Date().toISOString();
  writeDB(db);
  res.json({ booking });
});

app.post("/api/admin/login", (req, res) => {
  if (!safeEqual(clean(req.body.username, 80), ADMIN_USERNAME) ||
      !safeEqual(String(req.body.password || ""), ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = makeToken({ role: "admin", exp: Date.now() + 8 * 60 * 60 * 1000 });
  res.setHeader("Set-Cookie", `gs_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
  res.json({ ok: true });
});
app.post("/api/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "gs_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});
app.get("/api/admin/session", requireAdmin, (_req, res) => res.json({ authenticated: true }));
app.get("/api/admin/dashboard", requireAdmin, (_req, res) => {
  const db = readDB();
  const active = db.bookings.filter(b => ["confirmed", "checked-in"].includes(b.status));
  res.json({
    rooms: db.rooms,
    bookings: [...db.bookings].sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
    stats: {
      totalBookings: db.bookings.length,
      activeBookings: active.length,
      cancelled: db.bookings.filter(b => b.status === "cancelled").length,
      revenue: active.reduce((sum,b) => sum + b.total, 0)
    }
  });
});
app.patch("/api/admin/bookings/:id", requireAdmin, (req, res) => {
  const status = clean(req.body.status, 20);
  if (!["confirmed", "checked-in", "checked-out", "cancelled"].includes(status))
    return res.status(400).json({ error: "Invalid booking status." });
  const db = readDB();
  const booking = db.bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  booking.status = status;
  writeDB(db);
  res.json({ booking });
});
app.patch("/api/admin/rooms/:id", requireAdmin, (req, res) => {
  const db = readDB();
  const room = db.rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found." });
  if (req.body.active !== undefined) room.active = Boolean(req.body.active);
  if (req.body.price !== undefined) {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 1 || price > 10000) return res.status(400).json({ error: "Enter a valid room price." });
    room.price = Math.round(price * 100) / 100;
  }
  writeDB(db);
  res.json({ room });
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`GrandStay is running at http://localhost:${PORT}`));
