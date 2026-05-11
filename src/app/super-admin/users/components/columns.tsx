
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { UserProfile } from "@/firebase/auth/use-user";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { School } from "../../schools/page";
import { UserActions } from "./user-actions";
import { SubRegion } from "../../sub-regions/page";
import { getInitials } from "@/lib/utils";
import { Region } from "../../regions/page";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


export const getColumns = (schools: School[], regions: Region[], subRegions: SubRegion[]): ColumnDef<UserProfile & { schoolName?: string; subRegionName?: string }>[] => [
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
    accessorKey: "displayName",
    header: "Name",
    cell: ({ row }) => {
      const user = row.original;
      const now = new Date();
      const lastSignIn = user.lastSignInTime ? new Date(user.lastSignInTime) : null;
      const isOnline = lastSignIn && (now.getTime() - lastSignIn.getTime()) < 5 * 60 * 1000; // 5 minutes

      const avatar = (
         <div className="relative">
          <Avatar>
            <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? ""} />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          {isOnline && <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />}
        </div>
      );

      const tooltipContent = isOnline 
        ? "Online" 
        : user.lastSignInTime 
          ? `Last seen: ${format(new Date(user.lastSignInTime), "PPP p")}` 
          : "Never logged in";

      return (
        <div className="flex items-center space-x-3">
          <TooltipProvider>
              <Tooltip>
                  <TooltipTrigger asChild>
                     <div className="cursor-pointer">{avatar}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>{tooltipContent}</p>
                  </TooltipContent>
              </Tooltip>
          </TooltipProvider>
          <div className="flex flex-col">
            <span className="font-medium">
              {user.displayName || "N/A"}
            </span>
             {user.isDeactivated && <Badge variant="destructive" className="w-fit">Deactivated</Badge>}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
        const user = row.original;
        return (
            <div>{user.email}</div>
        )
    }
  },
  {
    accessorKey: "idNumber",
    header: "ID Number",
  },
  {
    accessorKey: "schoolName",
    header: "School",
  },
  {
    accessorKey: "subRegionName",
    header: "Sub-Region",
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
        const role = row.getValue("role") as string;
        if (!role) return null;

        const variant: "default" | "secondary" | "outline" =
          role === "super-admin"
            ? "default"
            : role === "school-head"
            ? "secondary"
            : "outline";

        return (
          <Badge variant={variant} className="capitalize">
            {role.replace("-", " ")}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
  },
  {
    accessorKey: "lastSignInTime",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Login
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const lastSignInTime = row.original.lastSignInTime;
      return lastSignInTime ? format(new Date(lastSignInTime), "PPP p") : "Never";
    },
    filterFn: (row, id, value) => {
      const lastSignInTime = row.original.lastSignInTime;

      if (value.includes("online")) {
          if (!lastSignInTime) return false;
          const now = new Date();
          const lastLoginDate = new Date(lastSignInTime);
          return (now.getTime() - lastLoginDate.getTime()) < 5 * 60 * 1000;
      }
      
      if (value.includes("never")) {
        return !lastSignInTime;
      }

      if (!lastSignInTime) return false;

      const now = new Date();
      const lastLoginDate = new Date(lastSignInTime);

      if (value.includes("7days")) {
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        return lastLoginDate > sevenDaysAgo;
      }
      if (value.includes("30days")) {
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        return lastLoginDate > thirtyDaysAgo;
      }
      if (value.includes("90days")) {
        const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 90));
        return lastLoginDate > ninetyDaysAgo;
      }

      return true;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <UserActions user={row.original} schools={schools} regions={regions} subRegions={subRegions} />;
    },
  },
];
