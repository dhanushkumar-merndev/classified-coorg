import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqLd, jsonLd } from "@/lib/seo";

export const COORG_FAQS = [
  {
    question: "Can outsiders or non-agriculturists buy agricultural land and coffee estates in Coorg?",
    answer:
      "Yes. Following amendments to Sections 79A, 79B, and 109 of the Karnataka Land Reforms Act, individuals who are not from farming backgrounds or who reside outside Karnataka can legally purchase agricultural land and coffee plantations in Coorg, subject to ceiling limits and standard title verification.",
  },
  {
    question: "What documents must be verified before buying land or an estate in Kodagu?",
    answer:
      "Crucial land records to inspect include: (1) The latest RTC (Record of Rights, Tenancy and Crops / Pahani) on the Karnataka Bhoomi portal, (2) A 30-year Encumbrance Certificate (EC) from the Kaveri Online portal, (3) Registered Title Deeds (including parent/mother deeds), (4) Mutation Register extracts, (5) Official Survey Sketch (Tippani or Phodi), and (6) Property tax receipts.",
  },
  {
    question: "What is Jamma Bane land in Coorg and can it be bought?",
    answer:
      "Bane lands were historically allotted to agricultural holdings (sagu wet-lands) in Kodagu for grazing and firewood. Only alienated / redeemed Bane land—where full land assessment has been officially regularized with the revenue department and title is clear—can be freely bought, mortgaged, or converted. Unredeemed bane land requires specialized legal scrutiny.",
  },
  {
    question: "What is the typical price per acre of a coffee estate in Coorg?",
    answer:
      "Coffee plantation prices in Coorg generally range from ₹25 Lakhs to ₹1.5+ Crores per acre. Price depends heavily on altitude, Arabica vs. Robusta crop mix, inter-cropped black pepper vine yield, perennial water sources (streams, borewells, lakes), internal road infrastructure, and proximity to major towns like Madikeri, Kushalnagar, and Virajpet.",
  },
  {
    question: "How is land measured in Coorg and Karnataka?",
    answer:
      "Land extent is typically stated in acres, guntas, and cents: 1 acre = 40 guntas = 100 cents (43,560 sq ft). 1 gunta = 1,089 sq ft, and 1 cent = 435.6 sq ft. In official revenue records, an extent written as 3-20 denotes 3 acres and 20 guntas (3.5 acres).",
  },
  {
    question: "Can agricultural land in Coorg be converted for commercial homestay or resort use?",
    answer:
      "Yes, land conversion from agricultural to non-agricultural use (commercial/hospitality) is processed under the Karnataka Land Revenue Act via the Deputy Commissioner's office, subject to local Western Ghats eco-zoning, master plan regulations, and forest proximity clearances.",
  },
];

export function FaqSection({ className }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="faq-heading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(faqLd(COORG_FAQS))}
      />
      <div className="mb-6 space-y-1">
        <h2 id="faq-heading" className="font-display text-2xl md:text-3xl">
          Frequently asked questions
        </h2>
        <p className="text-sm text-muted-foreground">
          Essential answers for buyers considering land, coffee estates, and plots in Kodagu.
        </p>
      </div>
      <Accordion type="single" collapsible className="w-full rounded-xl border bg-card p-6 shadow-xs">
        {COORG_FAQS.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="border-b last:border-b-0 py-1">
            <AccordionTrigger className="text-left font-semibold text-base hover:text-primary transition-colors">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pt-1 pb-3">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
