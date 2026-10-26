import { notFound } from "next/navigation";
import { PosterStudio } from "@/components/three/PosterStudio";

export default function HeroPosterPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PosterStudio />;
}
