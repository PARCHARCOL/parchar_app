import React, { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Clock3,
  MessageCircle,
  MapPin,
  Check,
} from "lucide-react";
import { lifeLabel, TOPICS } from "./domain";
export function Drawing({ post }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.CreativeRender)
      window.CreativeRender.draw(ref.current, post, false);
  }, [post]);
  return (
    <canvas
      ref={ref}
      width="400"
      height="300"
      className="sw-drawing"
      role="img"
      aria-label={`Dibujo de ${post.alias}`}
    />
  );
}
export default function PostNode({ post, visited, onOpen, list = false, now }) {
  const topic = TOPICS.find((t) => t.id === post.topic) || TOPICS[3];
  return (
    <button
      type="button"
      data-node={post.id}
      className={`sw-node ${list ? "sw-node-list" : ""} ${visited ? "sw-node-visited" : ""}`}
      style={{
        ...(list
          ? {}
          : {
              position: "absolute",
              left: post.x,
              top: post.y,
              width: post.width,
              height: post.height,
            }),
        "--island-color": topic.color,
      }}
      onClick={() => onOpen(post)}
      aria-label={`Abrir ${post.title}`}
    >
      <div className="sw-node-meta">
        <span>{post.city || "Comunidad"}</span>
        <span aria-label={visited ? "Explorada" : "Sin explorar"}>
          {visited ? <Check size={16} /> : <ArrowUpRight size={17} />}
        </span>
      </div>
      <h3>{post.title}</h3>
      {post.strokes?.length ? (
        <Drawing post={post} />
      ) : (
        <p className="sw-node-excerpt">{post.text}</p>
      )}
      <div className="sw-node-foot">
        <span>{post.alias}</span>
        <span>
          <MessageCircle size={14} />
          {post.contributions
            ? `${post.contributions} participantes`
            : "Conversar"}
        </span>
      </div>
      <div className="sw-node-life">
        <Clock3 size={13} />
        {lifeLabel(post, now)}
      </div>
    </button>
  );
}
