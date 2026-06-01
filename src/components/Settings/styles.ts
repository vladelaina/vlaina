

export const SELECT_ARROW_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='12' viewBox='0 0 7 12'%3E%3Cpolyline points='0.5,3.5 3.5,0.5 6.5,3.5' fill='none' stroke='%23333' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpolyline points='0.5,8.5 3.5,11.5 6.5,8.5' fill='none' stroke='%23333' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

export const selectStyle: React.CSSProperties = {
  backgroundImage: SELECT_ARROW_SVG,
};

export const selectClassName = 
  "px-2 py-1 pr-6 text-xs bg-[var(--vlaina-color-setting-field)] border border-[var(--vlaina-border)] rounded text-[var(--chat-sidebar-text)] focus:outline-none focus:ring-1 focus:ring-[var(--vlaina-accent)] min-w-[100px] cursor-pointer appearance-none bg-[length:7px_12px] bg-[right_5px_center] bg-no-repeat";

export const settingsButtonClassName = 
  "px-3 py-1.5 text-xs font-medium text-[var(--chat-sidebar-text)] bg-[var(--vlaina-bg-tertiary)] hover:bg-[var(--vlaina-hover)] rounded-md transition-colors";
