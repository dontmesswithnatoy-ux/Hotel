
const $ = id => document.getElementById(id);

const money = n =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(n);

const STORAGE_KEY = "grandstay_demo_bookings_v1";

// ROOM INFORMATION
const rooms = [
  {
    id: "standard",
    name: "Standard Room",
    description: "A comfortable retreat with everything you need for a relaxing stay.",
    price: 89,
    capacity: 2,
    size: "28 m²",
    bed: "1 Queen Bed",
    image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1000&q=85"
  },
  {
    id: "deluxe",
    name: "Deluxe Room",
    description: "Extra space, a lounge corner and calming views for a little more comfort.",
    price: 139,
    capacity: 3,
    size: "36 m²",
    bed: "1 King Bed",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=85"
  },
  {
    id: "suite",
    name: "Executive Suite",
    description: "A separate living area and premium details for an elevated getaway.",
    price: 219,
    capacity: 4,
    size: "54 m²",
    bed: "1 King Bed + Sofa Bed",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1000&q=85"
  }
];

let visibleRooms = [...rooms];
let stayNights = 1;

// DATE SETUP
const today = new Date();

const localISO = d =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

const todayISO = localISO(today);

$("checkIn").min = todayISO;
$("checkOut").min = todayISO;
$("checkIn").value = todayISO;

const nextDay = new Date(today);
nextDay.setDate(nextDay.getDate() + 1);

$("checkOut").value = localISO(nextDay);

// BOOKING STORAGE
const getBookings = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveBookings = items =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

// BOOKING HELPERS
const nights = (a, b) =>
  Math.round(
    (Date.parse(b + "T00:00:00Z") -
      Date.parse(a + "T00:00:00Z")) / 86400000
  );

const overlaps = (a, b, c, d) => a < d && c < b;

const reference = () =>
  "GS-" + Math.random().toString(36).slice(2, 10).toUpperCase();

// DARK MODE
$("themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
};

// CHECK-IN AND CHECK-OUT
$("checkIn").addEventListener("change", () => {
  $("checkOut").min = $("checkIn").value;

  if ($("checkOut").value <= $("checkIn").value) {
    const d = new Date($("checkIn").value + "T00:00:00");
    d.setDate(d.getDate() + 1);
    $("checkOut").value = localISO(d);
  }
});

// ROOM CARD
function roomCard(room) {
  return `
    <article class="room-card">

      <img
        src="${room.image}"
        alt="${room.name}"
        loading="lazy"
        onerror="this.onerror=null;this.src='https://placehold.co/1000x600?text=Room+Photo';"
      >

      <div class="room-info">

        <div class="room-top">
          <h3>${room.name}</h3>

          <div class="price">
            ${money(room.price)}
            <small> / night</small>
          </div>
        </div>

        <p>${room.description}</p>

        <div class="room-meta">
          <span>♙ ${room.capacity} guests</span>
          <span>▱ ${room.size}</span>
          <span>⌑ ${room.bed}</span>
        </div>

        <button
          class="primary-btn book-room"
          data-room="${room.id}"
        >
          Choose this room →
        </button>

      </div>
    </article>
  `;
}

// DISPLAY ROOMS
function renderRooms() {
  $("roomGrid").innerHTML = visibleRooms.length
    ? visibleRooms.map(roomCard).join("")
    : `
      <div class="empty-state">
        No rooms are available for those dates and guest count.
        Try another date or fewer guests.
      </div>
    `;

  document.querySelectorAll(".book-room").forEach(button => {
    button.addEventListener("click", () => {
      openBooking(button.dataset.room);
    });
  });
}

// SEARCH AVAILABLE ROOMS
function searchRooms() {
  const ci = $("checkIn").value;
  const co = $("checkOut").value;
  const guest = Number($("guests").value);

  if (!ci || !co || nights(ci, co) < 1) {
    $("searchMessage").textContent =
      "Please choose a valid check-in and check-out date.";

    return false;
  }

  stayNights = nights(ci, co);

  const bookings = getBookings().filter(
    booking => booking.status === "confirmed"
  );

  visibleRooms = rooms.filter(room =>
    room.capacity >= guest &&
    !bookings.some(booking =>
      booking.roomId === room.id &&
      overlaps(
        ci,
        co,
        booking.checkIn,
        booking.checkOut
      )
    )
  );

  $("searchMessage").textContent =
    `${visibleRooms.length} room type(s) available for ${stayNights} night(s). Select a room to continue.`;

  renderRooms();

  return true;
}

// SEARCH FORM
$("searchForm").addEventListener("submit", event => {
  event.preventDefault();

  if (searchRooms()) {
    $("rooms").scrollIntoView({
      behavior: "smooth"
    });
  }
});

// OPEN BOOKING MODAL
function openBooking(id) {
  const room = visibleRooms.find(room => room.id === id);

  if (!room) return;

  $("selectedRoomId").value = id;
  $("modalRoomName").textContent = room.name;

  const count = Number($("guests").value);

  $("bookingGuests").innerHTML = Array.from(
    { length: room.capacity },
    (_, i) => `
      <option
        value="${i + 1}"
        ${i + 1 === count ? "selected" : ""}
      >
        ${i + 1}
      </option>
    `
  ).join("");

  const subtotal = room.price * stayNights;
  const tax = Math.round(subtotal * 0.12 * 100) / 100;

  $("bookingSummary").innerHTML = `
    ${$("checkIn").value} → ${$("checkOut").value}
    · ${stayNights} night(s)
    <br>

    ${money(room.price)} × ${stayNights} nights:
    ${money(subtotal)}
    <br>

    Estimated tax (12%):
    ${money(tax)}
    <br>

    <strong>Total: ${money(subtotal + tax)}</strong>
  `;

  $("bookingMessage").textContent = "";
  $("bookingModal").hidden = false;
}

// CLOSE BOOKING MODAL
$("closeModal").onclick = () => {
  $("bookingModal").hidden = true;
};

$("bookingModal").addEventListener("click", event => {
  if (event.target === $("bookingModal")) {
    $("bookingModal").hidden = true;
  }
});

// SUBMIT BOOKING
$("bookingForm").addEventListener("submit", event => {
  event.preventDefault();

  const room = rooms.find(
    room => room.id === $("selectedRoomId").value
  );

  const ci = $("checkIn").value;
  const co = $("checkOut").value;

  const guestCount = Number($("bookingGuests").value);

  if (!room || nights(ci, co) < 1) {
    $("bookingMessage").textContent =
      "Please search for a room again.";

    return;
  }

  if (guestCount > room.capacity) {
    $("bookingMessage").textContent =
      "This room does not have enough guest capacity.";

    return;
  }

  const bookings = getBookings();

  const alreadyBooked = bookings.some(booking =>
    booking.roomId === room.id &&
    booking.status === "confirmed" &&
    overlaps(
      ci,
      co,
      booking.checkIn,
      booking.checkOut
    )
  );

  if (alreadyBooked) {
    $("bookingMessage").textContent =
      "This room has just been booked for those dates. Please search again.";

    return;
  }

  const n = nights(ci, co);
  const subtotal = room.price * n;
  const taxes = Math.round(subtotal * 0.12 * 100) / 100;

  const booking = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),

    reference: reference(),
    roomId: room.id,
    roomName: room.name,

    guestName: $("guestName").value.trim(),
    email: $("guestEmail").value.trim().toLowerCase(),
    phone: $("guestPhone").value.trim(),

    guests: guestCount,

    checkIn: ci,
    checkOut: co,

    nights: n,
    subtotal,
    taxes,

    total: Math.round((subtotal + taxes) * 100) / 100,

    status: "confirmed",
    createdAt: new Date().toISOString()
  };

  if (
    !booking.guestName ||
    !booking.email ||
    !booking.phone
  ) {
    $("bookingMessage").textContent =
      "Please complete all guest details.";

    return;
  }

  bookings.push(booking);
  saveBookings(bookings);

  $("bookingModal").hidden = true;

  $("lookupRef").value = booking.reference;
  $("lookupEmail").value = booking.email;

  $("lookupResult").innerHTML =
    bookingCard(booking) +
    `
      <p class="hint">
        Save your confirmation reference:
        <strong>${booking.reference}</strong>.
      </p>
    `;

  $("manage").scrollIntoView({
    behavior: "smooth"
  });

  searchRooms();
});

// BOOKING DETAILS CARD
function bookingCard(booking) {
  return `
    <div class="booking-result">

      <span class="status">
        ${booking.status}
      </span>

      <h3>
        ${booking.roomName} · ${booking.reference}
      </h3>

      ${booking.guestName}
      · ${booking.guests} guest(s)

      <br>

      ${booking.checkIn} → ${booking.checkOut}
      (${booking.nights} nights)

      <br>

      Total:
      <strong>${money(booking.total)}</strong>

    </div>
  `;
}

// FIND BOOKING
$("lookupForm").addEventListener("submit", event => {
  event.preventDefault();

  const ref = $("lookupRef").value.trim().toUpperCase();

  const email = $("lookupEmail").value.trim().toLowerCase();

  const booking = getBookings().find(
    booking =>
      booking.reference === ref &&
      booking.email === email
  );

  const area = $("lookupResult");

  if (!booking) {
    area.innerHTML = `
      <p class="form-message">
        No matching booking found.
        Check your reference and email.
      </p>
    `;

    return;
  }

  area.innerHTML =
    bookingCard(booking) +
    (
      booking.status === "confirmed"
        ? `
          <button class="danger-btn" id="cancelBooking">
            Cancel this reservation
          </button>
        `
        : ""
    );

  // CANCEL BOOKING
  if ($("cancelBooking")) {
    $("cancelBooking").onclick = () => {
      if (!confirm("Cancel this reservation?")) return;

      const all = getBookings();

      const target = all.find(
        item => item.id === booking.id
      );

      if (target) {
        target.status = "cancelled";
      }

      saveBookings(all);

      area.innerHTML = bookingCard(target);

      searchRooms();
    };
  }
}

// INITIAL DISPLAY
renderRooms();
