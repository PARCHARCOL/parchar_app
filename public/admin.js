const businessList = document.querySelector(
  "#admin-business-list"
);

const tabs = document.querySelectorAll(
  ".admin-tab"
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

loadBusinesses();

