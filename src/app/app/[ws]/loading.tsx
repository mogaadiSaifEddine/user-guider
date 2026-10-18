// Shown instantly while a dashboard page loads, so clicks feel responsive.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-2 h-6 w-48 rounded bg-gray-200" />
      <div className="mb-8 h-4 w-72 rounded bg-gray-100" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-white ring-1 ring-gray-200" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-white ring-1 ring-gray-200" />
    </div>
  );
}
