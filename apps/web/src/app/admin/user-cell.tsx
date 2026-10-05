export function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- OAuth avatars come from arbitrary hosts
    return <img src={image} alt="" className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 object-cover" loading="lazy" />;
  }
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-950 text-xs font-bold text-white">
      {initials}
    </span>
  );
}

export function UserCell({ name, email, image, role }: { name: string | null; email: string | null; image: string | null; role: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name || email || '?'} image={image} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-neutral-950">{name || '—'}</span>
          {role === 'admin' && (
            <span className="rounded-md bg-neutral-950 px-1.5 py-0.5 text-[10px] font-bold text-white">admin</span>
          )}
        </div>
        <div className="truncate text-xs text-neutral-500">{email ?? '—'}</div>
      </div>
    </div>
  );
}
