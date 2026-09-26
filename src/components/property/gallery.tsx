"use client";

import { Images, Maximize2 } from "lucide-react";
import { useState } from "react";
import { PropertyImage } from "@/components/property/property-image";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { mediaUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  id: string;
  alt: string;
}

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const show = (index: number) => {
    setStart(index);
    setCurrent(index);
    setOpen(true);
    if (api) api.scrollTo(index);
  };

  // We display up to 4 images in the desktop preview (1 hero on left + 3 on right)
  const displayLimit = 4;
  const tiles = images.slice(1, displayLimit);
  const extraCount = images.length - displayLimit;

  if (images.length === 0) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-muted">
        <PropertyImage src={null} alt={title} />
      </div>
    );
  }

  return (
    <div>
      {/* Mobile carousel */}
      <div className="md:hidden">
        <Carousel opts={{ loop: images.length > 1 }} aria-label={`${title} photos`}>
          <CarouselContent>
            {images.map((img, i) => (
              <CarouselItem key={img.id}>
                <button
                  type="button"
                  onClick={() => show(i)}
                  className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl select-none"
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={`Open photo ${i + 1} of ${images.length}`}
                >
                  <PropertyImage src={mediaUrl(img.id)} alt={img.alt} priority={i === 0} sizes="100vw" />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <p className="mt-2 text-sm text-muted-foreground">
          {images.length} {images.length === 1 ? "photo" : "photos"} · swipe to browse
        </p>
      </div>

      {/* Desktop Grid: 1 Hero + up to 3 tiles on right */}
      <div
        className="relative hidden h-[32rem] gap-2.5 overflow-hidden rounded-xl md:grid md:grid-cols-2 select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Main Hero Photo (Left) */}
        <button
          type="button"
          onClick={() => show(0)}
          className="group relative h-full overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Open photo 1 of ${images.length}`}
        >
          <PropertyImage
            src={mediaUrl(images[0]!.id)}
            alt={images[0]!.alt}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        </button>

        {/* Right side tiles */}
        {tiles.length > 0 && (
          <div
            className={cn(
              "grid gap-2.5 h-full",
              tiles.length === 1 ? "grid-cols-1" : "grid-cols-2",
              tiles.length > 2 ? "grid-rows-2" : "grid-rows-1"
            )}
          >
            {tiles.map((img, i) => {
              const photoIndex = i + 1;
              const isLastTile = i === tiles.length - 1;
              const hasMore = isLastTile && extraCount > 0;

              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => show(photoIndex)}
                  aria-label={`Open photo ${photoIndex + 1} of ${images.length}`}
                  className={cn(
                    "group relative overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    tiles.length === 3 && i === 0 && "col-span-2"
                  )}
                >
                  <PropertyImage
                    src={mediaUrl(img.id, "thumb")}
                    alt={img.alt}
                    sizes="25vw"
                    className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />

                  {/* If there are 5 or more images, the last tile shows the "+N more" overlay */}
                  {hasMore && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-[2px] transition-colors group-hover:bg-black/70">
                      <span className="text-2xl font-bold">+{extraCount}</span>
                      <span className="text-xs font-medium tracking-wide uppercase">See more</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom-right action button */}
        {images.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-3 right-3 bg-card/95 backdrop-blur-md shadow-md hover:bg-card text-xs font-semibold gap-1.5"
            onClick={() => show(0)}
          >
            {extraCount > 0 ? (
              <>
                <Images className="size-3.5" /> See all {images.length} photos (+{extraCount} more)
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" /> View all {images.length} photos
              </>
            )}
          </Button>
        )}
      </div>

      {/* Fullscreen Lightbox Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="!fixed !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[96vw] !max-w-7xl !h-[92vh] !max-h-[94vh] sm:!max-w-[96vw] p-4 sm:p-6 bg-background/98 backdrop-blur-xl border rounded-2xl flex flex-col justify-between overflow-hidden shadow-2xl select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          <DialogTitle className="text-base font-semibold truncate pr-10 flex items-center justify-between">
            <span className="truncate">{title}</span>
            <span className="text-xs font-normal text-muted-foreground mr-6">
              {current + 1} / {images.length}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            High-resolution full-screen gallery. Use arrows or thumbnails to navigate.
          </DialogDescription>

          {/* Main Full-Size Image Carousel */}
          <div className="relative flex-1 w-full my-2 flex items-center justify-center min-h-0 overflow-hidden">
            <Carousel
              setApi={(c) => {
                setApi(c);
                if (c) {
                  c.on("select", () => setCurrent(c.selectedScrollSnap()));
                }
              }}
              opts={{ startIndex: start, loop: images.length > 1 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <CarouselContent className="h-full">
                {images.map((img) => (
                  <CarouselItem key={img.id} className="h-full flex items-center justify-center">
                    <div className="relative w-full h-[66vh] md:h-[72vh] flex items-center justify-center overflow-hidden rounded-xl bg-black/5 dark:bg-black/30">
                      <PropertyImage
                        src={mediaUrl(img.id)}
                        alt={img.alt}
                        className="object-contain"
                        sizes="95vw"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 && (
                <>
                  <CarouselPrevious className="left-3 size-10 bg-background/80 hover:bg-background shadow-lg border" />
                  <CarouselNext className="right-3 size-10 bg-background/80 hover:bg-background shadow-lg border" />
                </>
              )}
            </Carousel>
          </div>

          {/* Bottom Filmstrip Thumbnails */}
          {images.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 no-scrollbar">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setCurrent(i);
                    api?.scrollTo(i);
                  }}
                  className={cn(
                    "relative size-14 shrink-0 overflow-hidden rounded-md border-2 transition-all",
                    current === i ? "border-primary ring-2 ring-primary/30 scale-105" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                  aria-label={`Jump to photo ${i + 1}`}
                >
                  <PropertyImage src={mediaUrl(img.id, "thumb")} alt="" sizes="60px" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
