import networkImage from "@/assets/earbuds/science-network-earbuds-v2.png";
import { site } from "@/config/site";
import { productStory } from "@/config/product-story";
import { StorySection, type StoryModelProps } from "./StorySection";

export function HowItWorks(props: StoryModelProps) {
  return (
    <StorySection
      {...props}
      id="how-it-works"
      legacyAnchor="science"
      headline={productStory.personalisation.headline}
      description={productStory.personalisation.description}
      image={networkImage}
      imageAlt={`A sculpture wearing a ${site.product} earbud, with an illustrated signal pathway extending from the ear.`}
      pose="personalisation"
    />
  );
}
