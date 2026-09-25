"use client";

import { Images } from "lucide-react";
import { useState } from "react";
import { PropertyImage } from "@/components/property/property-image";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { mediaUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

// design.md §16: desktop main image + 4-image grid + "view all"; mobile
// swipeable carousel; image count, full-screen view, lazy loading, fallback.

export interface GalleryImage {
  id: string;
  alt: string;
}

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(0);
  const show = (index: number) => { setStart(index); setOpen(true); };

  const tiles = images.slice(1, 5);

  if (images.length === 0) {
    return <div className="relative aspect-[16/9] overflow-hidden rounded-md"><PropertyImage src={null} alt={title} /></div>;
  }

  return (
    <div>
      {/* Mobile carousel */}
      <div className="md:hidden">
        <Carousel opts={{ loop: images.length > 1 }} aria-label={`${title} photos`}>
          <CarouselContent>
            {images.map((img, i) => (
              <CarouselItem key={img.id}>
                <button type="button" onClick={() => show(i)} className="relative block aspect-[4/3] w-full overflow-hidden rounded-md" aria-label={`Open photo ${i + 1} of ${images.length}`}>
                  <PropertyImage src={mediaUrl(img.id)} alt={img.alt} priority={i === 0} sizes="100vw" />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <p className="mt-2 text-sm text-muted-foreground">{images.length} {images.length === 1 ? "photo" : "photos"} · swipe to browse</p>
      </div>

      {/* Desktop: hero photo + up to four tiles. Tiles re-flow for 1–4 extra
          photos so the grid never shows empty cells; portrait photos are
          cropped to the cell here and shown whole in the viewer. */}
      <div className="relative hidden h-[30rem] gap-2 overflow-hidden rounded-md md:grid md:grid-cols-2">
        <button type="button" onClick={() => show(0)} className="group relative overflow-hidden bg-muted" aria-label={`Open photo 1 of ${images.length}`}>
          <PropertyImage src={mediaUrl(images[0]!.id)} alt={images[0]!.alt} priority sizes="(min-width: 1024px) 50vw, 100vw"
            className="transition-transform duration-500 group-hover:scale-[1.02]" />
        </button>
        {tiles.length > 0 && (
          <div className={cn("grid gap-2", tiles.length === 1 ? "grid-cols-1" : "grid-cols-2", tiles.length > 2 ? "grid-rows-2" : "grid-rows-1")}>
            {tiles.map((img, i) => (
              <button key={img.id} type="button" onClick={() => show(i + 1)} aria-label={`Open photo ${i + 2} of ${images.length}`}
                className={cn("group relative overflow-hidden bg-muted", tiles.length === 3 && i === 0 && "col-span-2")}>
                <PropertyImage src={mediaUrl(img.id, "thumb")} alt={img.alt} sizes="25vw"
                  className="transition-transform duration-500 group-hover:scale-[1.03]" />
              </button>
            ))}
          </div>
        )}
        {images.length > 1 && (
          <Button variant="outline" size="sm" className="absolute bottom-3 right-3 bg-card/95 shadow-sm" onClick={() => show(0)}>
            <Images /> View all {images.length} photos
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl rounded-md p-2 sm:p-4">
          <DialogTitle className="sr-only">{title} — photos</DialogTitle>
          <DialogDescription className="sr-only">Use the arrow buttons or swipe to move between photos.</DialogDescription>
          <Carousel opts={{ startIndex: start, loop: images.length > 1 }}>
            <CarouselContent>
              {images.map((img, i) => (
                <CarouselItem key={img.id}>
                  <div className="relative h-[75dvh] max-h-[48rem] w-full overflow-hidden rounded-md bg-muted">
                    <PropertyImage src={mediaUrl(img.id)} alt={img.alt} className="object-contain" sizes="90vw" />
                  </div>
                  <p className="mt-2 text-center text-sm text-muted-foreground">{i + 1} / {images.length}</p>
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (<><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></>)}
          </Carousel>
        </DialogContent>
      </Dialog>
    </div>
  );
}
