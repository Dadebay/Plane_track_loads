import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "../src/components/data-table";

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
];

describe("DataTable", () => {
  it("renders empty state when there are no rows", () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} emptyState="nothing" />);
    expect(screen.getByText("nothing")).toBeInTheDocument();
  });

  it("renders both table and card representations for rows (CSS toggles visibility)", () => {
    const rows: Row[] = [{ id: "1", name: "T5 692" }];
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    // Appears twice: once in <table>, once in the mobile card <li>.
    expect(screen.getAllByText("T5 692")).toHaveLength(2);
  });
});
