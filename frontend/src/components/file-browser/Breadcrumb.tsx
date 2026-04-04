import React from "react";
import type { ReactNode } from "react";
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  itemCount: number;
  loading: boolean;
  isAdmin: boolean;
  uploadSlot: ReactNode;
}

export default function Breadcrumb({
  currentPath,
  onNavigate,
  itemCount,
  loading,
  isAdmin,
  uploadSlot,
}: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-muted/50 rounded-md font-mono text-sm">
      <ShadcnBreadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => onNavigate("/")}
              className="cursor-pointer"
            >
              /
            </BreadcrumbLink>
          </BreadcrumbItem>
          {currentPath.split("/").filter(Boolean).map((seg, i, arr) => {
            const path = "/" + arr.slice(0, i + 1).join("/");
            const isLast = i === arr.length - 1;
            return (
              <React.Fragment key={path}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="font-semibold">{seg}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => onNavigate(path)}
                      className="cursor-pointer"
                    >
                      {seg}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </ShadcnBreadcrumb>
      <span className="ml-auto flex items-center gap-4">
        <span className="text-muted-foreground text-xs font-sans">
          {!loading && `${itemCount} items`}
        </span>
        {isAdmin && uploadSlot}
      </span>
    </div>
  );
}
