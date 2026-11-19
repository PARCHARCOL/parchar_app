import React, { useState, useRef, useEffect } from "react";
import {
  Lightbulb,
  HandHelping,
  Bookmark,
  StickyNote,
  Send,
  Flag,
  Trash2,
  Check,
} from "lucide-react";
import Modal from "./Modal";
import { Drawing } from "./PostNode";
import { lifeLabel, TOPICS } from "./domain";
export default function NodeDetailModal({
  post,
  onClose,
  onEcho,
  signals,
  onNote,
  notes,
  notice,
  onReport,
  onDelete,
  demo,
  now,
}) {
  const [anchor, setAnchor] = useState(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState(null),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("Contenido ofensivo"),
    [remove, setRemove] = useState(false);
  const body = useRef(null),
    input = useRef(null);
  useEffect(() => {
    if (selected)
      document
        .getElementById(`sw-note-${selected}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const topic = TOPICS.find((t) => t.id === post.topic) || TOPICS[3],
    saved = (kind) =>
      signals.some((s) => s.postId === post.id && s.kind === kind);
  const chooseAnchor = (event) => {
    if (event?.target?.closest("[data-note]")) return;
    const rect = body.current.getBoundingClientRect(),
      selection = window.getSelection();
    let quote = "",
      start;
    if (
      selection?.rangeCount &&
      body.current.contains(selection.anchorNode) &&
      body.current.contains(selection.focusNode)
    ) {
      quote = selection.toString().trim().slice(0, 200);
      if (quote) {
        const range = selection.getRangeAt(0),
          prefix = range.cloneRange();
        prefix.selectNodeContents(body.current);
        prefix.setEnd(range.startContainer, range.startOffset);
        start = prefix.toString().length;
        const leading =
          selection.toString().length - selection.toString().trimStart().length;
        start += leading;
      }
    }
    setAnchor({
      x: event
        ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        : 0.5,
      y: event
        ? Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        : 0.5,
      quote,
      ...(start == null ? {} : { start }),
    });
    setTimeout(() => input.current?.focus(), 0);
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await onNote(post, text, anchor);
      setText("");
      setAnchor(null);
      setMessage(
        demo
          ? "Nota añadida al ejemplo."
          : "Nota enviada a revisión. Solo aparecerá públicamente después de aprobarse.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  const echo = async (kind) => {
    setMessage("");
    try {
      const active = !saved(kind);
      await onEcho(post, kind, active);
      setMessage(
        demo
          ? "Acción de ejemplo guardada solo en este dispositivo."
          : kind === "capsule"
            ? saved(kind)
              ? "Retirado de tu cápsula."
              : "Guardado en tu cápsula."
            : active
              ? "Agradecimiento registrado. Solo lo recibe el autor en privado."
              : "Agradecimiento retirado.",
      );
    } catch (error) {
      setMessage(error.message);
    }
  };
  const activeNotes = notes.filter(
    (n) => n.parentId === post.id || n.parentId == null,
  );
  const renderText = () => {
    const pieces = [];
    let offset = 0;
    const quoted = activeNotes
      .filter(
        (n) =>
          n.anchor?.quote &&
          Number.isInteger(n.anchor.start) &&
          post.text.slice(
            n.anchor.start,
            n.anchor.start + n.anchor.quote.length,
          ) === n.anchor.quote,
      )
      .sort((a, b) => a.anchor.start - b.anchor.start);
    for (const note of quoted) {
      const start = note.anchor.start,
        end = start + note.anchor.quote.length;
      if (start < offset) continue;
      pieces.push(post.text.slice(offset, start));
      pieces.push(
        <button
          key={note.id}
          type="button"
          data-note={note.id}
          className="sw-annotation"
          title={`Nota de ${note.alias}`}
          onClick={() => setSelected(note.id)}
        >
          {post.text.slice(start, end)}
        </button>,
      );
      offset = end;
    }
    pieces.push(post.text.slice(offset));
    return pieces;
  };
  return (
    <Modal title={post.title} onClose={onClose} wide>
      <div className="sw-detail-meta">
        <span style={{ color: topic.color }}>{topic.name}</span>
        <span>{post.city || "Comunidad"}</span>
        <span>{lifeLabel(post, now)}</span>
      </div>
      <div className="sw-detail-layout">
        <article>
          <div className="sw-detail-author">
            <span className="sw-avatar">{post.alias?.slice(0, 1)}</span>
            <strong>{post.alias}</strong>
            {post.status && <span className="sw-status">{post.status}</span>}
          </div>
          {!!post.strokes?.length && <Drawing post={post} />}
          <div
            className={`sw-detail-body ${anchor ? "is-annotating" : ""}`}
            onClick={(event) => {
              if (anchor) chooseAnchor(event);
            }}
          >
            <p ref={body}>{renderText()}</p>
            {activeNotes
              .filter((n) => n.anchor && !n.anchor.quote)
              .map((n, i) => (
                <button
                  key={n.id}
                  data-note={n.id}
                  className="sw-note-pin"
                  style={{
                    left: `${n.anchor.x * 95}%`,
                    top: `${n.anchor.y * 95}%`,
                  }}
                  title={`Nota de ${n.alias}`}
                  aria-label={`Abrir nota de ${n.alias}`}
                  onClick={() => setSelected(n.id)}
                >
                  <StickyNote size={15} />
                  <span>{i + 1}</span>
                </button>
              ))}
          </div>
          <div className="sw-echoes">
            {[
              ["think", "Me hizo pensar", Lightbulb],
              ["useful", "Me sirvió", HandHelping],
              ["capsule", "Guardar en cápsula", Bookmark],
            ].map(([id, label, Icon]) => (
              <button
                type="button"
                key={id}
                aria-pressed={saved(id)}
                className={saved(id) ? "is-selected" : ""}
                onClick={() => echo(id)}
              >
                <Icon size={18} />
                {label}
                {saved(id) && <Check size={14} />}
              </button>
            ))}
          </div>
          <p className="sw-fine">
            Los agradecimientos no tienen contadores públicos.
          </p>
          <div className="sw-detail-actions">
            <button
              type="button"
              className="sw-button"
              onClick={() => chooseAnchor()}
            >
              <StickyNote size={18} />
              Anclar nota
            </button>
            {onDelete ? (
              <button
                className="sw-text-button"
                onClick={() => setRemove(!remove)}
              >
                <Trash2 size={17} />
                Retirar mi publicación
              </button>
            ) : (
              <button
                className="sw-text-button"
                onClick={() => setReport(!report)}
              >
                <Flag size={17} />
                Reportar
              </button>
            )}
          </div>
          {remove && (
            <div className="sw-notice">
              <p>¿Retirar esta publicación del muro?</p>
              <button
                className="sw-button"
                onClick={async () => {
                  try {
                    await onDelete(post);
                    onClose();
                  } catch (e) {
                    setMessage(e.message);
                  }
                }}
              >
                Confirmar retiro
              </button>
            </div>
          )}
          {report && (
            <form
              className="sw-report"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await onReport(post, reason);
                  setReport(false);
                  setMessage("Reporte enviado a moderación.");
                } catch (error) {
                  setMessage(error.message);
                }
              }}
            >
              <label>
                Motivo
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {[
                    "Acoso",
                    "Contenido ofensivo",
                    "Datos personales",
                    "Publicidad no autorizada",
                    "Otro",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <button className="sw-button" type="submit">
                Enviar reporte
              </button>
            </form>
          )}
          <p className="sw-form-status" role="status">
            {message || notice}
          </p>
        </article>
        <aside className="sw-notes" aria-label="Notas de la conversación">
          <div className="flex items-center gap-2">
            <StickyNote size={20} />
            <h3>Notas ancladas</h3>
          </div>
          {anchor && (
            <form className="sw-note-form" onSubmit={submit}>
              <label>
                {anchor.quote
                  ? `Sobre «${anchor.quote}»`
                  : "Tu nota en este punto"}
                <textarea
                  ref={input}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  required
                  maxLength={800}
                  rows={4}
                />
              </label>
              {!demo && (
                <p className="sw-fine">
                  La nota se envía al sistema de moderación automática con
                  OpenAI y puede ser revisada por asesores antes de publicarse.
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button className="sw-primary" disabled={busy} type="submit">
                  <Send size={16} />
                  {busy ? "Enviando…" : "Enviar nota"}
                </button>
                <button
                  className="sw-button"
                  type="button"
                  onClick={() => setAnchor(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {!activeNotes.length && !anchor && (
            <p className="sw-muted">Todavía no hay notas publicadas.</p>
          )}
          {activeNotes.map((n) => (
            <section
              key={n.id}
              id={`sw-note-${n.id}`}
              className={`sw-note ${selected === n.id ? "is-highlighted" : ""}`}
            >
              <strong>{n.alias}</strong>
              {n.anchor?.quote && <blockquote>{n.anchor.quote}</blockquote>}
              <p>{n.text}</p>
              {n.status === "pendiente" && (
                <small>Tu nota está pendiente de revisión.</small>
              )}
            </section>
          ))}
        </aside>
      </div>
    </Modal>
  );
}
