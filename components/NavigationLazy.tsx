"use client";

import dynamic from "next/dynamic";

const Navigation = dynamic(
  () => import("@/components/Navigation").then((mod) => mod.Navigation),
  {
    ssr: false,
    loading: () => (
      <div className="hidden h-full w-[78px] shrink-0 border-r border-white/[0.04] bg-[#08090d] md:block" aria-hidden="true" />
    ),
  },
);

export default function NavigationLazy() {
  return <Navigation />;
}
