export default function Loading() {
  return (
    <div className="grid gap-6">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div className="skeleton h-5 w-1/2 max-w-sm" />
      <div className="skeleton h-64" />
    </div>
  );
}
