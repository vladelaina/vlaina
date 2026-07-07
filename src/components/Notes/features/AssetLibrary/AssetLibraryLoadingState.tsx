export function AssetLibraryLoadingState() {
  return (
    <div
      data-testid="asset-library-loading"
      className="grid grid-cols-3 gap-2 p-3"
      aria-busy="true"
    >
      {Array.from({ length: 9 }, (_value, index) => (
        <div
          key={index}
          className="aspect-square rounded-lg bg-[var(--vlaina-bg-tertiary)] animate-pulse"
        />
      ))}
    </div>
  );
}
