import { notFound } from "next/navigation";
import { SceneRecoveryStudio } from "@/components/three/SceneRecoveryStudio";

export default function SceneRecoveryPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SceneRecoveryStudio />;
}
