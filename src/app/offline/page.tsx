"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Nema internet konekcije</h1>
        <p className="text-muted-foreground">
          Proverite internet vezu i pokusajte ponovo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Pokusaj ponovo
        </button>
      </div>
    </div>
  );
}
