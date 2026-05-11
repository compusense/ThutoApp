"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Class } from "@/app/school-head/classes/page";
import { MyClassActions } from "./my-class-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const getColumns = (): ColumnDef<Class>[] => [
  {
    accessorKey: "name",
    header: "Class Name",
    cell: ({ row }) => {
      return (
        <div className="font-medium">
          {row.original.name}
        </div>
      );
    },
  },
  {
    accessorKey: "academicYear",
    header: "Academic Year",
  },
  {
    accessorKey: "gradeLevel",
    header: "Grade Level",
  },
  {
    accessorKey: "stream",
    header: "Stream",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const classData = row.original;
      return <MyClassActions classData={classData} />;
    },
  },
];
