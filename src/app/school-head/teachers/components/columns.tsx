
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { UserProfile } from "@/firebase/auth/use-user";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppLink } from "@/components/ui/app-link";

export const getColumns = (): ColumnDef<UserProfile>[] => [
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
             <Button variant="link" asChild className="p-0 h-auto text-left justify-start">
                <AppLink href={`/school-head/teachers/${user.uid}`}>
                    <span className="font-medium">
                        {user.displayName || "N/A"}
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
    accessorKey: "email",
    header: "Email",
  },
    {
    accessorKey: "post",
    header: "Post",
  },
  {
    accessorKey: "qualification",
    header: "Qualification",
  },
];
