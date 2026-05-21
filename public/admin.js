const businessList = document.querySelector(
  "#admin-business-list"
);

function escapeHtml(value) {

  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function approveBusiness(id) {

  try {

    const response = await fetch(
      `/api/admin/businesses/${id}/approve`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "No se pudo aprobar"
      );
    }

    alert(
      "✅ Negocio aprobado"
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

    const data = await response.json();

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

    const data = await response.json();

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
          description: "",
          products: "",
          city: "",
          category: "",
        }),
      }
    );

    const data = await response.json();

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

function renderBusinesses(items) {

  if (!items.length) {

    businessList.innerHTML = `
      <div class="glass-card">

        <h3>
          No hay negocios pendientes
        </h3>

      </div>
    `;

    return;
  }

  businessList.innerHTML = items
    .map(
      (item) => `

      <article class="glass-card admin-card">

        <h3>
          ${escapeHtml(
            item.business_name
          )}
        </h3>

        <p>
          <strong>Dueño:</strong>
          ${escapeHtml(
            item.owner_name
          )}
        </p>

        <p>
          <strong>Correo:</strong>
          ${escapeHtml(
            item.owner_email
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
          <strong>Red social:</strong>
          ${escapeHtml(
            item.social_link || "-"
          )}
        </p>

        <p>
          <strong>Descripcion:</strong>
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
              download
              class="ghost-btn"
            >
              📄 Descargar RUT
            </a>
          `
              : `
            <span>
              ❌ Sin RUT
            </span>
          `
          }

          ${
            item.commerce_document
              ? `
            <a
              href="${item.commerce_document}"
              download
              class="ghost-btn"
            >
              🏢 Descargar Cámara Comercio
            </a>
          `
              : `
            <span>
              ❌ Sin Cámara Comercio
            </span>
          `
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

        </div>

      </article>
    `
    )
    .join("");
}

async function loadBusinesses() {

  try {

    const response = await fetch(
      "/api/admin/businesses"
    );

    const data = await response.json();

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