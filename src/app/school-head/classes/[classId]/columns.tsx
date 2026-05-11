
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from 'date-fns';
import { Student } from "../../students/page";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const getColumns = (onRemove: (student: Student) => void): ColumnDef<Student>[] => [
  {
    accessorKey: "admissionNumber",
    header: "Admission No.",
  },
  {
    accessorKey: "fullName",
    header: "Name",
    cell: ({ row }) => {
      return (
        <div className="font-medium">
          {row.original.fullName}
        </div>
      );
    },
  },
  {
    accessorKey: "gender",
    header: "Gender",
  },
  {
    accessorKey: "dateOfBirth",
    header: "Date of Birth",
    cell: ({ row }) => {
      const dob = row.original.dateOfBirth;
      if (!dob) return "N/A";
      return format(new Date(dob), "PPP");
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
        const student = row.original;
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    onClick={() => onRemove(student)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Remove from class</span>
                </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
  }
];
