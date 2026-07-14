export interface F9Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

export interface LookupAdapter<T extends Record<string, any>> {
  endpoint: string;
  displayLabel: (item: T) => string;
  searchFields: string[];
  columns: F9Column<T>[];
}
