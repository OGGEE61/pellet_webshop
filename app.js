/* ============================================================
   PELLET WEBSHOP — Application Logic
   Pricing / cart / order form + UX enhancements
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const state = { qty: 5, cartQty: 0 };

// ── Pricing tiers ──────────────────────────────────────────
const tiers = [
  { min: 1,  max: 4,        price: 75,        label: "Cena standardowa" },
  { min: 5,  max: 31,       price: 365 / 5,   label: "Pakiet 5 worków" },
  { min: 32, max: 64,       price: 1340 / 32, label: "Pakiet 32 worków" },
  { min: 65, max: Infinity, price: 2350 / 65, label: "Pełna paleta" }
];

// ── Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(n) + " PLN";

function tierFor(qty) {
  return tiers.slice().reverse().find(t => qty >= t.min);
}

function calc(qty) {
  const t = tierFor(qty);
  let total = qty * t.price;
  // Snap exact package prices to avoid floating-point drift
  if (qty === 5)  total = 365;
  if (qty === 32) total = 1340;
  if (qty === 65) total = 2350;
  return { ...t, total };
}

// ── Product UI ─────────────────────────────────────────────
function updateProduct() {
  const c = calc(state.qty);
  $("qty").value       = state.qty;
  $("qty").textContent = state.qty;
  $("weight").textContent = `${state.qty * 15} kg`;
  $("price").textContent  = money(c.total);
  $("perKg").textContent  = money(c.total / (state.qty * 15));
  $("tierLabel").textContent = c.label;
  $("tierHint").textContent  = state.qty >= 65
    ? "Cena paletowa — najlepsza oferta."
    : "Cena zależy od ilości worków.";

  // Next tier hint
  let next = null;
  if (state.qty < 5)  next = { qty: 5,  price: 365 };
  else if (state.qty < 32) next = { qty: 32, price: 1340 };
  else if (state.qty < 65) next = { qty: 65, price: 2350 };

  if (next) {
    const extra = Math.max(0, next.price - c.total);
    $("saving").textContent =
      `Dodaj ${next.qty - state.qty} worków, aby wejść w kolejny próg. Szacunkowo +${money(extra)}.`;
  } else {
    $("saving").textContent = "Masz najlepszą cenę paletową — 36,15 PLN / worek i 2,41 PLN / kg.";
  }

  // Active card highlight
  document.querySelectorAll(".package-card").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.qty) === state.qty);
  });
}

// ── Cart rendering ─────────────────────────────────────────
function renderCart() {
  const el = $("cartItems");
  if (!state.cartQty) {
    el.innerHTML = '<p class="empty">Koszyk jest pusty.</p>';
    $("cartTotal").textContent = "0 PLN";
    $("cartCount").textContent = "0";
    return;
  }
  const c = calc(state.cartQty);
  el.innerHTML = `
    <div class="cart-line">
      <div>
        <strong>Pellet drzewny — 15 kg</strong>
        <small>${state.cartQty} worków · ${state.cartQty * 15} kg</small>
      </div>
      <div style="text-align:right">
        <strong>${money(c.total)}</strong>
        <button type="button" id="removeCart">Usuń</button>
      </div>
    </div>`;
  $("cartTotal").textContent  = money(c.total);
  $("cartCount").textContent  = state.cartQty;
  $("removeCart").onclick = () => { state.cartQty = 0; renderCart(); };
}

// ── Cart open / close ──────────────────────────────────────
function openCart() {
  $("cartDrawer").classList.add("open");
  $("scrim").classList.add("open");
  $("cartDrawer").setAttribute("aria-hidden", "false");
  renderCart();
  // Trap focus for accessibility
  setTimeout(() => $("cartClose").focus(), 50);
}

function closeCart() {
  $("cartDrawer").classList.remove("open");
  $("scrim").classList.remove("open");
  $("cartDrawer").setAttribute("aria-hidden", "true");
}

// ── Package card clicks ────────────────────────────────────
document.querySelectorAll(".package-card").forEach(btn => {
  btn.addEventListener("click", () => {
    state.qty = Number(btn.dataset.qty);
    updateProduct();
  });
});

// ── Stepper ────────────────────────────────────────────────
$("minus").onclick = () => { state.qty = Math.max(1, state.qty - 1); updateProduct(); };
$("plus").onclick  = () => { state.qty += 1; updateProduct(); };

// ── Cart actions ───────────────────────────────────────────
$("addToCart").onclick = () => { state.cartQty = state.qty; openCart(); };
$("cartOpen").onclick  = openCart;
$("cartClose").onclick = closeCart;
$("scrim").onclick     = closeCart;

// Close drawer on Escape key
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeCart();
});

// ── Order submission ───────────────────────────────────────
$("sendOrder").onclick = async () => {
  const status = $("orderStatus");

  if (!state.cartQty) {
    status.textContent = "Dodaj produkt do zamówienia.";
    return;
  }

  const customer = {
    name:       $("customerName").value.trim(),
    email:      $("customerEmail").value.trim(),
    phone:      $("customerPhone").value.trim(),
    postcode:   $("postcode").value.trim(),
    notes:      $("notes").value.trim(),
    fulfilment: $("fulfilment").value
  };

  if (!customer.name || !customer.email || !customer.phone) {
    status.textContent = "Uzupełnij imię i nazwisko, e-mail oraz telefon.";
    return;
  }

  const c = calc(state.cartQty);
  const payload = {
    customer,
    items: [{ title: "Pellet drzewny — worek 15 kg", quantity: state.cartQty, unit_weight_kg: 15 }],
    total_pln:  Number(c.total.toFixed(2)),
    weight_kg:  state.cartQty * 15,
    shipping: customer.fulfilment === "pickup"
      ? { type: "pickup",   price_pln: 0 }
      : { type: "delivery", price_pln: null }
  };

  status.textContent = "Wysyłanie...";
  $("sendOrder").disabled = true;

  try {
    const response = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Nie udało się wysłać zamówienia.");

    status.innerHTML = `Dziękujemy. Zamówienie <strong>${data.order_number}</strong> zostało przyjęte.
      Potwierdzenie wysłano na <strong>${customer.email}</strong>. Skontaktujemy się w sprawie realizacji.`;

    state.cartQty = 0;
    renderCart();
    ["customerName", "customerEmail", "customerPhone", "postcode", "notes"]
      .forEach(id => $(id).value = "");
  } catch (e) {
    status.textContent = e.message;
  } finally {
    $("sendOrder").disabled = false;
  }
};

// ── Sticky header shrink on scroll ─────────────────────────
const header = $("site-header");
const onScroll = () => {
  header.classList.toggle("scrolled", window.scrollY > 40);
};
window.addEventListener("scroll", onScroll, { passive: true });

// ── Scroll-entrance observer ───────────────────────────────
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target); // fire once
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);

document.querySelectorAll("[data-animate]").forEach(el => observer.observe(el));

// ── Init ───────────────────────────────────────────────────
updateProduct();
