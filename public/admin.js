const businessList = document.querySelector(
  "#admin-business-list"
);

const STAFF_SESSION_KEY =
  "parchar_staff_session";

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

const adRequestList = document.querySelector(
  "#admin-ad-request-list"
);

const refreshAdRequestsButton =
  document.querySelector(
    "#refresh-ad-requests"
  );

let currentStatus =
  "pendiente";
let staffToken = "";
let currentStaff = null;
let currentAdRequests = [];

function escapeHtml(value) {

  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  const filtered =
    (
      items || []
    ).filter(
      (item) =>
        item.status ===
        currentStatus
    );

  if (!filtered.length) {

    businessList.innerHTML = `
      <div class="glass-card">

        <h3>
          No hay negocios
        </h3>

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
            <a
              href="${item.rut_document}"
              target="_blank"
              rel="noopener noreferrer"
              class="ghost-btn"
            >
              Ver RUT
            </a>
          `
              : ""
          }

          ${
            item.commerce_document
              ? `
            <a
              href="${item.commerce_document}"
              target="_blank"
              rel="noopener noreferrer"
              class="ghost-btn"
            >
              Ver Camara Comercio
            </a>
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

function renderAdPreview(banner) {
  if (!adPreview) {
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
  `;
  adPreview.hidden = false;
}

async function loadAdBannerSettings() {
  if (!adForm) {
    return;
  }

  try {
    const response = await staffFetch(
      "/api/admin/ad-banner"
    );
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Error cargando banner"
      );
    }

    const banner =
      data.banner || {};

    adForm.elements.enabled.checked =
      Boolean(banner.enabled);
    adForm.elements.title.value =
      banner.title || "Publicidad";
    adForm.elements.message.value =
      banner.message ||
      "Espacio para aliados de Parchar";
    adForm.elements.ctaLabel.value =
      banner.ctaLabel || "Anunciar";
    adForm.elements.advertiserName.value =
      banner.advertiserName || "";
    adForm.elements.targetUrl.value =
      banner.targetUrl || "";
    adForm.elements.clearMedia.checked =
      false;
    renderAdPreview(banner);
  } catch (error) {
    setFeedback(
      adMessage,
      error.message,
      true
    );
  }
}

async function saveAdBannerSettings(event) {
  event.preventDefault();

  setFeedback(
    adMessage,
    "Guardando banner..."
  );

  const formData = new FormData(
    adForm
  );
  formData.set(
    "enabled",
    adForm.elements.enabled.checked
      ? "true"
      : "false"
  );

  try {
    const response = await staffFetch(
      "/api/admin/ad-banner",
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
          "No se pudo guardar el banner"
      );
    }

    setFeedback(
      adMessage,
      "Banner actualizado."
    );
    await loadAdBannerSettings();
  } catch (error) {
    setFeedback(
      adMessage,
      error.message,
      true
    );
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
  adForm.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  adForm.elements.targetUrl.focus();
  setFeedback(
    adMessage,
    "Solicitud cargada. Agrega el enlace y el archivo de la publicidad."
  );
}

async function loadAdRequests() {
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

async function loadBusinesses() {

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

async function loadDashboardData() {
  showAdminDashboard();

  const tasks = [
    loadAdRequests(),
    loadBusinesses(),
  ];

  if (isAdmin()) {
    tasks.push(
      loadAdBannerSettings()
    );
  }

  await Promise.all(tasks);
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

adForm?.addEventListener(
  "submit",
  saveAdBannerSettings
);

refreshAdRequestsButton?.addEventListener(
  "click",
  loadAdRequests
);

bootstrapStaffSession();
