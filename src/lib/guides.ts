export interface GuideImageInfo {
  src: string;
  alt: string;
}

export const GUIDE_IMAGES: Record<string, GuideImageInfo> = {
  "documents-to-check-before-buying-land-in-coorg": {
    src: "/images/guides/guide-documents-v2.webp",
    alt: "Property documents, RTC Pahani, mutation records and legal title deed in Karnataka",
  },
  "land-measurement-units-acres-guntas-cents": {
    src: "/images/guides/guide-measurements-v2.webp",
    alt: "Acreage, guntas and cents land extent survey map in Coorg",
  },
  "buying-a-coffee-estate-in-coorg": {
    src: "/images/guides/guide-coffee-estate-v2.webp",
    alt: "Ripening Arabica and Robusta coffee cherries on high altitude plantation",
  },
  "agricultural-land-conversion-in-karnataka": {
    src: "/images/guides/guide-conversion-v2.webp",
    alt: "Agricultural farmland conversion order and revenue records",
  },
  "visiting-land-in-coorg-site-visit-checklist": {
    src: "/images/guides/guide-site-visit-v2.webp",
    alt: "Walking plantation boundaries, monsoon drainage and survey stones",
  },
  "understanding-jamma-bane-land-in-coorg": {
    src: "/images/guides/guide-jamma-bane-v2.webp",
    alt: "Traditional Jamma Bane land boundaries, coffee hills and ancient survey stone in Kodagu",
  },
};

export function getGuideImage(slug: string): GuideImageInfo {
  return (
    GUIDE_IMAGES[slug] ?? {
      src: "/images/guides/guide-coffee-estate.webp",
      alt: "Coorg coffee estate and land guide",
    }
  );
}
