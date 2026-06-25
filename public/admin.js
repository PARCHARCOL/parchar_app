const businessList = document.querySelector(
  "#admin-business-list"
);
const businessSummary =
  document.querySelector(
    "#admin-business-summary"
  );

const STAFF_SESSION_KEY =
  "parchar_staff_session";
const ADMIN_SOUND_PREF_KEY =
  "parchar_admin_sound_enabled";

const staffLoginSection =
  document.querySelector(
    "#staff-login-section"
  );
const staffLoginForm =
  document.querySelector(
    "#staff-login-form"
  );
const staffLoginMessage =
  document.querySelector(
    "#staff-login-message"
  );
const adminDashboard =
  document.querySelector(
    "#admin-dashboard"
  );
const staffSessionName =
  document.querySelector(
    "#staff-session-name"
  );
const staffSessionRole =
  document.querySelector(
    "#staff-session-role"
  );
const staffLogoutButton =
  document.querySelector(
    "#staff-logout"
  );
const staffPasswordForm =
  document.querySelector(
    "#staff-password-form"
  );
const staffPasswordMessage =
  document.querySelector(
    "#staff-password-message"
  );
const staffCreateForm =
  document.querySelector(
    "#staff-create-form"
  );
const staffCreateMessage =
  document.querySelector(
    "#staff-create-message"
  );
const staffUserList =
  document.querySelector(
    "#staff-user-list"
  );
const refreshStaffUsersButton =
  document.querySelector(
    "#refresh-staff-users"
  );

const tabs = document.querySelectorAll(
  ".admin-tab"
);

const adForm = document.querySelector(
  "#admin-ad-form"
);

const adMessage = document.querySelector(
  "#admin-ad-message"
);

const adPreview = document.querySelector(
  "#admin-ad-preview"
);

const adCreativeType =
  document.querySelector(
    "#admin-ad-creative-type"
  );

const adMediaFields =
  document.querySelectorAll(
    "[data-ad-media-fields]"
  );

const adTemplateFields =
  document.querySelectorAll(
    "[data-ad-template-fields]"
  );

const adCampaignList = document.querySelector(
  "#admin-ad-campaign-list"
);

const refreshAdCampaignsButton =
  document.querySelector(
    "#refresh-ad-campaigns"
  );

const adRequestList = document.querySelector(
  "#admin-ad-request-list"
);

const refreshAdRequestsButton =
  document.querySelector(
    "#refresh-ad-requests"
  );

const reviewModerationList =
  document.querySelector(
    "#admin-review-list"
  );

const refreshReviewModerationButton =
  document.querySelector(
    "#refresh-review-moderation"
  );

const adminAlertStatus =
  document.querySelector(
    "#admin-alert-status"
  );
const adminSoundToggle =
  document.querySelector(
    "#admin-sound-toggle"
  );
const adminAlertCountElements =
  document.querySelectorAll(
    "[data-admin-alert-count]"
  );
const adminAlertCards =
  document.querySelectorAll(
    "[data-admin-alert-card]"
  );

let currentStatus =
  "pendiente";
let staffToken = "";
let currentStaff = null;
let currentBusinesses = [];
let currentAdRequests = [];
let currentStaffUsers = [];
let currentAdCampaigns = [];
let currentReviews = [];
let adminAlertSnapshot = null;
let adminAlertPollTimer = null;
let adminAudioContext = null;
let adminSoundEnabled =
  localStorage.getItem(
    ADMIN_SOUND_PREF_KEY
  ) !== "false";

const ADMIN_ALERT_POLL_MS = 45000;

const BUSINESS_STATUS_LABELS = {
  todos: "Todos",
  pendiente: "Pendientes",
  activo: "Activos",
  pausado: "Pausados",
  rechazado: "Rechazados",
};

function escapeHtml(value) {

  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getAdTemplateStyle(value) {
  const normalized = String(
    value || ""
  ).toLowerCase();
  return [
    "spotlight",
    "slide",
    "premium",
    "food",
    "event",
  ].includes(normalized)
    ? normalized
    : "spotlight";
}

function getAdAccentColor(value) {
  const raw = String(value || "");
  return /^#[0-9a-f]{6}$/i.test(raw)
    ? raw
    : "#ff8d38";
}

function isTemplateCampaign(item) {
  return (
    item?.creativeType === "template"
  );
}

function renderTemplatePreview(item) {
  const style = getAdTemplateStyle(
    item?.templateStyle
  );
  const accent = getAdAccentColor(
    item?.accentColor
  );
  const logo = item?.logoPath || "";
  const product =
    item?.productPath || logo;
  const templateTitle =
    item?.title &&
    String(item.title).toLowerCase() !==
      "publicidad"
      ? item.title
      : "Oferta";

  return `
    <div class="ad-template ad-template-${style} admin-template-preview" style="--ad-accent: ${escapeHtml(
      accent
    )}">
      <div class="ad-template-glow"></div>
      ${
        product
          ? `<img class="ad-template-bg" src="${escapeHtml(
              product
            )}" alt="" />`
          : ""
      }
      <div class="ad-template-layout">
        <div class="ad-template-logo-zone">
          ${
            logo
              ? `<img class="ad-template-logo" src="${escapeHtml(
                  logo
                )}" alt="Logo" />`
              : ""
          }
        </div>
        <div class="ad-template-copy">
          <span>${escapeHtml(
            item?.advertiserName ||
              "Anunciante"
          )}</span>
          <strong>${escapeHtml(
            templateTitle
          )}</strong>
          <em>${escapeHtml(
            item?.message ||
              "Promocion activa en Parchar"
          )}</em>
        </div>
        <div class="ad-template-product-zone">
          ${
            item?.productPath
              ? `<img class="ad-template-product" src="${escapeHtml(
                  item.productPath
                )}" alt="Producto" />`
              : ""
          }
        </div>
      </div>
      <div class="ad-template-ribbon"></div>
    </div>
  `;
}

function setFeedback(
  element,
  message,
  isError = false
) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle(
    "error",
    isError
  );
  element.classList.toggle(
    "success",
    Boolean(message) && !isError
  );
}

function getOpenAdRequests() {
  return currentAdRequests.filter(
    (item) =>
      item.status !== "contactado"
  );
}

function getPendingBusinesses() {
  return currentBusinesses.filter(
    (item) =>
      item.status === "pendiente"
  );
}

function getActiveReviews() {
  return currentReviews.filter(
    (item) =>
      item.status === "activa"
  );
}

function getMaxNumericId(items) {
  return (items || []).reduce(
    (max, item) =>
      Math.max(
        max,
        Number(item.id) || 0
      ),
    0
  );
}

function getLatestReportMarker(items) {
  return (items || []).reduce(
    (latest, item) => {
      if (
        Number(item.report_count || 0) <=
        0
      ) {
        return latest;
      }

      const reportDate =
        item.latest_report_at || "";
      return reportDate > latest
        ? reportDate
        : latest;
    },
    ""
  );
}

function getAdminAlertSnapshot() {
  const pendingBusinesses =
    getPendingBusinesses();
  const openAdRequests =
    getOpenAdRequests();
  const activeReviews =
    getActiveReviews();
  const reportCount =
    currentReviews.reduce(
      (total, item) =>
        total +
        Number(
          item.report_count || 0
        ),
      0
    );

  return {
    counts: {
      businesses:
        pendingBusinesses.length,
      adRequests:
        openAdRequests.length,
      reviews:
        activeReviews.length,
      reports: reportCount,
    },
    markers: {
      businesses:
        getMaxNumericId(
          pendingBusinesses
        ),
      adRequests:
        getMaxNumericId(
          openAdRequests
        ),
      reviews:
        getMaxNumericId(
          activeReviews
        ),
      reports:
        `${reportCount}:${getLatestReportMarker(
          currentReviews
        )}`,
    },
  };
}

function hasNewAdminAlert(
  previous,
  next
) {
  if (!previous || !next) {
    return false;
  }

  return Object.keys(next.counts).some(
    (key) => {
      const previousCount =
        previous.counts[key] || 0;
      const nextCount =
        next.counts[key] || 0;

      if (nextCount > previousCount) {
        return true;
      }

      return (
        nextCount > 0 &&
        nextCount >= previousCount &&
        next.markers[key] &&
        next.markers[key] !==
          previous.markers[key]
      );
    }
  );
}

function setAdminAlertStatus(message) {
  if (!adminAlertStatus) {
    return;
  }

  adminAlertStatus.textContent =
    message;
}

function updateAdminSoundButton() {
  if (!adminSoundToggle) {
    return;
  }

  adminSoundToggle.textContent =
    adminSoundEnabled
      ? "Sonido activo"
      : "Sonido apagado";
  adminSoundToggle.classList.toggle(
    "is-muted",
    !adminSoundEnabled
  );
}

function renderAdminAlertCenter(
  snapshot
) {
  const counts =
    snapshot?.counts || {};

  adminAlertCountElements.forEach(
    (element) => {
      const key =
        element.dataset
          .adminAlertCount;
      element.textContent = String(
        counts[key] || 0
      );
      element.classList.toggle(
        "has-alert",
        Number(counts[key] || 0) > 0
      );
    }
  );

  adminAlertCards.forEach((card) => {
    const key =
      card.dataset.adminAlertCard;
    card.classList.toggle(
      "has-alert",
      Number(counts[key] || 0) > 0
    );
  });

  const total =
    Number(counts.businesses || 0) +
    Number(counts.adRequests || 0) +
    Number(counts.reviews || 0) +
    Number(counts.reports || 0);

  document.title =
    total > 0
      ? `(${total}) Admin | Parchar`
      : "Admin | Parchar";
}

function updateAdminAlertCenter({
  notify = true,
} = {}) {
  const nextSnapshot =
    getAdminAlertSnapshot();
  const shouldNotify =
    notify &&
    hasNewAdminAlert(
      adminAlertSnapshot,
      nextSnapshot
    );

  renderAdminAlertCenter(
    nextSnapshot
  );
  adminAlertSnapshot =
    nextSnapshot;

  const counts =
    nextSnapshot.counts;
  const total =
    Number(counts.businesses || 0) +
    Number(counts.adRequests || 0) +
    Number(counts.reviews || 0) +
    Number(counts.reports || 0);

  setAdminAlertStatus(
    total > 0
      ? "Hay novedades pendientes por revisar."
      : "Sin novedades pendientes."
  );

  if (shouldNotify) {
    setAdminAlertStatus(
      "Nueva solicitud recibida. Revisa los avisos marcados."
    );
    playAdminNotificationSound();
  }
}

function getAdminAudioContext() {
  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!adminAudioContext) {
    adminAudioContext =
      new AudioContextClass();
  }

  return adminAudioContext;
}

async function primeAdminSound() {
  if (!adminSoundEnabled) {
    return;
  }

  const audioContext =
    getAdminAudioContext();

  if (
    audioContext?.state ===
    "suspended"
  ) {
    try {
      await audioContext.resume();
    } catch {
      // El navegador puede bloquear sonido hasta un toque del usuario.
    }
  }
}

async function playAdminNotificationSound() {
  if (!adminSoundEnabled) {
    return;
  }

  const audioContext =
    getAdminAudioContext();

  if (!audioContext) {
    return;
  }

  try {
    if (
      audioContext.state ===
      "suspended"
    ) {
      await audioContext.resume();
    }

    const now =
      audioContext.currentTime;
    [0, 0.18].forEach(
      (offset, index) => {
        const oscillator =
          audioContext.createOscillator();
        const gain =
          audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value =
          index === 0 ? 880 : 1175;
        gain.gain.setValueAtTime(
          0.0001,
          now + offset
        );
        gain.gain.exponentialRampToValueAtTime(
          0.08,
          now + offset + 0.02
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + offset + 0.13
        );

        oscillator.connect(gain);
        gain.connect(
          audioContext.destination
        );
        oscillator.start(
          now + offset
        );
        oscillator.stop(
          now + offset + 0.14
        );
      }
    );
  } catch {
    setAdminAlertStatus(
      "Toca Sonido activo para permitir la notificacion sonora."
    );
  }
}

function stopAdminAlertPolling() {
  if (adminAlertPollTimer) {
    clearInterval(
      adminAlertPollTimer
    );
    adminAlertPollTimer = null;
  }
}

function startAdminAlertPolling() {
  stopAdminAlertPolling();

  adminAlertPollTimer =
    setInterval(() => {
      if (
        !staffToken ||
        adminDashboard?.hidden
      ) {
        return;
      }

      loadDashboardData({
        notify: true,
      });
    }, ADMIN_ALERT_POLL_MS);
}

function saveStaffSession(
  token,
  staff
) {
  localStorage.setItem(
    STAFF_SESSION_KEY,
    JSON.stringify({
      token,
      staff,
    })
  );
}

function loadStaffSession() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(
        STAFF_SESSION_KEY
      ) || "{}"
    );

    if (!parsed.token || !parsed.staff) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function clearStaffSession() {
  localStorage.removeItem(
    STAFF_SESSION_KEY
  );
  staffToken = "";
  currentStaff = null;
}

function isAdmin() {
  return currentStaff?.role === "admin";
}

function showStaffLogin(
  message = "",
  isError = false
) {
  stopAdminAlertPolling();
  document.title =
    "Admin | Parchar";

  if (staffLoginSection) {
    staffLoginSection.hidden = false;
  }

  if (adminDashboard) {
    adminDashboard.hidden = true;
  }

  setFeedback(
    staffLoginMessage,
    message,
    isError
  );
}

function showAdminDashboard() {
  if (staffLoginSection) {
    staffLoginSection.hidden = true;
  }

  if (adminDashboard) {
    adminDashboard.hidden = false;
  }

  if (staffSessionName) {
    staffSessionName.textContent =
      currentStaff?.displayName ||
      currentStaff?.username ||
      "Personal Parchar";
  }

  if (staffSessionRole) {
    staffSessionRole.textContent =
      currentStaff?.role || "";
    staffSessionRole.className =
      `status-pill staff-role-${currentStaff?.role || ""}`;
  }

  document
    .querySelectorAll(".admin-only")
    .forEach((element) => {
      element.hidden = !isAdmin();
    });

  updateAdminSoundButton();
  setDefaultCampaignDates();
  syncAdCreativeFields();
}

async function staffFetch(
  url,
  options = {}
) {
  const headers = new Headers(
    options.headers || {}
  );

  if (staffToken) {
    headers.set(
      "Authorization",
      `Bearer ${staffToken}`
    );
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (
    response.status === 401 &&
    !url.endsWith("/api/staff/login")
  ) {
    clearStaffSession();
    showStaffLogin(
      "Tu sesion vencio. Inicia sesion nuevamente.",
      true
    );
  }

  return response;
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    "es-CO",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

function formatDateInput(date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function setDefaultCampaignDates() {
  if (!adForm) {
    return;
  }

  const today = new Date();
  const endDate = new Date();
  endDate.setDate(
    today.getDate() + 7
  );

  if (
    adForm.elements.startDate &&
    !adForm.elements.startDate.value
  ) {
    adForm.elements.startDate.value =
      formatDateInput(today);
  }

  if (
    adForm.elements.endDate &&
    !adForm.elements.endDate.value
  ) {
    adForm.elements.endDate.value =
      formatDateInput(endDate);
  }
}

function syncAdCreativeFields() {
  if (!adForm || !adCreativeType) {
    return;
  }

  const isTemplate =
    adCreativeType.value ===
    "template";

  adMediaFields.forEach(
    (element) => {
      element.hidden = isTemplate;
    }
  );
  adTemplateFields.forEach(
    (element) => {
      element.hidden = !isTemplate;
    }
  );

  if (adForm.elements.media) {
    adForm.elements.media.required =
      !isTemplate;
  }
  if (adForm.elements.logo) {
    adForm.elements.logo.required =
      isTemplate;
  }
}

tabs.forEach((tab) => {

  tab.addEventListener(
    "click",
    () => {

      tabs.forEach((t) =>
        t.classList.remove(
          "active"
        )
      );

      tab.classList.add(
        "active"
      );

      currentStatus =
        tab.dataset.status;

      loadBusinesses();
    }
  );
});

async function approveBusiness(id) {

  try {

    const response = await staffFetch(
      `/api/admin/businesses/${id}/approve`,
      {
        method: "POST",
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "No se pudo aprobar"
      );
    }

    alert(
      "✅ Negocio activado"
    );

    loadBusinesses();

  } catch (error) {

    alert(error.message);
  }
}

async function pauseBusiness(id) {

  try {

    const response = await staffFetch(
      `/api/admin/businesses/${id}/pause`,
      {
        method: "POST",
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "No se pudo pausar"
      );
    }

    alert(
      "⏸️ Negocio pausado"
    );

    loadBusinesses();

  } catch (error) {

    alert(error.message);
  }
}

async function activateBusiness(id) {

  try {

    const response = await staffFetch(
      `/api/admin/businesses/${id}/activate`,
      {
        method: "POST",
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "No se pudo activar"
      );
    }

    alert(
      "✅ Negocio activado"
    );

    loadBusinesses();

  } catch (error) {

    alert(error.message);
  }
}

async function rejectBusiness(id) {

  const reason = prompt(
    "Escribe el motivo del rechazo:"
  );

  if (!reason) {

    return;
  }

  try {

    const response = await staffFetch(
      `/api/admin/businesses/${id}/reject`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          reason,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "No se pudo rechazar"
      );
    }

    alert(
      "❌ Negocio rechazado"
    );

    loadBusinesses();

  } catch (error) {

    alert(error.message);
  }
}

async function deleteBusiness(id) {

  const confirmed = confirm(
    "Eliminar negocio definitivamente?"
  );

  if (!confirmed) {

    return;
  }

  try {

    const response = await staffFetch(
      `/api/admin/businesses/${id}/delete`,
      {
        method: "POST",
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "No se pudo eliminar"
      );
    }

    alert(
      "🗑️ Negocio eliminado"
    );

    loadBusinesses();

  } catch (error) {

    alert(error.message);
  }
}

async function editBusiness(id) {

  const businessName = prompt(
    "Nuevo nombre negocio:"
  );

  if (!businessName) {

    return;
  }

  try {

    const response = await staffFetch(
      `/api/admin/businesses/${id}/edit`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          businessName,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "No se pudo editar"
      );
    }

    alert(
      "✏️ Negocio actualizado"
    );

    loadBusinesses();

  } catch (error) {

    alert(error.message);
  }
}

function renderActionButtons(item) {
  if (
    item.status ===
    "pendiente"
  ) {

    return `
      <button
        class="submit-btn"
        onclick="approveBusiness(${item.id})"
      >
        Aprobar
      </button>

      <button
        class="ghost-btn"
        onclick="rejectBusiness(${item.id})"
      >
        Rechazar
      </button>
    `;
  }

  if (!isAdmin()) {
    return "";
  }

  if (
    item.status ===
    "activo"
  ) {

    return `
      <button
        class="submit-btn"
        onclick="pauseBusiness(${item.id})"
      >
        Pausar
      </button>

      <button
        class="ghost-btn"
        onclick="editBusiness(${item.id})"
      >
        Editar
      </button>

      <button
        class="ghost-btn"
        onclick="deleteBusiness(${item.id})"
      >
        Eliminar
      </button>
    `;
  }

  if (
    item.status ===
    "pausado"
  ) {

    return `
      <button
        class="submit-btn"
        onclick="activateBusiness(${item.id})"
      >
        Activar
      </button>

      <button
        class="ghost-btn"
        onclick="deleteBusiness(${item.id})"
      >
        Eliminar
      </button>
    `;
  }

  if (
    item.status ===
    "rechazado"
  ) {

    return `
      <button
        class="ghost-btn"
        onclick="deleteBusiness(${item.id})"
      >
        Eliminar
      </button>
    `;
  }

  return "";
}

function renderBusinesses(items) {
  currentBusinesses =
    items || [];

  renderBusinessSummary(
    currentBusinesses
  );

  const filtered =
    (
      items || []
    ).filter(
      (item) =>
        currentStatus ===
          "todos" ||
        item.status ===
          currentStatus
    );

  if (!filtered.length) {
    const total =
      (items || []).length;
    const label =
      BUSINESS_STATUS_LABELS[
        currentStatus
      ] || currentStatus;

    businessList.innerHTML = `
      <div class="glass-card">

        <h3>
          No hay negocios en ${escapeHtml(
            label.toLowerCase()
          )}
        </h3>

        <p>
          Total registrados en la base actual: ${escapeHtml(
            total
          )}
        </p>

        <p class="tiny">
          Si el cliente dice que lo creo y no aparece aqui, probablemente no termino el envio, esta usando cache vieja de la app, o lo registro antes del cambio a Neon.
        </p>

      </div>
    `;

    return;
  }

  businessList.innerHTML =
    filtered
      .map(
        (item) => `

      <article class="glass-card admin-card">

        <h3>
          ${escapeHtml(
            item.business_name
          )}
        </h3>

        <p>
          <strong>Estado:</strong>
          ${escapeHtml(
            item.status
          )}
        </p>

        <p>
          <strong>Dueño:</strong>
          ${escapeHtml(
            item.owner_name
          )}
        </p>

        ${
          item.reviewed_by
            ? `
        <p>
          <strong>Revisado por:</strong>
          ${escapeHtml(
            item.reviewed_by
          )}
        </p>

        <p class="tiny">
          ${escapeHtml(
            item.review_note ||
              "Revision registrada"
          )} ${escapeHtml(
              item.reviewed_at
                ? `- ${formatDateTime(
                    item.reviewed_at
                  )}`
                : ""
            )}
        </p>
        `
            : ""
        }

        <p>
          <strong>Telefono:</strong>
          ${escapeHtml(
            item.owner_phone
          )}
        </p>

        <p>
          <strong>Ciudad:</strong>
          ${escapeHtml(
            item.city
          )}
        </p>

        <p>
          <strong>Categoria:</strong>
          ${escapeHtml(
            item.category
          )}
        </p>

        <p>
          ${escapeHtml(
            item.description
          )}
        </p>

        ${
          item.video_path
            ? `
          <video
            controls
            class="admin-video"
            style="
              width:100%;
              border-radius:12px;
              margin-top:10px;
            "
          >
            <source
              src="${item.video_path}"
              type="video/mp4"
            />
          </video>
        `
            : `
          <p>
            ❌ Sin video
          </p>
        `
        }

        <div
          style="
            margin-top:10px;
            display:flex;
            gap:10px;
            flex-wrap:wrap;
          "
        >

          ${
            item.rut_document
              ? `
            <button
              type="button"
              class="ghost-btn"
              onclick="downloadBusinessDocument(${Number(
                item.id
              )}, 'rut')"
            >
              Descargar RUT
            </button>
          `
              : ""
          }

          ${
            item.commerce_document
              ? `
            <button
              type="button"
              class="ghost-btn"
              onclick="downloadBusinessDocument(${Number(
                item.id
              )}, 'commerce')"
            >
              Descargar Camara Comercio
            </button>
          `
              : ""
          }

        </div>

        <div
          class="admin-actions"
          style="
            margin-top:15px;
            display:flex;
            gap:10px;
            flex-wrap:wrap;
          "
        >

          ${renderActionButtons(
            item
          )}

        </div>

      </article>
    `
      )
      .join("");
}

function countBusinessesByStatus(
  items
) {
  return (items || []).reduce(
    (acc, item) => {
      const status =
        item.status ||
        "sin_estado";
      acc[status] =
        (acc[status] || 0) + 1;
      acc.todos =
        (acc.todos || 0) + 1;
      return acc;
    },
    { todos: 0 }
  );
}

function renderBusinessSummary(
  items
) {
  if (!businessSummary) {
    return;
  }

  const counts =
    countBusinessesByStatus(
      items
    );

  tabs.forEach((tab) => {
    const status =
      tab.dataset.status;
    const label =
      BUSINESS_STATUS_LABELS[
        status
      ] || status;

    tab.textContent = `${label} (${
      counts[status] || 0
    })`;
  });

  const latest = (items || [])
    .slice(0, 5)
    .map(
      (item) => `
        <li>
          <strong>${escapeHtml(
            item.business_name
          )}</strong>
          <span class="status-pill status-${escapeHtml(
            item.status
          )}">${escapeHtml(
            item.status ||
              "sin estado"
          )}</span>
          <small>${escapeHtml(
            item.created_at
              ? formatDateTime(
                  item.created_at
                )
              : ""
          )}</small>
        </li>
      `
    )
    .join("");

  businessSummary.innerHTML = `
    <div class="business-counts">
      ${Object.entries(
        BUSINESS_STATUS_LABELS
      )
        .map(
          ([status, label]) => `
          <span>
            ${escapeHtml(label)}:
            <strong>${escapeHtml(
              counts[status] || 0
            )}</strong>
          </span>
        `
        )
        .join("")}
    </div>

    <div class="latest-businesses">
      <strong>Ultimos recibidos</strong>
      ${
        latest
          ? `<ul>${latest}</ul>`
          : `<p class="tiny">No hay locales registrados en esta base.</p>`
      }
    </div>
  `;
}

function renderAdPreview(banner) {
  if (!adPreview) {
    return;
  }

  if (isTemplateCampaign(banner)) {
    adPreview.innerHTML = `
      <strong>Banner animado creado</strong>
      ${renderTemplatePreview(banner)}
      <p class="tiny">
        Esta pieza se adapta al ancho del banner y se anima sin audio.
      </p>
    `;
    adPreview.hidden = false;
    return;
  }

  if (!banner?.mediaPath) {
    adPreview.hidden = true;
    adPreview.innerHTML = "";
    return;
  }

  const media = String(
    banner.mediaType || ""
  ).startsWith("video/")
    ? `
      <video controls preload="metadata" src="${escapeHtml(
        banner.mediaPath
      )}"></video>
    `
    : `
      <img src="${escapeHtml(
        banner.mediaPath
      )}" alt="Publicidad actual" />
    `;

  adPreview.innerHTML = `
    <strong>Archivo publicado</strong>
    ${media}
    <p class="tiny">
      En la app publica el banner se reproduce sin audio y no bloquea la navegacion.
    </p>
  `;
  adPreview.hidden = false;
}

function campaignStatusLabel(value) {
  const labels = {
    activa: "activa",
    pausada: "pausada",
    programada: "programada",
    vencida: "vencida",
  };

  return labels[value] || value || "";
}

function getFilenameFromDisposition(
  disposition,
  fallback
) {
  const match = String(
    disposition || ""
  ).match(
    /filename\*?=(?:UTF-8''|")?([^";]+)/i
  );

  if (!match) {
    return fallback;
  }

  try {
    return decodeURIComponent(
      match[1].replaceAll('"', "")
    );
  } catch {
    return match[1].replaceAll(
      '"',
      ""
    );
  }
}

async function downloadBusinessDocument(
  id,
  type
) {
  try {
    const response = await staffFetch(
      `/api/admin/businesses/${Number(
        id
      )}/document/${type}`
    );

    if (!response.ok) {
      let errorMessage =
        "No se pudo descargar el documento.";
      try {
        const data =
          await response.json();
        errorMessage =
          data.error || errorMessage;
      } catch {
        // no-op
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const filename =
      getFilenameFromDisposition(
        response.headers.get(
          "Content-Disposition"
        ),
        type === "commerce"
          ? "camara-comercio.pdf"
          : "rut.pdf"
      );
    const url =
      URL.createObjectURL(blob);
    const link =
      document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(
      () => URL.revokeObjectURL(url),
      30000
    );
  } catch (error) {
    alert(error.message);
  }
}

function renderAdCampaigns(items) {
  if (!adCampaignList) {
    return;
  }

  currentAdCampaigns = items || [];

  if (!currentAdCampaigns.length) {
    adCampaignList.innerHTML = `
      <div class="glass-card">
        <h3>No hay campanas publicitarias</h3>
      </div>
    `;
    return;
  }

  adCampaignList.innerHTML =
    currentAdCampaigns
      .map((item) => {
        const status =
          item.computedStatus ||
          item.status;
        const canActivate =
          status !== "activa" &&
          status !== "vencida";
        const canPause =
          item.status === "activa";
        const impressions = Number(
          item.impressions || 0
        );
        const clicks = Number(
          item.clicks || 0
        );
        const ctr =
          impressions > 0
            ? (
                (clicks / impressions) *
                100
              ).toFixed(2)
            : "0.00";
        const media = isTemplateCampaign(
          item
        )
          ? renderTemplatePreview(item)
          : String(
              item.mediaType || ""
            ).startsWith("video/")
          ? `
            <video controls preload="metadata" src="${escapeHtml(
              item.mediaPath
            )}"></video>
          `
          : `
            <img src="${escapeHtml(
              item.mediaPath
            )}" alt="${escapeHtml(
              item.advertiserName
            )}" />
          `;

        return `
          <article class="glass-card admin-card ad-campaign-card">
            <div class="mini-business-head">
              <h3>${escapeHtml(
                item.advertiserName
              )}</h3>
              <span class="status-pill status-${escapeHtml(
                status
              )}">
                ${escapeHtml(
                  campaignStatusLabel(
                    status
                  )
                )}
              </span>
            </div>

            <p><strong>${escapeHtml(
              item.title
            )}:</strong> ${escapeHtml(
              item.message
            )}</p>

            <p class="tiny">
              ${escapeHtml(
                item.startDate
              )} a ${escapeHtml(
                item.endDate
              )} - Prioridad ${escapeHtml(
                item.priority
              )} - ${
                isTemplateCampaign(item)
                  ? "Banner animado"
                  : "Archivo"
              }
            </p>

            <div class="priority-editor">
              <label>
                Prioridad comercial
                <select data-ad-priority="${Number(
                  item.id
                )}">
                  ${Array.from(
                    { length: 10 },
                    (_, index) => {
                      const value =
                        index + 1;
                      return `
                        <option value="${value}" ${
                        Number(
                          item.priority
                        ) === value
                          ? "selected"
                          : ""
                      }>
                          ${value}
                        </option>
                      `;
                    }
                  ).join("")}
                </select>
              </label>
              <button
                class="ghost-btn"
                onclick="saveAdCampaignPriority(${Number(
                  item.id
                )})"
              >
                Guardar prioridad
              </button>
            </div>

            <div class="ad-report-strip">
              <div>
                <span>Vistas</span>
                <strong>${escapeHtml(
                  impressions
                )}</strong>
              </div>
              <div>
                <span>Clics</span>
                <strong>${escapeHtml(
                  clicks
                )}</strong>
              </div>
              <div>
                <span>CTR</span>
                <strong>${escapeHtml(
                  `${ctr}%`
                )}</strong>
              </div>
            </div>

            <div class="ad-preview ad-campaign-media">
              ${media}
            </div>

            <div class="request-actions">
              ${
                canActivate
                  ? `
                    <button class="submit-btn" onclick="setAdCampaignStatus(${Number(
                      item.id
                    )}, 'activa')">
                      Activar
                    </button>
                  `
                  : ""
              }
              ${
                canPause
                  ? `
                    <button class="ghost-btn" onclick="setAdCampaignStatus(${Number(
                      item.id
                    )}, 'pausada')">
                      Pausar
                    </button>
                  `
                  : ""
              }
              <button class="ghost-btn" onclick="deleteAdCampaign(${Number(
                item.id
              )})">
                Eliminar
              </button>
              <button class="ghost-btn" onclick="copyAdCampaignReport(${Number(
                item.id
              )})">
                Copiar reporte
              </button>
            </div>
          </article>
        `;
      })
      .join("");
}

async function loadAdCampaigns() {
  if (
    !adCampaignList ||
    !isAdmin()
  ) {
    return;
  }

  try {
    const response = await staffFetch(
      "/api/admin/ad-campaigns"
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Error cargando campanas"
      );
    }

    renderAdCampaigns(
      data.items || []
    );
  } catch (error) {
    adCampaignList.innerHTML = `
      <div class="glass-card">
        <h3>Error</h3>
        <p>${escapeHtml(
          error.message
        )}</p>
      </div>
    `;
  }
}

async function saveAdCampaign(event) {
  event.preventDefault();

  setFeedback(
    adMessage,
    "Creando campana..."
  );

  const formData = new FormData(
    adForm
  );
  formData.set(
    "status",
    adForm.elements.enabled.checked
      ? "activa"
      : "pausada"
  );

  try {
    const response = await staffFetch(
      "/api/admin/ad-campaigns",
      {
        method: "POST",
        body: formData,
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo crear la campana"
      );
    }

    adForm.reset();
    adForm.elements.enabled.checked = true;
    adForm.elements.title.value =
      "Publicidad";
    adForm.elements.ctaLabel.value =
      "Ver oferta";
    adForm.elements.priority.value =
      "1";
    if (adForm.elements.creativeType) {
      adForm.elements.creativeType.value =
        "media";
    }
    if (adForm.elements.accentColor) {
      adForm.elements.accentColor.value =
        "#ff8d38";
    }
    setDefaultCampaignDates();
    syncAdCreativeFields();
    if (adPreview) {
      adPreview.hidden = true;
      adPreview.innerHTML = "";
    }

    setFeedback(
      adMessage,
      "Campana creada. Se mostrara cuando este activa y dentro de fecha."
    );
    await loadAdCampaigns();
  } catch (error) {
    setFeedback(
      adMessage,
      error.message,
      true
    );
  }
}

async function setAdCampaignStatus(
  id,
  status
) {
  try {
    const response = await staffFetch(
      `/api/admin/ad-campaigns/${id}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          status,
        }),
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo actualizar la campana"
      );
    }

    await loadAdCampaigns();
  } catch (error) {
    alert(error.message);
  }
}

async function saveAdCampaignPriority(
  id
) {
  const input =
    document.querySelector(
      `[data-ad-priority="${id}"]`
    );
  const priority = Number(
    input?.value || 1
  );

  if (
    !Number.isFinite(priority) ||
    priority < 1 ||
    priority > 10
  ) {
    alert(
      "La prioridad debe estar entre 1 y 10."
    );
    return;
  }

  try {
    const response = await staffFetch(
      `/api/admin/ad-campaigns/${id}/priority`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          priority,
        }),
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo actualizar la prioridad"
      );
    }

    await loadAdCampaigns();
  } catch (error) {
    alert(error.message);
  }
}

async function copyAdCampaignReport(id) {
  const campaign =
    currentAdCampaigns.find(
      (item) =>
        Number(item.id) ===
        Number(id)
    );

  if (!campaign) {
    alert(
      "No se encontro la campana."
    );
    return;
  }

  const impressions = Number(
    campaign.impressions || 0
  );
  const clicks = Number(
    campaign.clicks || 0
  );
  const ctr =
    impressions > 0
      ? (
          (clicks / impressions) *
          100
        ).toFixed(2)
      : "0.00";
  const status =
    campaignStatusLabel(
      campaign.computedStatus ||
        campaign.status
    );
  const report = [
    `Reporte de pauta - ${campaign.advertiserName || "Cliente"}`,
    `Campana: ${campaign.title || "Publicidad"}`,
    `Periodo: ${campaign.startDate || "-"} a ${campaign.endDate || "-"}`,
    `Estado: ${status}`,
    `Prioridad comercial: ${campaign.priority}`,
    `Vistas: ${impressions}`,
    `Clics: ${clicks}`,
    `CTR: ${ctr}%`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(
      report
    );
    alert(
      "Reporte copiado."
    );
  } catch {
    window.prompt(
      "Copia el reporte:",
      report
    );
  }
}

async function deleteAdCampaign(id) {
  if (
    !window.confirm(
      "Quieres eliminar esta campana?"
    )
  ) {
    return;
  }

  try {
    const response = await staffFetch(
      `/api/admin/ad-campaigns/${id}/delete`,
      {
        method: "POST",
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo eliminar la campana"
      );
    }

    await loadAdCampaigns();
  } catch (error) {
    alert(error.message);
  }
}

function renderAdRequests(items) {
  if (!adRequestList) {
    return;
  }

  currentAdRequests = items || [];

  if (!items.length) {
    adRequestList.innerHTML = `
      <div class="glass-card">
        <h3>No hay solicitudes de pauta</h3>
      </div>
    `;
    return;
  }

  adRequestList.innerHTML =
    items
      .map(
        (item) => {
          const phone = String(
            item.phone || ""
          ).replace(/[^0-9]/g, "");
          const whatsappPhone =
            phone.length === 10
              ? `57${phone}`
              : phone;
          const whatsappUrl = whatsappPhone
            ? `https://wa.me/${whatsappPhone}`
            : "";
          const emailUrl = item.email
            ? `mailto:${encodeURIComponent(
                item.email
              )}`
            : "";

          return `
            <article class="glass-card admin-card ad-request-card">
              <div class="mini-business-head">
                <h3>${escapeHtml(
                  item.business_name
                )}</h3>
                <span class="status-pill status-${escapeHtml(
                  item.status
                )}">${escapeHtml(
                  item.status
                )}</span>
              </div>

              <p><strong>Contacto:</strong> ${escapeHtml(
                item.full_name
              )}</p>
              <p><strong>Telefono:</strong> ${escapeHtml(
                item.phone || "No enviado"
              )}</p>
              <p><strong>Correo:</strong> ${escapeHtml(
                item.email || "No enviado"
              )}</p>
              <p><strong>Mensaje:</strong> ${escapeHtml(
                item.message
              )}</p>

              <p class="tiny">
                Solicitud: ${escapeHtml(
                  formatDateTime(
                    item.created_at
                  )
                )}
              </p>

              ${
                item.contacted_by
                  ? `
                    <p class="tiny">
                      Contactado por ${escapeHtml(
                        item.contacted_by
                      )} el ${escapeHtml(
                        formatDateTime(
                          item.contacted_at
                        )
                      )}
                    </p>
                  `
                  : ""
              }

              <div class="request-actions">
                ${
                  whatsappUrl
                    ? `<a class="ghost-btn" href="${escapeHtml(
                        whatsappUrl
                      )}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
                    : ""
                }
                ${
                  emailUrl
                    ? `<a class="ghost-btn" href="${escapeHtml(
                        emailUrl
                      )}">Correo</a>`
                    : ""
                }
                ${
                  item.status === "contactado"
                    ? ""
                    : `
                      <button class="submit-btn" onclick="resolveAdRequest(${item.id})">
                        Marcar contactado
                      </button>
                    `
                }
                ${
                  isAdmin()
                    ? `
                      <button class="ghost-btn" onclick="prepareAdFromRequest(${item.id})">
                        Preparar publicidad
                      </button>
                    `
                    : ""
                }
              </div>
            </article>
          `;
        }
      )
      .join("");
}

function prepareAdFromRequest(id) {
  if (!isAdmin() || !adForm) {
    return;
  }

  const request =
    currentAdRequests.find(
      (item) =>
        Number(item.id) === Number(id)
    );

  if (!request) {
    return;
  }

  adForm.elements.advertiserName.value =
    request.business_name || "";
  adForm.elements.message.value =
    `Conoce ${request.business_name} en Parchar.`;
  adForm.elements.enabled.checked = true;
  adForm.elements.title.value =
    "Publicidad";
  adForm.elements.ctaLabel.value =
    "Ver oferta";
  adForm.elements.priority.value =
    "1";
  if (adForm.elements.creativeType) {
    adForm.elements.creativeType.value =
      "media";
  }
  if (adForm.elements.accentColor) {
    adForm.elements.accentColor.value =
      "#ff8d38";
  }
  setDefaultCampaignDates();
  syncAdCreativeFields();
  adForm.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  adForm.elements.targetUrl.focus();
  setFeedback(
    adMessage,
    "Solicitud cargada. Agrega enlace si tiene y sube archivo o crea banner animado."
  );
}

async function loadAdRequests({
  notify = true,
  updateAlerts = true,
} = {}) {
  if (!adRequestList) {
    return;
  }

  try {
    const response = await staffFetch(
      "/api/admin/ad-requests"
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Error cargando solicitudes"
      );
    }

    renderAdRequests(
      data.items || []
    );
    if (updateAlerts) {
      updateAdminAlertCenter({
        notify,
      });
    }
  } catch (error) {
    adRequestList.innerHTML = `
      <div class="glass-card">
        <h3>Error</h3>
        <p>${escapeHtml(
          error.message
        )}</p>
      </div>
    `;
  }
}

async function resolveAdRequest(id) {
  try {
    const response = await staffFetch(
      `/api/admin/ad-requests/${id}/resolve`,
      {
        method: "POST",
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo actualizar la solicitud"
      );
    }

    loadAdRequests();
  } catch (error) {
    alert(error.message);
  }
}

function renderReviewModeration(items) {
  if (!reviewModerationList) {
    return;
  }

  currentReviews = items || [];

  if (!currentReviews.length) {
    reviewModerationList.innerHTML = `
      <div class="glass-card">
        <h3>No hay resenas recibidas</h3>
      </div>
    `;
    return;
  }

  reviewModerationList.innerHTML =
    currentReviews
      .map(
        (item) => `
          <article class="glass-card admin-card review-moderation-card">
            <div class="mini-business-head">
              <h3>${escapeHtml(
                item.business_name
              )}</h3>
              <span class="status-pill status-${escapeHtml(
                item.status
              )}">${escapeHtml(
                item.status
              )}</span>
            </div>

            <p>
              <strong>Categoria:</strong>
              ${escapeHtml(
                item.category
              )}
            </p>
            <p>
              <strong>Ciudad:</strong>
              ${escapeHtml(
                item.city
              )}
            </p>
            <p class="tiny">
              Publicada: ${escapeHtml(
                formatDateTime(
                  item.created_at
                )
              )} - Activa hasta: ${escapeHtml(
                formatDateTime(
                  item.expires_at
                )
              )}
            </p>

            ${
              Number(
                item.report_count ||
                  0
              ) > 0
                ? `
              <div class="review-report-alert">
                <strong>
                  Denuncias: ${escapeHtml(
                    item.report_count
                  )}
                </strong>
                <p>
                  <strong>Ultimo motivo:</strong>
                  ${escapeHtml(
                    item.latest_report_reason ||
                      "Sin motivo"
                  )}
                </p>
                ${
                  item.latest_report_details
                    ? `
                  <p>
                    <strong>Detalle:</strong>
                    ${escapeHtml(
                      item.latest_report_details
                    )}
                  </p>
                `
                    : ""
                }
                <p class="tiny">
                  Recibida: ${escapeHtml(
                    formatDateTime(
                      item.latest_report_at
                    )
                  )}
                </p>
              </div>
            `
                : ""
            }

            <video controls preload="metadata" src="${escapeHtml(
              item.video_path
            )}"></video>

            ${
              item.status === "activa"
                ? `
              <div class="request-actions">
                <button
                  class="ghost-btn"
                  onclick="removeReview(${item.id})"
                >
                  Retirar del muro
                </button>
              </div>
            `
                : ""
            }
          </article>
        `
      )
      .join("");
}

async function loadReviewModeration({
  notify = true,
  updateAlerts = true,
} = {}) {
  if (!reviewModerationList) {
    return;
  }

  try {
    const response = await staffFetch(
      "/api/admin/reviews"
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Error cargando resenas"
      );
    }

    renderReviewModeration(
      data.items || []
    );
    if (updateAlerts) {
      updateAdminAlertCenter({
        notify,
      });
    }
  } catch (error) {
    reviewModerationList.innerHTML = `
      <div class="glass-card">
        <h3>Error</h3>
        <p>${escapeHtml(
          error.message
        )}</p>
      </div>
    `;
  }
}

async function removeReview(id) {
  const reason = window.confirm(
    "Retirar esta resena del muro por incumplir normas?"
  );

  if (!reason) {
    return;
  }

  try {
    const response = await staffFetch(
      `/api/admin/reviews/${id}/remove`,
      {
        method: "POST",
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo retirar la resena"
      );
    }

    await loadReviewModeration();
  } catch (error) {
    alert(error.message);
  }
}

function renderStaffUsers(items) {
  if (!staffUserList) {
    return;
  }

  currentStaffUsers = items || [];

  const advisors =
    currentStaffUsers.filter(
      (item) => item.role === "asesor"
    );

  if (!advisors.length) {
    staffUserList.innerHTML = `
      <div class="glass-card">
        <h3>No hay asesores creados</h3>
      </div>
    `;
    return;
  }

  staffUserList.innerHTML =
    advisors
      .map((item) => {
        const active =
          Boolean(item.active);
        return `
          <article class="glass-card admin-card staff-user-card">
            <div class="mini-business-head">
              <h3>${escapeHtml(
                item.displayName
              )}</h3>
              <span class="status-pill ${
                active
                  ? "status-activo"
                  : "status-pausado"
              }">
                ${active ? "activo" : "inactivo"}
              </span>
            </div>

            <p><strong>Usuario:</strong> ${escapeHtml(
              item.username
            )}</p>
            <p class="tiny">
              Creado: ${escapeHtml(
                formatDateTime(
                  item.createdAt
                )
              )}
            </p>

            <div class="request-actions">
              <button
                type="button"
                class="${
                  active
                    ? "ghost-btn"
                    : "submit-btn"
                }"
                onclick="setStaffUserStatus(${Number(
                  item.id
                )}, ${active ? "false" : "true"})"
              >
                ${active ? "Desactivar" : "Reactivar"}
              </button>
            </div>
          </article>
        `;
      })
      .join("");
}

async function loadStaffUsers() {
  if (
    !staffUserList ||
    !isAdmin()
  ) {
    return;
  }

  staffUserList.innerHTML = `
    <p class="loading">
      Cargando asesores...
    </p>
  `;

  try {
    const response = await staffFetch(
      "/api/admin/staff-users"
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Error cargando asesores"
      );
    }

    renderStaffUsers(
      data.items || []
    );
  } catch (error) {
    staffUserList.innerHTML = `
      <div class="glass-card">
        <h3>Error</h3>
        <p>${escapeHtml(
          error.message
        )}</p>
      </div>
    `;
  }
}

async function createStaffUser(event) {
  event.preventDefault();

  if (!isAdmin()) {
    return;
  }

  setFeedback(
    staffCreateMessage,
    "Creando asesor..."
  );

  const payload = Object.fromEntries(
    new FormData(
      staffCreateForm
    ).entries()
  );

  try {
    const response = await staffFetch(
      "/api/admin/staff-users",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          payload
        ),
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo crear el asesor"
      );
    }

    staffCreateForm.reset();
    setFeedback(
      staffCreateMessage,
      "Asesor creado. Entregale su usuario y clave temporal."
    );
    await loadStaffUsers();
  } catch (error) {
    setFeedback(
      staffCreateMessage,
      error.message,
      true
    );
  }
}

async function setStaffUserStatus(
  id,
  active
) {
  if (!isAdmin()) {
    return;
  }

  const actionText = active
    ? "reactivar"
    : "desactivar";

  if (
    !window.confirm(
      `Quieres ${actionText} este asesor?`
    )
  ) {
    return;
  }

  try {
    const response = await staffFetch(
      `/api/admin/staff-users/${id}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          active,
        }),
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo actualizar el asesor"
      );
    }

    await loadStaffUsers();
  } catch (error) {
    alert(error.message);
  }
}

async function changeStaffPassword(event) {
  event.preventDefault();

  setFeedback(
    staffPasswordMessage,
    "Actualizando clave..."
  );

  const payload = Object.fromEntries(
    new FormData(
      staffPasswordForm
    ).entries()
  );

  try {
    const response = await staffFetch(
      "/api/staff/password",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          payload
        ),
      }
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo cambiar la clave"
      );
    }

    staffPasswordForm.reset();
    setFeedback(
      staffPasswordMessage,
      "Clave actualizada."
    );
  } catch (error) {
    setFeedback(
      staffPasswordMessage,
      error.message,
      true
    );
  }
}

async function loadBusinesses({
  notify = true,
  updateAlerts = true,
} = {}) {

  try {

    const response =
      await staffFetch(
        "/api/admin/businesses"
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "Error cargando negocios"
      );
    }

    renderBusinesses(
      data.items || []
    );
    if (updateAlerts) {
      updateAdminAlertCenter({
        notify,
      });
    }

  } catch (error) {

    businessList.innerHTML = `
      <div class="glass-card">

        <h3>
          Error
        </h3>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

      </div>
    `;
  }
}

async function loadDashboardData({
  notify = false,
} = {}) {
  showAdminDashboard();

  const tasks = [
    loadAdRequests({
      notify: false,
      updateAlerts: false,
    }),
    loadBusinesses({
      notify: false,
      updateAlerts: false,
    }),
    loadReviewModeration({
      notify: false,
      updateAlerts: false,
    }),
  ];

  if (isAdmin()) {
    tasks.push(
      loadAdCampaigns()
    );
    tasks.push(
      loadStaffUsers()
    );
  }

  await Promise.all(tasks);
  updateAdminAlertCenter({
    notify,
  });
  startAdminAlertPolling();
}

async function bootstrapStaffSession() {
  const session = loadStaffSession();

  if (!session) {
    showStaffLogin();
    return;
  }

  staffToken = session.token;
  currentStaff = session.staff;

  try {
    const response = await staffFetch(
      "/api/staff/me"
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo validar la sesion."
      );
    }

    currentStaff = data.staff;
    saveStaffSession(
      staffToken,
      currentStaff
    );
    await loadDashboardData();
  } catch (error) {
    clearStaffSession();
    showStaffLogin(
      error.message,
      true
    );
  }
}

staffLoginForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    setFeedback(
      staffLoginMessage,
      "Validando acceso..."
    );

    const payload = Object.fromEntries(
      new FormData(
        staffLoginForm
      ).entries()
    );

    try {
      const response = await fetch(
        "/api/staff/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload
          ),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo iniciar sesion."
        );
      }

      staffToken = data.token;
      currentStaff = data.staff;
      saveStaffSession(
        staffToken,
        currentStaff
      );
      staffLoginForm.reset();
      await loadDashboardData();
    } catch (error) {
      setFeedback(
        staffLoginMessage,
        error.message,
        true
      );
    }
  }
);

staffLogoutButton?.addEventListener(
  "click",
  async () => {
    try {
      await staffFetch(
        "/api/staff/logout",
        {
          method: "POST",
        }
      );
    } catch {
      // no-op
    } finally {
      clearStaffSession();
      showStaffLogin(
        "Sesion cerrada."
      );
    }
  }
);

staffPasswordForm?.addEventListener(
  "submit",
  changeStaffPassword
);

staffCreateForm?.addEventListener(
  "submit",
  createStaffUser
);

refreshStaffUsersButton?.addEventListener(
  "click",
  loadStaffUsers
);

adForm?.addEventListener(
  "submit",
  saveAdCampaign
);

adCreativeType?.addEventListener(
  "change",
  syncAdCreativeFields
);

refreshAdCampaignsButton?.addEventListener(
  "click",
  loadAdCampaigns
);

refreshAdRequestsButton?.addEventListener(
  "click",
  loadAdRequests
);

refreshReviewModerationButton?.addEventListener(
  "click",
  loadReviewModeration
);

adminSoundToggle?.addEventListener(
  "click",
  async () => {
    adminSoundEnabled =
      !adminSoundEnabled;
    localStorage.setItem(
      ADMIN_SOUND_PREF_KEY,
      String(adminSoundEnabled)
    );
    updateAdminSoundButton();

    if (adminSoundEnabled) {
      await primeAdminSound();
      setAdminAlertStatus(
        "Sonido activo para nuevas solicitudes."
      );
    } else {
      setAdminAlertStatus(
        "Sonido apagado. Los globos siguen activos."
      );
    }
  }
);

["pointerdown", "keydown"].forEach(
  (eventName) => {
    window.addEventListener(
      eventName,
      primeAdminSound,
      {
        once: true,
        passive: true,
      }
    );
  }
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      !document.hidden &&
      staffToken &&
      !adminDashboard?.hidden
    ) {
      loadDashboardData({
        notify: true,
      });
    }
  }
);

syncAdCreativeFields();
updateAdminSoundButton();
bootstrapStaffSession();
