-- Launch buying guides (editable later in /admin/articles). Plain-text bodies:
-- blank-line paragraphs, "## " headings, "- " bullet lists. Idempotent: an
-- admin's later edits to the same slug are never overwritten.

insert into public.articles (slug, title, excerpt, body, status, seo_title, seo_description, published_at)
values
(
  'documents-to-check-before-buying-land-in-coorg',
  'Documents to check before buying land in Coorg',
  'The RTC, mutation records, encumbrance certificate and title chain: what each one proves and where to get it.',
  $body$Every land deal in Kodagu rests on a handful of records. Ask the seller for copies early, then check them yourself and with an advocate before you pay any advance.

## RTC (Pahani)
The Record of Rights, Tenancy and Crops shows who holds the land, its survey number, extent and the crops grown. You can view it on the Karnataka Bhoomi land records portal using the district, taluk, village and survey number.

- The name on the RTC should match the seller
- The extent should match what is being sold
- Look for any loans, court cases or government claims noted in the columns

## Mutation register
Mutation entries record each change of ownership, such as a sale, inheritance or partition. Read them in order to see how the land reached the current seller.

## Encumbrance certificate (EC)
The EC, issued by the Sub-Registrar's office and available through Kaveri Online, lists registered transactions on the property. Ask for at least the last 30 years. A clean EC means no registered mortgage or sale that the seller has not disclosed.

## Title deeds
Collect the current sale deed and the earlier deeds that link back to the original owner, often called the mother deed. Gaps in this chain are the most common source of disputes.

## Survey sketch
The survey sketch (tippani or phodi) shows the boundaries and shape of the survey number. Have a licensed surveyor match it to the stones and fences on the ground.

## For plots and houses
- Khata or panchayat property record in the seller's name
- Latest property tax receipts
- Land conversion order if the land is used for a house or business
- Approved layout or building plan where one applies

Keep copies of everything you are shown. If a seller will not share a document before an advance, treat that as a warning sign.$body$,
  'published',
  'Documents to check before buying land in Coorg',
  'RTC, mutation, encumbrance certificate, title deeds and survey sketch: the land records to verify before buying property in Kodagu.',
  now() - interval '5 days'
),
(
  'land-measurement-units-acres-guntas-cents',
  'Acres, guntas and cents: land units in Coorg',
  'How land is measured in Kodagu, with quick conversions between acres, guntas, cents, square feet and hectares.',
  $body$Listings in Coorg quote land in acres, guntas or cents, and records sometimes use hectares. The numbers below help you compare prices fairly.

## Quick conversions
- 1 acre = 40 guntas
- 1 acre = 100 cents
- 1 acre = 43,560 sq ft
- 1 gunta = 1,089 sq ft
- 1 cent = 435.6 sq ft
- 1 hectare = 2.471 acres

## Reading an extent
Karnataka records often write extent as acres and guntas, for example 3-20, which means 3 acres and 20 guntas, or 3.5 acres.

## Compare price per unit
A lower total price can hide a higher rate. Divide the price by the area in one unit before you compare two listings. Land in Coorg shows the price per unit on each listing for this reason.

## Check the extent on paper
The area in the advertisement should match the RTC and the survey sketch. If a seller quotes more land than the records show, ask why before going further.$body$,
  'published',
  'Acres, guntas and cents: land units in Coorg',
  'Convert between acres, guntas, cents, square feet and hectares, and read land extents the way Karnataka records write them.',
  now() - interval '4 days'
),
(
  'buying-a-coffee-estate-in-coorg',
  'Buying a coffee estate in Coorg: what to look at',
  'Beyond the price per acre: planted area, yields, water, labour lines and access in the monsoon.',
  $body$A coffee estate is a working farm as well as land. Look at how it has been run, not only at the view.

## Planted area and crop
- How much of the total extent is actually under coffee
- Arabica, Robusta or both, and the age of the plants
- Pepper vines, areca, cardamom or fruit trees that add income
- Shade tree cover and its condition

## Yield history
Ask for the last few years of production and sale records. Compare them with estates of similar size nearby, and ask about any recent drop in yield.

## Water
A perennial stream, tank or borewell matters for irrigation during blossom and for the house. Visit in the dry months to see how much water is really there.

## Buildings and equipment
- Owner's bungalow or farmhouse
- Labour quarters and their condition
- Drying yard, store and pulping unit
- Power connection and its reliability

## Access
Walk the road to the estate. Find out whether it is a public road or passes through a neighbour's land, and whether vehicles can use it through the monsoon.

## Workforce
Ask how many workers the estate needs, who manages it today and whether they will stay after the sale.

Have the land records checked as for any other purchase. See our guide to documents to check before buying land in Coorg.$body$,
  'published',
  'Buying a coffee estate in Coorg: what to check',
  'Planted area, yields, water, labour quarters and monsoon access: a practical checklist for buying a coffee estate in Kodagu.',
  now() - interval '3 days'
),
(
  'agricultural-land-conversion-in-karnataka',
  'Land conversion in Karnataka, explained',
  'When agricultural land needs conversion before you build a home, homestay or shop, and what papers to expect.',
  $body$Most rural land in Coorg is recorded as agricultural. Using it for a house, homestay, resort or shop generally needs a conversion to non-agricultural use.

## Who approves it
Conversion is handled through the Deputy Commissioner's office under the Karnataka Land Revenue Act. The use you apply for must match the local zoning and planning rules.

## What a converted plot should have
- A conversion order that names the survey number and the permitted use
- An RTC that reflects the change
- For a layout, an approved layout plan from the planning authority

## Buying land that is not yet converted
Some buyers purchase agricultural land and apply for conversion afterwards. This can take time and is not guaranteed. Ask an advocate whether the land is eligible before you agree a price that assumes it will be converted.

## Coorg-specific checks
Parts of Kodagu lie close to reserve forests and ecologically sensitive areas in the Western Ghats, where building may be restricted. Kodagu also has older land tenures, such as jamma and bane land, whose history can be complex. Have both looked at before you buy.

Rules change from time to time, so confirm the current process with the taluk office or a local advocate.$body$,
  'published',
  'Land conversion in Karnataka, explained',
  'When agricultural land in Coorg needs conversion for a home, homestay or shop, who approves it, and what papers a converted plot should have.',
  now() - interval '2 days'
),
(
  'visiting-land-in-coorg-site-visit-checklist',
  'Site visit checklist for land in Coorg',
  'What to look at on the ground: boundaries, access, water, slope and drainage, and why a monsoon visit helps.',
  $body$Photos cannot show slope, drainage or how far the road really is. Plan at least one visit before you pay an advance.

## Before you go
- Ask the seller for the survey number and location pin
- Look up the RTC online so you know what to expect
- Arrange for a licensed surveyor if you are serious about the plot

## On the ground
- Walk the boundaries and find the survey stones
- Check the access road, its width and who owns it
- Look at the slope, soil and signs of past landslips
- Find the water source and ask how it holds up in summer
- Check the power line and mobile signal
- Talk to neighbours about boundaries and water sharing

## Visit in the monsoon too
Kodagu gets heavy rain from June to September. A visit during the rains shows how water drains across the land, whether the road stays usable and whether any part of the slope is unstable.

## After the visit
Write down anything that does not match the listing or the records, and raise it with the seller before any money changes hands.$body$,
  'published',
  'Site visit checklist for land in Coorg',
  'Boundaries, access roads, water, slope and drainage: what to check when you visit land or an estate in Kodagu, and why to go in the monsoon.',
  now() - interval '1 day'
)
on conflict (slug) do nothing;
