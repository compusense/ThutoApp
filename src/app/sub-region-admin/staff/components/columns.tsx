
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { UserProfile } from "@/firebase/auth/use-user";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppLink } from "@/components/ui/app-link";

interface StaffMember extends UserProfile {
    schoolName?: string;
}

export const getColumns = (): ColumnDef<StaffMember>[] => [
  {
    accessorKey: "displayName",
    header: "Name",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? ""} />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <Button variant="link" asChild className="p-0 h-auto">
                <AppLink href={`/sub-region-admin/staff/${user.uid}`}>
                    <span className="font-medium">
                        {user.displayName || 'N/A'}
                    </span>
                </AppLink>
            </Button>
             {user.isDeactivated && <Badge variant="destructive" className="w-fit">Deactivated</Badge>}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "gender",
    header: "Gender",
  },
  {
    accessorKey: "schoolName",
    header: "School",
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
  },
  {
    accessorKey: "post",
    header: "Position",
     filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
  },
  {
    accessorKey: "qualification",
    header: "Qualification",
     filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
  },
  {
    accessorKey: "salaryScale",
    header: "Salary Scale",
     filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
  },
];
