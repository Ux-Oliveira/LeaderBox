import React from "react";

/*
  MovieSlot.jsx
  - Shows a square slot; empty shows plus sign, filled shows poster and title overlay.
  - Clicking an empty or filled slot calls onOpen (open search) or onClear (clear)
*/

export default function MovieSlot({ index, movie, onOpen, onClear }) {
  return (
    <div className="movie-slot" onClick={movie ? onClear : onOpen} role="button" tabIndex={0}>
      {movie ? (
        <>
          <img className="slot-poster" src={movie.poster_full || movie.poster_path || "/poster-placeholder.png"} alt={movie.title} />
          <div className="slot-info">
            <div className="slot-title">{movie.title}</div>
            <div className="slot-year">{movie.release_date ? movie.release_date.slice(0,4) : ""}</div>
          </div>
        </>
      ) : (
        <div className="slot-empty">
          <div className="plus">+</div>
        </div>
      )}
    </div>
  );
}
