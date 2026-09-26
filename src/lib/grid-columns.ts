// Cookie holding a viewer's cards-per-row choice for one kind of card list.
// Shared by the server (dynamic pages render the choice) and the switch.
export function gridColumnsCookie(scope: string): string {
  return `grid_cols_${scope}`;
}
