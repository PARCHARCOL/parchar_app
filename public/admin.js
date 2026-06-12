const businessList = document.querySelector(
  "#admin-business-list"
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

const adRequestList = document.querySelector(
  "#admin-ad-request-list"
);

const refreshAdRequestsButton =
  document.querySelector(
    "#refresh-ad-requests"
  );

let currentStatus =
  "pendiente";

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

    const response = await fetch(
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

    const response = await fetch(
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

    const response = await fetch(
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

    const response = await fetch(
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

    const response = await fetch(
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

    const response = await fetch(
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

async function loadAdBannerSettings() {
  if (!adForm) {
    return;
  }

  try {
    const response = await fetch(
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
  const payload =
    Object.fromEntries(
      formData.entries()
    );
  payload.enabled =
    adForm.elements.enabled.checked;

  try {
    const response = await fetch(
      "/api/admin/ad-banner",
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
          "No se pudo guardar el banner"
      );
    }

    setFeedback(
      adMessage,
      "Banner actualizado."
    );
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
        (item) => `
      <article class="glass-card admin-card">
        <div class="mini-business-head">
          <h3>
            ${escapeHtml(
              item.business_name
            )}
          </h3>
          <span class="status-pill status-${escapeHtml(
            item.status
          )}">
            ${escapeHtml(
              item.status
            )}
          </span>
        </div>

        <p>
          <strong>Contacto:</strong>
          ${escapeHtml(
            item.full_name
          )}
        </p>

        <p>
          <strong>Telefono:</strong>
          ${escapeHtml(
            item.phone || "No enviado"
          )}
        </p>

        <p>
          <strong>Correo:</strong>
          ${escapeHtml(
            item.email || "No enviado"
          )}
        </p>

        <p>
          <strong>Mensaje:</strong>
          ${escapeHtml(
            item.message
          )}
        </p>

        <p class="tiny">
          ${escapeHtml(
            formatDateTime(
              item.created_at
            )
          )}
          ${
            item.source_page
              ? ` - ${escapeHtml(
                  item.source_page
                )}`
              : ""
          }
        </p>

        ${
          item.status ===
          "contactado"
            ? ""
            : `
          <button
            class="submit-btn"
            onclick="resolveAdRequest(${item.id})"
          >
            Marcar contactado
          </button>
        `
        }
      </article>
    `
      )
      .join("");
}

async function loadAdRequests() {
  if (!adRequestList) {
    return;
  }

  try {
    const response = await fetch(
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
    const response = await fetch(
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
      await fetch(
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

adForm?.addEventListener(
  "submit",
  saveAdBannerSettings
);

refreshAdRequestsButton?.addEventListener(
  "click",
  loadAdRequests
);

loadBusinesses();
loadAdBannerSettings();
loadAdRequests();
