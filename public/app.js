const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
let currentRooms = [];
let currentNights = 1;
const today = new Date();
const isoToday = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
$("checkIn").min = isoToday; $("checkOut").min = isoToday;
$("checkIn").value = isoToday;
const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
$("checkOut").value = new Date(tomorrow.getTime()-tomorrow.getTimezoneOffset()*60000).toISOString().slice(0,10);
$("checkIn").addEventListener("change",()=>{$("checkOut").min=$("checkIn").value; if($("checkOut").value <= $("checkIn").value){const d=new Date($("checkIn").value+"T00:00:00");d.setDate(d.getDate()+1);$("checkOut").value=d.toISOString().slice(0,10);}});
$("themeToggle").onclick=()=>document.body.classList.toggle("dark");

async function api(url, options={}) {
  const response=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({error:"Unexpected server response."}));
  if(!response.ok) throw new Error(data.error||"Something went wrong.");
  return data;
}
function roomCard(room, canBook=true){
  return `<article class="room-card"><img src="${room.image}" alt="${room.name}" loading="lazy"><div class="room-info"><div class="room-top"><h3>${room.name}</h3><div class="price">${money(room.price)}<small> / night</small></div></div><p>${room.description}</p><div class="room-meta"><span>♙ ${room.capacity} guests</span><span>▱ ${room.size}</span><span>⌑ ${room.bed}</span></div><button class="primary-btn book-room" data-room="${room.id}" ${canBook?"":"disabled"}>${canBook?"Choose this room →":"Unavailable"}</button></div></article>`;
}
async function loadRooms(search=false){
  const grid=$("roomGrid"); grid.innerHTML='<div class="loading">Checking room availability…</div>';
  try{
    const params=new URLSearchParams();
    if(search){params.set("checkIn",$("checkIn").value);params.set("checkOut",$("checkOut").value);params.set("guests",$("guests").value);}
    const data=await api("/api/rooms"+(params.size?"?"+params:""));
    currentRooms=data.rooms; currentNights=data.nights||1;
    grid.innerHTML=currentRooms.length?currentRooms.map(r=>roomCard(r)).join():'<div class="loading">No rooms match those dates and guest count. Try different dates or fewer guests.</div>';
    $("searchMessage").textContent=search?`${currentRooms.length} room type(s) available for ${currentNights} night(s). Select a room to continue.`:"Choose your dates to search live availability.";
    document.querySelectorAll(".book-room").forEach(btn=>btn.addEventListener("click",()=>openBooking(btn.dataset.room)));
  }catch(e){grid.innerHTML=`<p class="loading">${e.message}</p>`;}
}
$("searchForm").addEventListener("submit",e=>{e.preventDefault();if($("checkOut").value<=$("checkIn").value){$("searchMessage").textContent="Check-out must be after check-in.";return;}loadRooms(true);});
function openBooking(id){
  const room=currentRooms.find(r=>r.id===id); if(!room)return;
  const guests=Number($("guests").value);
  $("selectedRoomId").value=id;$("modalRoomName").textContent=room.name;
  $("bookingGuests").innerHTML=Array.from({length:room.capacity},(_,i)=>`<option value="${i+1}" ${i+1===guests?"selected":""}>${i+1}</option>`).join("");
  const subtotal=room.price*currentNights, tax=subtotal*.12;
  $("bookingSummary").innerHTML=`${$("checkIn").value} → ${$("checkOut").value} · ${currentNights} night(s)<br>${money(room.price)} × ${currentNights} nights: ${money(subtotal)}<br>Estimated tax (12%): ${money(tax)}<br><strong>Total: ${money(subtotal+tax)}</strong>`;
  $("bookingMessage").textContent="";$("bookingModal").hidden=false;
}
$("closeModal").onclick=()=>$("bookingModal").hidden=true;
$("bookingModal").addEventListener("click",e=>{if(e.target===$("bookingModal"))$("bookingModal").hidden=true;});
$("bookingForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=$("confirmButton");btn.disabled=true;btn.textContent="Confirming…";$("bookingMessage").textContent="";
  try{
    const {booking}=await api("/api/bookings",{method:"POST",body:JSON.stringify({roomId:$("selectedRoomId").value,checkIn:$("checkIn").value,checkOut:$("checkOut").value,guests:Number($("bookingGuests").value),name:$("guestName").value,email:$("guestEmail").value,phone:$("guestPhone").value})});
    $("bookingModal").hidden=true;
    $("lookupResult").innerHTML=bookingCard(booking)+`<p class="hint">Save your reference <strong>${booking.reference}</strong>. You can use it with your email in Manage a booking.</p>`;
    $("lookupRef").value=booking.reference;$("lookupEmail").value=booking.email;
    $("manage").scrollIntoView({behavior:"smooth"});
    await loadRooms(true);
  }catch(err){$("bookingMessage").textContent=err.message;}
  finally{btn.disabled=false;btn.textContent="Confirm reservation →";}
});
function bookingCard(b){
  return `<div class="booking-result"><span class="status">${b.status}</span><h3>${b.roomName} · ${b.reference}</h3>${b.guestName} · ${b.guests} guest(s)<br>${b.checkIn} → ${b.checkOut} (${b.nights} nights)<br>Total: <strong>${money(b.total)}</strong></div>`;
}
$("lookupForm").addEventListener("submit",async e=>{
  e.preventDefault();const area=$("lookupResult");area.innerHTML='<p class="hint">Looking up reservation…</p>';
  try{
    const ref=encodeURIComponent($("lookupRef").value.trim()),email=encodeURIComponent($("lookupEmail").value.trim());
    const {booking}=await api(`/api/bookings/${ref}?email=${email}`);
    area.innerHTML=bookingCard(booking)+(booking.status==="confirmed"?'<button class="danger-btn" id="cancelBooking">Cancel this reservation</button>':"");
    if($("cancelBooking"))$("cancelBooking").onclick=async()=>{if(!confirm("Cancel this reservation?"))return;try{const result=await api(`/api/bookings/${ref}/cancel`,{method:"POST",body:JSON.stringify({email:$("lookupEmail").value})});area.innerHTML=bookingCard(result.booking);await loadRooms(true);}catch(err){area.insertAdjacentHTML("beforeend",`<p class="form-message">${err.message}</p>`);}};
  }catch(err){area.innerHTML=`<p class="form-message">${err.message}</p>`;}
});
loadRooms();
