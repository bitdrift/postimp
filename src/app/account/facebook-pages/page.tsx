import { Suspense } from "react";
import FacebookPageSelector from "./facebook-page-selector";

export default function FacebookPagesPage() {
  return (
    <Suspense>
      <FacebookPageSelector />
    </Suspense>
  );
}
