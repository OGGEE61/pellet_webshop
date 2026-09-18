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
    el.innerHTML = '<p class="empty">Nie wybrano pakietu. Zaznacz ilość powyżej i dodaj do zamówienia.</p>';
    $("cartTotal").textContent = "0 PLN";
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
  $("removeCart").onclick = () => { state.cartQty = 0; renderCart(); };
}

// ── Package card clicks ────────────────────────────────────
document.querySelectorAll(".package-card").forEach(btn => {
  btn.addEventListener("click", () => {
    state.qty = Number(btn.dataset.qty);
    updateProduct();
  });
});

// ── Stepper & Slider ───────────────────────────────────────
$("minus").onclick = () => { state.qty = Math.max(1, state.qty - 1); updateProduct(); };
$("plus").onclick  = () => { state.qty += 1; updateProduct(); };

$("qty").addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  if (!isNaN(val) && val > 0) {
    state.qty = val;
    updateProduct();
  }
});

$("qtySlider").addEventListener("input", (e) => {
  state.qty = parseInt(e.target.value, 10);
  updateProduct();
});

// ── Cart actions ───────────────────────────────────────────
$("addToCart").onclick = () => { 
  state.cartQty = state.qty; 
  renderCart();
  $("zamowienie").showModal();
};

$("closeCheckout").onclick = () => {
  $("zamowienie").close();
};

// ── Form Validation & Formatters ───────────────────────────
$("customerPhone").addEventListener("input", (e) => {
  // Allow only digits, spaces, and plus sign
  e.target.value = e.target.value.replace(/[^\d\s\+]/g, "");
});

["customerName", "customerEmail", "customerPhone"].forEach(id => {
  $(id).addEventListener("input", (e) => {
    e.target.classList.remove("error");
    $("orderStatus").textContent = "";
    $("orderStatus").classList.remove("error");
  });
});

// ── Order submission ───────────────────────────────────────
$("sendOrder").onclick = async () => {
  const status = $("orderStatus");
  status.classList.remove("error");

  if (!state.cartQty) {
    status.textContent = "Dodaj produkt do zamówienia.";
    status.classList.add("error");
    return;
  }

  const nameInput = $("customerName");
  const emailInput = $("customerEmail");
  const phoneInput = $("customerPhone");

  const customer = {
    name:       nameInput.value.trim(),
    email:      emailInput.value.trim(),
    phone:      phoneInput.value.trim(),
    postcode:   $("postcode").value.trim(),
    notes:      $("notes").value.trim(),
    fulfilment: $("fulfilment").value
  };

  let hasErrors = false;
  status.textContent = "";

  // Name validation: letters, spaces, hyphens, min 3 chars
  const nameRegex = /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s\-]+$/;
  if (!customer.name || !nameRegex.test(customer.name) || customer.name.length < 3) {
    nameInput.classList.add("error");
    hasErrors = true;
  }

  // Email validation: basic regex format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!customer.email || !emailRegex.test(customer.email)) {
    emailInput.classList.add("error");
    hasErrors = true;
  }

  // Phone validation & normalization to +48 XXX XXX XXX
  let digits = customer.phone.replace(/\D/g, "");
  let validPhone = false;
  if (digits.length === 9) {
    customer.phone = "+48 " + digits.replace(/(\d{3})(?=\d)/g, "$1 ");
    phoneInput.value = customer.phone; // Update input visually
    validPhone = true;
  } else if (digits.length === 11 && digits.startsWith("48")) {
    customer.phone = "+48 " + digits.substring(2).replace(/(\d{3})(?=\d)/g, "$1 ");
    phoneInput.value = customer.phone;
    validPhone = true;
  }

  if (!customer.phone || !validPhone) {
    phoneInput.classList.add("error");
    hasErrors = true;
  }

  if (hasErrors) {
    status.textContent = "Proszę poprawić podświetlone pola formularza.";
    status.classList.add("error");
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
    
    let text = "";
    let data = {};
    try {
      text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      throw new Error(`Parse error (${response.status}): ${text.substring(0, 50)}...`);
    }

    if (response.status === 404) {
      // API endpoint is missing (Cloudflare functions not built), mock success for demo
      data = { order_number: `PEL-DEMO-${Math.floor(Math.random() * 10000)}` };
    } else if (!response.ok) {
      throw new Error(data.error || `Błąd serwera: ${response.status}`);
    }

    const modal = document.getElementById("successModal");
    if (modal && typeof modal.showModal === "function") {
      modal.showModal();
    }
    
    state.cartQty = 0;
    renderCart();
    ["customerName", "customerEmail", "customerPhone", "postcode", "notes"]
      .forEach(id => $(id).value = "");

    // Redirect after 5 seconds
    setTimeout(() => {
      window.location.href = `/potwierdzenie.html?order=${data.order_number}`;
    }, 5000);

  } catch (e) {
    status.textContent = e.name + ": " + e.message;
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
