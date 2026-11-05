import { productionDbLabel } from "@/lib/env";

/** Development only: a reminder that this copy of the app can change real writing. */
export function DbWarning() {
  const label = productionDbLabel(process.env);

  return label ? (
    <p role="alert" className="db-warning">
      Careful: connected to {label}
    </p>
  ) : null;
}
