import { notFound, redirect } from "next/navigation";
import { ListingEditor } from "@/components/dashboard/listing-editor";
import { requireActor } from "@/lib/auth/dal";
import { isEditable } from "@/lib/domain/property-lifecycle";
import { getLocations } from "@/repositories/public-listings";
import { getOwnListing } from "@/repositories/account";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/dashboard/properties/[id]/edit">) {
  await requireActor();
  const { id } = await params;
  const [listing, locations] = await Promise.all([getOwnListing(id), getLocations()]);
  if (!listing) notFound();
  if (!isEditable(listing.status)) redirect(`/dashboard/properties/${id}`);

  return <ListingEditor listing={listing} locations={locations.filter((l) => l.type !== "district")} />;
}
