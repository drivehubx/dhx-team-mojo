export function InitialsAvatar({
  initials,
  size = 36,
  className = "",
}: {
  initials: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export function AvatarStack({ initialsList, size = 28 }: { initialsList: string[]; size?: number }) {
  return (
    <div className="flex -space-x-2">
      {initialsList.map((i, idx) => (
        <div
          key={idx}
          className="grid place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          {i}
        </div>
      ))}
    </div>
  );
}
