import { notFound } from "next/navigation";
import { ScrollSyncStudio } from "@/components/three/ScrollSyncStudio";

export default function ScrollSyncPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ScrollSyncStudio />;
}
