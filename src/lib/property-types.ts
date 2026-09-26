export interface PropertyTypeImageInfo {
  src: string;
  alt: string;
}

export const PROPERTY_TYPE_IMAGES: Record<string, PropertyTypeImageInfo> = {
  coffee_estate: {
    src: "/images/property-types/coffee-estate.webp",
    alt: "Coffee estate plantations in Coorg with shade trees and pepper vines",
  },
  agricultural_land: {
    src: "/images/property-types/agricultural-land.webp",
    alt: "Agricultural farmland, paddy terraces and arecanut groves in Coorg",
  },
  farm_land: {
    src: "/images/property-types/farm-land.webp",
    alt: "Scenic farm land holding with orchards and mountain views in Kodagu",
  },
  residential_plot: {
    src: "/images/property-types/residential-plot.webp",
    alt: "Demarcated residential layout plot ready for building in Coorg",
  },
  commercial_land: {
    src: "/images/property-types/commercial-land.webp",
    alt: "Highway-facing commercial land parcel in Coorg for resort or retail",
  },
  house_villa: {
    src: "/images/property-types/house-villa.webp",
    alt: "Traditional Kodagu estate bungalow and luxury hill villa in Coorg",
  },
  homestay_resort: {
    src: "/images/property-types/homestay-resort.webp",
    alt: "Boutique homestay resort cottages in Coorg amidst misty hills",
  },
  other: {
    src: "/images/property-types/other.webp",
    alt: "Forest-edge highlands and scenic nature land in Western Ghats",
  },
};

export function getPropertyTypeImage(type: string): PropertyTypeImageInfo {
  return (
    PROPERTY_TYPE_IMAGES[type] ?? {
      src: "/images/property-types/coffee-estate.webp",
      alt: "Properties in Coorg",
    }
  );
}
