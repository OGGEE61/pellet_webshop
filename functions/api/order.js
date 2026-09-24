function makeOrderNumber() {
  const d = new Date();
  const date = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `PEL-${date}-${suffix}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function onRequestPost(context) {
  try {
    console.log("Received new order request.");
    const body = await context.request.json();
    const { customer, items, total_pln, weight_kg, shipping } = body || {};

    if (
      !customer?.name ||
      !customer?.email ||
      !customer?.phone ||
      !items?.length
    ) {
      console.error("Validation failed. Missing required fields in body:", {
        customer,
        items,
      });
      return Response.json(
        { error: "Brak wymaganych danych zamówienia." },
        { status: 400 },
      );
    }

    const apiKey = context.env.RESEND_API_KEY;
    const orderEmail = context.env.ORDER_EMAIL;
    const from = context.env.ORDER_FROM;

    console.log("Checking Env Vars:", {
      hasApiKey: !!apiKey,
      orderEmail: orderEmail,
      from: from,
    });

    if (!apiKey || !orderEmail || !from) {
      console.error("Missing email configuration");
      return Response.json(
        {
          error:
            "Brak konfiguracji e-mail. Ustaw RESEND_API_KEY, ORDER_EMAIL i ORDER_FROM w Cloudflare.",
        },
        { status: 500 },
      );
    }

    const orderNumber = makeOrderNumber();
    const fulfilment =
      shipping?.type === "pickup"
        ? "Odbiór własny — bezpłatnie"
        : "Dostawa — koszt transportu do potwierdzenia";

    const itemText = items
      .map((i) => `${i.title} — ${i.quantity} szt. × ${i.unit_weight_kg} kg`)
      .join("\n");

    const internalText = [
      `NOWE ZAMÓWIENIE ${orderNumber}`,
      "",
      `Klient: ${customer.name}`,
      `E-mail: ${customer.email}`,
      `Telefon: ${customer.phone}`,
      `Kod pocztowy: ${customer.postcode || "-"}`,
      "",
      `Produkt: ${itemText}`,
      `Łączna waga: ${weight_kg} kg`,
      `Wartość pelletu: ${Number(total_pln).toFixed(2)} PLN`,
      `Odbiór: ${fulfilment}`,
      "",
      `Uwagi: ${customer.notes || "-"}`,
    ].join("\n");

    const customerText = [
      `Dziękujemy za złożenie zamówienia ${orderNumber}.`,
      "",
      "Otrzymaliśmy Twoje zamówienie i skontaktujemy się z Tobą w celu potwierdzenia szczegółów realizacji.",
      "",
      "TWOJE ZAMÓWIENIE",
      itemText,
      `Łączna waga: ${weight_kg} kg`,
      `Wartość pelletu: ${Number(total_pln).toFixed(2)} PLN`,
      `Sposób odbioru: ${fulfilment}`,
      "",
      "DANE KLIENTA",
      `Imię i nazwisko: ${customer.name}`,
      `Telefon: ${customer.phone}`,
      `E-mail: ${customer.email}`,
      `Kod pocztowy: ${customer.postcode || "-"}`,
      `Uwagi: ${customer.notes || "-"}`,
      "",
      "Uwaga: koszt dostawy, jeśli wybrano dostawę, zostanie potwierdzony indywidualnie.",
      "",
      "Pozdrawiamy,",
      "Zespół Pellet",
    ].join("\n");

    const customerHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#1b1b18">
        <h1 style="font-weight:500">Dziękujemy za zamówienie</h1>
        <p>Numer zamówienia: <strong>${escapeHtml(orderNumber)}</strong></p>
        <p>Otrzymaliśmy Twoje zamówienie i skontaktujemy się z Tobą w celu potwierdzenia szczegółów realizacji.</p>
        <hr>
        <h2>Twoje zamówienie</h2>
        ${items.map((i) => `<p><strong>${escapeHtml(i.title)}</strong><br>${i.quantity} szt. × ${i.unit_weight_kg} kg</p>`).join("")}
        <p>Łączna waga: <strong>${escapeHtml(weight_kg)} kg</strong><br>
        Wartość pelletu: <strong>${escapeHtml(Number(total_pln).toFixed(2))} PLN</strong><br>
        Sposób odbioru: <strong>${escapeHtml(fulfilment)}</strong></p>
        <h2>Dane klienta</h2>
        <p>${escapeHtml(customer.name)}<br>${escapeHtml(customer.phone)}<br>${escapeHtml(customer.email)}<br>${escapeHtml(customer.postcode || "-")}</p>
        <p>Uwagi: ${escapeHtml(customer.notes || "-")}</p>
        <p style="color:#6f6c63;font-size:12px">Jeśli wybrano dostawę, koszt transportu zostanie potwierdzony indywidualnie.</p>
      </div>
    `;

    // One Resend API call sends the internal order email and customer confirmation.
    console.log("Sending internal order email via Resend to", orderEmail);
    const resend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [orderEmail],
        reply_to: customer.email,
        subject: `[${orderNumber}] Nowe zamówienie pelletu — ${weight_kg} kg`,
        text: internalText,
      }),
    });

    if (!resend.ok) {
      const errorText = await resend.text();
      console.error("Resend internal email failed:", resend.status, errorText);
      return Response.json(
        { error: `Błąd wysyłki e-mail do firmy: ${errorText}` },
        { status: 502 },
      );
    }
    console.log("Internal email sent successfully.");

    console.log(
      "Sending customer confirmation email via Resend to",
      customer.email,
    );
    const customerMail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [customer.email],
        reply_to: orderEmail,
        subject: `Potwierdzenie zamówienia ${orderNumber}`,
        text: customerText,
        html: customerHtml,
      }),
    });

    if (!customerMail.ok) {
      const errorText = await customerMail.text();
      console.error(
        "Resend customer email failed:",
        customerMail.status,
        errorText,
      );
      return Response.json(
        {
          error: `Zamówienie zapisane, ale nie udało się wysłać potwierdzenia do klienta: ${errorText}`,
          order_number: orderNumber,
        },
        { status: 502 },
      );
    }
    console.log("Customer email sent successfully.");

    return Response.json({ ok: true, order_number: orderNumber });
  } catch (error) {
    console.error("Order processing error caught:", error);
    return Response.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
}
