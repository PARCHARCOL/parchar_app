import React, { useState } from "react";
import { Send, Save, LogIn } from "lucide-react";
import Modal from "./Modal";
import { TOPICS, CITIES, readLocal, saveLocal } from "./domain";
export default function CreateNodeModal({
  onClose,
  onSubmit,
  demo,
  user,
  initialTopic,
}) {
  const [form, setForm] = useState(() => ({
      ...{
        alias: (user.client?.fullName || "").slice(0, 24),
        title: "",
        text: "",
        topic: initialTopic,
        city: "",
        depth: 25,
        lifetime: "7d",
      },
      ...readLocal("parchar_spatial_draft_v1", {}),
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const save = () => {
    saveLocal("parchar_spatial_draft_v1", form);
    setError("Borrador guardado en este dispositivo.");
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!demo && !user.token) {
      saveLocal("parchar_spatial_draft_v1", form);
      location.assign("/clients.html?next=creative");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(form);
      saveLocal("parchar_spatial_draft_v1", null);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Nuevo nodo" onClose={onClose}>
      <form className="sw-form" onSubmit={submit}>
        {demo && (
          <p className="sw-notice">
            Edición de ejemplo: se guarda solo en este dispositivo.
          </p>
        )}
        <label>
          Nombre público
          <input
            name="alias"
            value={form.alias}
            onChange={change}
            required
            maxLength={24}
            autoComplete="nickname"
          />
        </label>
        <label>
          Título
          <input
            name="title"
            value={form.title}
            onChange={change}
            required
            maxLength={100}
          />
        </label>
        <label>
          Contenido
          <textarea
            name="text"
            value={form.text}
            onChange={change}
            required
            maxLength={4000}
            rows={5}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Isla temática
            <select name="topic" value={form.topic} onChange={change}>
              {TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Municipio
            <select name="city" value={form.city} onChange={change}>
              <option value="">Sin especificar</option>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Profundidad <output>{form.depth}/100</output>
          <input
            name="depth"
            aria-label="Profundidad del nodo"
            type="range"
            min={0}
            max={100}
            step={25}
            value={form.depth}
            onChange={(e) =>
              setForm({ ...form, depth: Number(e.target.value) })
            }
          />
        </label>
        <fieldset>
          <legend>Caducidad</legend>
          <div className="sw-lifetimes">
            {[
              ["2h", "2 horas", "Plan rápido"],
              ["7d", "7 días", "Conversación"],
              ["permanent", "Permanente", "Obra"],
            ].map(([id, label, sub]) => (
              <label
                key={id}
                className={form.lifetime === id ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="lifetime"
                  checked={form.lifetime === id}
                  value={id}
                  onChange={change}
                />
                <strong>{label}</strong>
                <span>{sub}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {!demo && (
          <p className="sw-fine">
            Tu nombre público, título y contenido se revisan antes de
            publicarse. Pueden enviarse a OpenAI para detectar contenido dañino;
            los casos dudosos pasan a revisión humana. No publiques datos
            personales ni contenido ajeno sin permiso.
          </p>
        )}
        <p role="status" className="sw-form-status">
          {error}
        </p>
        <footer>
          <button type="button" className="sw-button" onClick={save}>
            <Save size={18} />
            Guardar borrador
          </button>
          <button className="sw-primary" type="submit" disabled={busy}>
            {!demo && !user.token ? <LogIn size={18} /> : <Send size={18} />}{" "}
            {busy
              ? "Enviando…"
              : demo
                ? "Crear en el ejemplo"
                : user.token
                  ? "Enviar a revisión"
                  : "Iniciar sesión y enviar"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
