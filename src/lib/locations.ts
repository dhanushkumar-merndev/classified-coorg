export interface LocationImageInfo {
  src: string;
  alt: string;
}

export const LOCATION_IMAGES: Record<string, LocationImageInfo> = {
  madikeri: {
    src: "/images/locations/madikeri.webp",
    alt: "Madikeri hill station, Raja's Seat viewpoint and mist-covered valleys in Coorg",
  },
  kushalnagar: {
    src: "/images/locations/kushalnagar.webp",
    alt: "Kushalnagar river valley, lush palms and agricultural plains in Coorg",
  },
  virajpet: {
    src: "/images/locations/virajpet.webp",
    alt: "Virajpet coffee estates, pepper plantations and southern Coorg hills",
  },
  somwarpet: {
    src: "/images/locations/somwarpet.webp",
    alt: "Somwarpet high-altitude highland plantations and rolling green knolls",
  },
  gonikoppal: {
    src: "/images/locations/gonikoppal.webp",
    alt: "Gonikoppal coffee estate farm holdings and plantation countryside",
  },
  suntikoppa: {
    src: "/images/locations/suntikoppa.webp",
    alt: "Suntikoppa plantation highway road surrounded by silver oaks and coffee",
  },
  boikere: {
    src: "/images/locations/boikere.webp",
    alt: "Boikere tranquil coffee estates, ancient trees and misty morning slopes",
  },
  napoklu: {
    src: "/images/locations/napoklu.webp",
    alt: "Napoklu traditional Kodagu countryside, Ainmane heritage and river valleys",
  },
};

export function getLocationImage(slug: string): LocationImageInfo {
  return (
    LOCATION_IMAGES[slug] ?? {
      src: "/images/locations/madikeri.webp",
      alt: "Scenic land and estates in Coorg, Karnataka",
    }
  );
}
