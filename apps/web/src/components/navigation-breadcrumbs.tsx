import { Fragment, type ReactElement } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

export type BreadcrumbLocation = {
  id: string;
  label: string;
  link: ReactElement;
};

export function NavigationBreadcrumbs({
  items,
}: {
  items: BreadcrumbLocation[];
}) {
  const collapsed = items.length > 3;

  return (
    <Breadcrumb className="min-w-0" aria-label="Page location">
      <BreadcrumbList className="h-5 flex-nowrap justify-center gap-1.5 leading-5">
        {items.map((item, index) => {
          if (collapsed && index > 1 && index < items.length - 1) {
            return null;
          }
          const isCollapsed = collapsed && index === 1;
          return (
            <Fragment key={item.id}>
              {index > 0 && (
                <BreadcrumbSeparator className="shrink-0">
                  /
                </BreadcrumbSeparator>
              )}
              <BreadcrumbItem
                className={index === 0 || isCollapsed ? "shrink-0" : "min-w-0"}
              >
                {isCollapsed ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" />}
                      className="h-5 px-0.5"
                      aria-label="Show parent pages"
                    >
                      <BreadcrumbEllipsis />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-72 max-w-[calc(100vw-2rem)]"
                    >
                      {items.slice(1, -1).map((parent) => (
                        <DropdownMenuItem key={parent.id} render={parent.link}>
                          <span className="truncate">{parent.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <BreadcrumbLink
                    render={item.link}
                    className="truncate rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={item.label}
                    aria-current={
                      index === items.length - 1 ? "page" : undefined
                    }
                    title={item.label}
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
