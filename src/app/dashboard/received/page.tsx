import { redirect } from "next/navigation";

// Broker model: buyer enquiries go to the Land in Coorg team, not the owner.
// Old links to the seller inbox land on the owner's listings instead.
export default function ReceivedPage() {
  redirect("/dashboard/properties");
}
