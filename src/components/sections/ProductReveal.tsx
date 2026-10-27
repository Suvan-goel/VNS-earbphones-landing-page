import productImage from "@/assets/earbuds/technology-sound-angle.webp";
import { site } from "@/config/site";
import { productStory } from "@/config/product-story";
import { StorySection, type StoryModelProps } from "./StorySection";

export function ProductReveal(props: StoryModelProps) {
  return (
    <StorySection
      {...props}
      id="idea"
      headline={productStory.product.headline}
      description={productStory.product.description}
      image={productImage}
      imageAlt={`A close view of a ${site.brand} earbud, showing its speaker housing and metal contacts.`}
      imageFirst
      pose="product"
    />
  );
}
