export default function Loading() {
  return (
    <div className="grid gap-6">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div className="skeleton h-12 w-2/3 max-w-md" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
    </div>
  );
}
