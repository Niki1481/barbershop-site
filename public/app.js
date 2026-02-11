const $ = (id) => document.getElementById(id);

const state = {
  config: null,
  selected: { serviceId: null, barberId: null, date: null, startLocal: null },
};

function setStatus(html, kind = "info") {
  const el = $("statusCard");
  el.hidden = false;
  el.innerHTML = `<div class="${kind}">${html}</div>`;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearStatus() {
  $("statusCard").hidden = true;
  $("statusCard").innerHTML = "";
}

function fmtTimeFromLocal(startLocal) {
  // startLocal: YYYY-MM-DDTHH:mm
  return startLocal.split("T")[1];
}

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function populateSelect(selectEl, items, placeholder) {
  selectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.title;
    selectEl.appendChild(opt);
  }
}

function setPayButtonLabel() {
  const { serviceId, barberId, date, startLocal } = state.selected;
  const btn = $("payBtn");

  if (!serviceId || !barberId || !date) {
    btn.disabled = true;
    btn.textContent = "Выберите услугу, мастера и дату";
    return;
  }
  if (!startLocal) {
    btn.disabled = true;
    btn.textContent = "Выберите время выше";
    return;
  }
  const svc = state.config.services.find(s => s.id === serviceId);
  const brb = state.config.barbers.find(b => b.id === barberId);
  const time = fmtTimeFromLocal(startLocal);
  const price = formatMoney(svc.price_cents / 100, state.config.currency.toUpperCase());
  btn.disabled = false;
  btn.textContent = `Оплатить ${price} и записаться (${brb.name}, ${date} ${time})`;
}

function renderServicesAndBarbers() {
  const cfg = state.config;

  // Services list
  const sEl = $("servicesList");
  if (sEl) {
    sEl.innerHTML = "";
    for (const s of cfg.services) {
      const item = document.createElement("div");
      item.className = "listItem";
      const price = formatMoney(s.price_cents / 100, cfg.currency.toUpperCase());
      item.innerHTML = `
        <div class="liTitle">${s.name}</div>
        <div class="liMeta muted">${s.duration_min} мин · <b>${price}</b></div>
      `;
      sEl.appendChild(item);
    }
  }

  // Barbers list
  const bEl = $("barbersList");
  if (bEl) {
    bEl.innerHTML = "";
    for (const b of cfg.barbers) {
      const card = document.createElement("div");
      card.className = "person";
      const initials = (b.name || "?").split(" ").slice(0,2).map(x => x[0]).join("").toUpperCase();
      const avatar = b.photo_url
        ? `<img class="avatar" alt="${b.name}" src="${b.photo_url}">`
        : `<div class="avatar placeholder">${initials}</div>`;
      card.innerHTML = `
        ${avatar}
        <div>
          <div class="personName">${b.name}</div>
          <div class="muted small">${b.bio || ""}</div>
        </div>
      `;
      bEl.appendChild(card);
    }
  }
}

async function loadConfig() {
  const cfg = await api("/api/config");
  state.config = cfg;

  $("shopName").textContent = cfg.shop_name;
  $("shopName2").textContent = cfg.shop_name;
  $("shopTagline").textContent = cfg.shop_tagline;
  $("shopContacts").innerHTML = cfg.contacts_html || "Добавьте адрес/телефон в настройках.";
  $("year").textContent = new Date().getFullYear();

  populateSelect(
    $("serviceSelect"),
    cfg.services.map(s => ({ id: s.id, title: `${s.name} — ${formatMoney(s.price_cents/100, cfg.currency.toUpperCase())} (${s.duration_min} мин)` })),
    "Выберите услугу"
  );
  populateSelect(
    $("barberSelect"),
    cfg.barbers.map(b => ({ id: b.id, title: b.name })),
    "Выберите мастера"
  );

  // Set date to today by default
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  $("dateInput").value = `${yyyy}-${mm}-${dd}`;

  state.selected.date = $("dateInput").value;

  renderServicesAndBarbers();

  setPayButtonLabel();
}

async function loadSlots() {
  const { serviceId, barberId, date } = state.selected;
  const slotsEl = $("slots");
  slotsEl.innerHTML = "";
  slotsEl.classList.remove("muted");

  if (!serviceId || !barberId || !date) {
    slotsEl.textContent = "Выберите услугу, мастера и дату…";
    slotsEl.classList.add("muted");
    return;
  }

  slotsEl.textContent = "Загружаю слоты…";
  slotsEl.classList.add("muted");

  try {
    const data = await api(`/api/availability?serviceId=${encodeURIComponent(serviceId)}&barberId=${encodeURIComponent(barberId)}&date=${encodeURIComponent(date)}`);
    const slots = data.slots;

    slotsEl.classList.remove("muted");
    slotsEl.innerHTML = "";

    if (!slots.length) {
      slotsEl.textContent = "Нет свободного времени на эту дату. Выберите другую дату.";
      slotsEl.classList.add("muted");
      state.selected.startLocal = null;
      setPayButtonLabel();
      return;
    }

    for (const startLocal of slots) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot";
      btn.textContent = fmtTimeFromLocal(startLocal);
      btn.onclick = () => {
        // toggle active
        for (const child of slotsEl.querySelectorAll(".slot")) child.classList.remove("active");
        btn.classList.add("active");
        state.selected.startLocal = startLocal;
        setPayButtonLabel();
      };
      slotsEl.appendChild(btn);
    }

    // reset selected time
    state.selected.startLocal = null;
    setPayButtonLabel();
  } catch (e) {
    slotsEl.textContent = `Ошибка загрузки слотов: ${e.message}`;
    slotsEl.classList.add("muted");
  }
}

async function waitForBookingConfirmation(bookingId, tries = 15, delayMs = 1500) {
  for (let i = 0; i < tries; i++) {
    try {
      const b = await api(`/api/booking?booking_id=${encodeURIComponent(bookingId)}`);
      if (b.status === "confirmed") return b;
    } catch {
      // ignore
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

function showBookingResult(b) {
  const time = fmtTimeFromLocal(b.start_local);
  setStatus(
    `<h2>Готово ✅</h2>
    <p><b>Запись подтверждена.</b></p>
    <p>Услуга: <b>${b.service_name}</b><br/>
       Мастер: <b>${b.barber_name}</b><br/>
       Дата/время: <b>${b.date} ${time}</b></p>
    <p><b>Код отмены:</b> <code>${b.cancel_token}</code></p>
    <p class="muted small">Сохраните код. Он нужен, чтобы отменить запись на сайте.</p>`,
    "ok"
  );
}

async function onBookSubmit(e) {
  e.preventDefault();
  clearStatus();

  const payload = {
    serviceId: state.selected.serviceId,
    barberId: state.selected.barberId,
    date: state.selected.date,
    startLocal: state.selected.startLocal,
    customer: {
      name: $("nameInput").value.trim(),
      phone: $("phoneInput").value.trim(),
      email: $("emailInput").value.trim() || null,
    },
  };

  try {
    if (!payload.startLocal) throw new Error("Сначала выберите время.");
    if (!window.cp || !window.cp.CloudPayments) {
      throw new Error("Платежный виджет не загрузился. Проверьте интернет/блокировщики.");
    }
    setStatus("Создаю запись и открываю оплату…");
    const r = await api("/api/start-payment", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const widget = new window.cp.CloudPayments();
    widget.pay(
      "charge",
      {
        publicId: r.public_id,
        description: r.description,
        amount: r.amount,
        currency: r.currency,
        invoiceId: r.booking_id,
        accountId: r.account_id,
        email: r.email || undefined,
        data: {
          bookingId: r.booking_id,
          serviceId: payload.serviceId,
          barberId: payload.barberId,
          startLocal: payload.startLocal,
          customerName: payload.customer.name,
          customerPhone: payload.customer.phone,
        },
      },
      {
        onSuccess: async () => {
          setStatus("Оплата прошла. Подтверждаю запись…");
          const b = await waitForBookingConfirmation(r.booking_id);
          if (b) {
            showBookingResult(b);
          } else {
            setStatus(
              `Оплата прошла ✅<br/>` +
              `Но подтверждение еще обрабатывается.<br/>` +
              `Обновите страницу через 10–20 секунд. Ваш код отмены: <code>${r.cancel_token}</code>`,
              "ok"
            );
          }
        },
        onFail: (reason) => {
          const txt = (typeof reason === "string")
            ? reason
            : (reason ? JSON.stringify(reason) : "");
          setStatus(`Оплата не прошла или была отменена.<br/>${txt ? `Причина: ${txt}` : ""}`, "warn");
        },
      }
    );
  } catch (e2) {
    setStatus(`Ошибка: ${e2.message}`, "warn");
  }
}

async function onCancelSubmit(e) {
  e.preventDefault();
  clearStatus();
  try {
    const token = $("cancelTokenInput").value.trim();
    if (!token) throw new Error("Введите код отмены.");
    setStatus("Отменяю запись…");
    const r = await api("/api/cancel", {
      method: "POST",
      body: JSON.stringify({ cancelToken: token }),
    });
    setStatus(`<b>Готово.</b> Статус: ${r.status}.`, "ok");
  } catch (e2) {
    setStatus(`Ошибка отмены: ${e2.message}`, "warn");
  }
}

function bindUI() {
  $("serviceSelect").addEventListener("change", async (e) => {
    state.selected.serviceId = e.target.value || null;
    await loadSlots();
    setPayButtonLabel();
  });

  $("barberSelect").addEventListener("change", async (e) => {
    state.selected.barberId = e.target.value || null;
    await loadSlots();
    setPayButtonLabel();
  });

  $("dateInput").addEventListener("change", async (e) => {
    state.selected.date = e.target.value || null;
    await loadSlots();
    setPayButtonLabel();
  });

  $("bookForm").addEventListener("submit", onBookSubmit);
  $("cancelForm").addEventListener("submit", onCancelSubmit);
}

(async function init() {
  bindUI();
  await loadConfig();
})();
