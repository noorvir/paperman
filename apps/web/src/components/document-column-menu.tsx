import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import {
  defaultDocumentColumns,
  type DocumentColumns,
} from "@/hooks/use-document-columns";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "./ui/dropdown-menu";

const options: { key: keyof DocumentColumns; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "owners", label: "Owners" },
  { key: "creators", label: "Creator" },
  { key: "tags", label: "Tags" },
  { key: "verification", label: "Verification" },
  { key: "processed", label: "Processed at" },
];

export function DocumentColumnMenu({
  columns,
  onChange,
}: {
  columns: DocumentColumns;
  onChange: (columns: DocumentColumns) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Columns
        <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked disabled>
            Document
          </DropdownMenuCheckboxItem>
          {options.map(({ key, label }) => (
            <DropdownMenuCheckboxItem
              key={key}
              checked={columns[key]}
              closeOnClick={false}
              onCheckedChange={(checked) =>
                onChange({ ...columns, [key]: checked })
              }
            >
              {label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange(defaultDocumentColumns)}>
          Reset columns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
