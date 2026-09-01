/**
 * @tua/ui — shared design system components.
 * Import "./theme.css" once, at the app root (apps/web/src/app/globals.css).
 */

export { cn } from "./lib/utils";

export { StatusBadge, type FlightStatus, type BadgeTone } from "./components/status-badge";
export { PageHeader } from "./components/page-header";
export { Pagination } from "./components/pagination";
export { FilterPanel, FilterField } from "./components/filter-panel";
export { DataTable, type DataTableColumn } from "./components/data-table";
export { DatePicker, type DatePickerLabels } from "./components/date-picker";

export const UI_VERSION = "0.1.0-faz1";
