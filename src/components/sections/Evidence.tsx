import networkImage from "@/assets/earbuds/science-network-earbuds-v2.png";
import { site } from "@/config/site";
import { productStory } from "@/config/product-story";
import { StorySection, type StoryModelProps } from "./StorySection";

export function Evidence(props: StoryModelProps) {
  return (
    <StorySection
      {...props}
      id="research-basis"
      headline={productStory.evidence.headline}
      description={productStory.evidence.description}
      image={networkImage}
      imageAlt={`A sculpture wearing a ${site.product} earbud, with an illustrated signal pathway extending from the ear.`}
      imageFirst
      pose="evidence"
    />
  );
}
