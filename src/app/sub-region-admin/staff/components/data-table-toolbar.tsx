
"use client";

import { X } from "lucide-react";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/app/super-admin/users/components/data-table-view-options";
import { DataTableFacetedFilter } from "@/app/super-admin/users/components/data-table-faceted-filter";
import { School } from "@/app/super-admin/schools/page";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  schools: School[];
}

const posts = [ "Teacher Aide", "Assistant Teacher", "Teacher", "Senior Teacher 2", "Senior Teacher 1", "Senior Teacher w/o Portfolio", "HOD", "Deputy School Head" ];
const salaryScales = ["B3", "B2", "B1", "C4", "C2", "C1", "D4", "D3", "D2", "D1"];
const qualifications = ["DECCE", "CECCE", "BEd", "Diploma", "+PGDE"];

export function DataTableToolbar<TData>({
  table,
  schools,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  
  const schoolOptions = schools.map(school => ({ label: school.name, value: school.name }));

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter by name..."
          value={(table.getColumn("displayName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("displayName")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("schoolName") && (
          <DataTableFacetedFilter
            column={table.getColumn("schoolName")}
            title="School"
            options={schoolOptions}
          />
        )}
         {table.getColumn("post") && (
          <DataTableFacetedFilter
            column={table.getColumn("post")}
            title="Position"
            options={posts.map(p => ({ label: p, value: p }))}
          />
        )}
        {table.getColumn("qualification") && (
          <DataTableFacetedFilter
            column={table.getColumn("qualification")}
            title="Qualification"
            options={qualifications.map(q => ({ label: q, value: q }))}
          />
        )}
        {table.getColumn("salaryScale") && (
          <DataTableFacetedFilter
            column={table.getColumn("salaryScale")}
            title="Salary Scale"
            options={salaryScales.map(s => ({ label: s, value: s }))}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
