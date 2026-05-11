
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { School } from "../page";
import { SchoolActions } from "./school-actions";
import { UserProfile } from "@/firebase/auth/use-user";

export const getColumns = (users: UserProfile[]): ColumnDef<School>[] => [
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
    header: "School Name",
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: "regNo",
    header: "REG.NO",
  },
  {
    accessorKey: "regionName",
    header: "Region",
    cell: ({ row }) => <div>{row.original.regionName}</div>,
  },
  {
    accessorKey: "subRegionName",
    header: "Sub-Region",
    cell: ({ row }) => <div>{row.original.subRegionName || "N/A"}</div>,
  },
  {
    accessorKey: "schoolHeadId",
    header: "School Head",
    cell: ({ row }) => {
      const school = row.original;
      const head = users.find(u => u.uid === school.schoolHeadId);
      return <div>{head?.displayName || "Unassigned"}</div>;
    },
  },
  {
    accessorKey: "schoolType",
    header: "School Type",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const school = row.original;
      const schoolHeads = users.filter(u => u.role === 'school-head');
      return <SchoolActions school={school} schoolHeads={schoolHeads} />;
    },
  },
];
