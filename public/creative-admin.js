(() => {
  const feedback = document.querySelector("#creative-admin-feedback"), list = document.querySelector("#creative-admin-list");
  let token = "";
  try { token = JSON.parse(localStorage.getItem("parchar_staff_session") || "{}").token || ""; } catch {}
  async function api(path, options = {}) { const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se pudo completar la operación."); return data; }
  async function load() {
    list.replaceChildren(); feedback.textContent = "Cargando creaciones…";
    if (!token) { feedback.replaceChildren(); const link = document.createElement("a"); link.href = "/admin.html"; link.textContent = "Inicia sesión en Admin para moderar el muro."; link.style.color = "#67ebda"; feedback.append(link); return; }
    try {
      const data = await api(`/api/admin/creative?status=${document.querySelector("#creative-admin-status").value}`);
      feedback.textContent = `${data.items.length} creaciones. Aprobar permite ver la obra; no certifica al autor ni su contenido.`;
      for (const item of data.items) {
        const card = CreativeRender.card(item, true); card.querySelector("button").remove();
        if (item.text) { const text = document.createElement("p"); text.textContent = item.text; text.style.whiteSpace = "pre-wrap"; card.append(text); }
        if (item.reasons) { const reason = document.createElement("p"); reason.className = "wall-admin-reason"; reason.textContent = item.reasons; card.append(reason); }
        const actions = document.createElement("div"); actions.className = "wall-admin-actions";
        for (const [action, label] of [["aprobar", "Publicar"], ["retirar", "Retirar"], ["bloquear", "Bloquear autor"], ["desbloquear", "Desbloquear autor"]]) {
          if (action === "aprobar" && item.status === "activo") continue;
          const button = document.createElement("button"); button.textContent = label;
          button.onclick = async () => { if (!confirm(`${label}: ¿confirmas esta acción?${action === "bloquear" ? " Se retirarán todas las creaciones del autor y no podrá enviar nuevas." : ""}`)) return; button.disabled = true; try { await api(`/api/admin/creative/${item.id}/moderate`, { method: "POST", body: JSON.stringify({ action }) }); await load(); } catch (error) { feedback.textContent = error.message; button.disabled = false; } };
          actions.append(button);
        }
        card.append(actions); list.append(card);
      }
    } catch (error) { feedback.textContent = error.message; }
  }
  document.querySelector("#creative-admin-status").onchange = load; document.querySelector("#creative-admin-refresh").onclick = load; load();
})();
