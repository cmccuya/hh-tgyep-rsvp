const FLAKES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 8) * 0.8}s`,
  duration: `${9 + (i % 7)}s`,
  size: 3 + (i % 5),
  opacity: 0.28 + (i % 5) * 0.1,
}));

export function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((flake, i) => (
        <span
          key={i}
          className="flake"
          style={{
            left: flake.left,
            animationDelay: flake.delay,
            animationDuration: flake.duration,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
          }}
        />
      ))}
    </div>
  );
}
