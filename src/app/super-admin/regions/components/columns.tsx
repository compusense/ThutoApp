
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Region } from "../page";
import { Checkbox } from "@/components/ui/checkbox";

export const columns: ColumnDef<Region>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Region Name",
    cell: ({ row }) => {
      const region = row.original;
      return (
        <div className="font-medium">
          {region.name}
        </div>
      );
    },
  },
];
