import React from "react";

export default function UnavailableDataPage({ title, message, className = "" }) {
  return (
    <section className={className}>
      <div className="tenant-data-state">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </section>
  );
}
