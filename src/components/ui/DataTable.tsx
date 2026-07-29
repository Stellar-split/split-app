"use client";

import React from "react";

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export default function DataTable({
  children,
  className = "",
  containerClassName = "",
}: DataTableProps) {
  return (
    <div
      className={`overflow-x-auto ${containerClassName}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <table className={`min-w-full ${className}`}>{children}</table>
    </div>
  );
}
