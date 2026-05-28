"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export function MobileFAB() {
  const [imageError, setImageError] = useState(false);

  return (
    <Link href="/?create=true" className="mobile-fab">
      <span className="mobile-fab-icon">
        {imageError ? (
          "+"
        ) : (
          <Image
            src="/assets/icons/icon-plus-orange.svg"
            alt="Create"
            width={24}
            height={24}
            onError={() => setImageError(true)}
          />
        )}
      </span>
    </Link>
  );
}
