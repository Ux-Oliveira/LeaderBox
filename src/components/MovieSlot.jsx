import React from "react";

/*
  MovieSlot
  - shows a square tile; when empty shows a translucent + button
  - when filled shows poster, title overlay and a small clear X
  - clicking tile opens search modal (via onOpen)
  - clicking clear calls onClear
*/

export default function MovieSlot({ index, movie, onOpen, onClear }) {
  return (
    <div className="movie-slot" role="listitem">
      {!movie ? (
        <button className="slot-empty" onClick={onOpen} aria-label={`Add movie to slot ${index + 1}`}>
          <div className="plus">＋</div>
        </button>
      ) : (
        <div className="slot-filled" onClick={onOpen} role="button" tabIndex={0}>
          <img
            src={movie.poster_path || movie.poster || movie.poster_full || ""}
            alt={movie.title || movie.name || "movie"}
            className="slot-poster"
            onError={(e) => { e.currentTarget.src = "/poster-fallback.png"; }}
          />
          <div className="slot-meta">
            <div className="slot-title">{movie.title || movie.name}</div>
            <div className="slot-sub">{movie.release_date ? movie.release_date.slice(0,4) : ""}</div>
          </div>
          <button className="slot-clear" onClick={(e) => { e.stopPropagation(); onClear(); }} aria-label="Remove movie">✕</button>
        </div>
      )}
    </div>
  );
}
