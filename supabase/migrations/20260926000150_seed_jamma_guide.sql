-- Seed new comprehensive guide on Jamma and Bane land in Kodagu

insert into public.articles (slug, title, excerpt, body, status, seo_title, seo_description, published_at)
values
(
  'understanding-jamma-bane-land-in-coorg',
  'Understanding Jamma and Bane land in Coorg',
  'The unique land tenures of Kodagu: Jamma privileges, sagu bane, unalienated bane and what you must verify before paying an advance.',
  $body$Kodagu (Coorg) possesses a system of land tenure unlike anywhere else in Karnataka or India. Before buying any property here, every buyer must understand terms like Jamma, Sagu, and Bane—because assuming every piece of land is freehold can lead to severe legal complications.

## What is Jamma land?
Jamma tenure dates back to the Haleri Rajas and was codified under the British Coorg Land and Revenue Regulation. It was originally granted at a concessional assessment (half the standard revenue) to local inhabitants, notably the Kodavas and other indigenous communities, in exchange for military and police service.

- Jamma land is communal or family property held under traditional tenure
- Alienation (selling or transferring) of traditional Jamma land historically required government sanction
- Recent legislative amendments have granted full ownership and alienation rights to certain Jamma holders, but title documents must be thoroughly verified with a local advocate

## What is Bane land?
Bane lands were historically allotted to agricultural holdings (such as paddy wet-lands or Sagu lands) to provide firewood, timber, fencing materials, and cattle grazing. Bane land is typically elevated hill slopes adjacent to wetlands.

There are two critical categories of Bane land:
1. **Alienated / Redeemed Bane**: Bane land where full land assessment (revenue) has been paid to the government and the land has been formally redeemed. Redeemed bane land can be freely bought, sold, mortgaged, and converted for non-agricultural use (subject to standard conversion rules).
2. **Unalienated / Unredeemed Bane**: Bane land where privileged assessment remains, or the land was never formally detached from the parent sagu holding. Selling unredeemed bane land without regularisation or government clearance can lead to transactions being declared invalid.

## Tree rights and timber valuation
In Kodagu, ownership of the soil does not automatically mean ownership of the valuable trees standing on it (such as Rosewood, Teak, and Sandalwood). Tree rights (Maldadi) may belong to the government unless explicitly redeemed.
- Check the RTC to see if tree value was paid to the Forest Department
- Cutting or felling trees on unredeemed land without permission is a serious criminal offense

## Due diligence checklist for Bane land
- Verify whether the land is Sagu Bane or unredeemed Bane in column 9 and 10 of the RTC
- Confirm whether government redemption chalans and orders are on record
- Inspect the family genealogical tree (Vamsha Vruksha) to ensure all family co-parceners have consented
- Obtain a specific legal opinion from a practicing advocate in Madikeri, Virajpet, or Somwarpet who specialises in Kodagu land tenures

Never purchase Bane land based solely on an informal agreement or power of attorney. Insist on clear proof of redemption and marketable title before signing a sale agreement.$body$,
  'published',
  'Understanding Jamma and Bane land in Coorg: Land Tenure Guide',
  'Learn about Jamma land, Sagu Bane, unredeemed bane, tree rights (maldadi) and legal checks before buying plantation land in Kodagu.',
  now() - interval '6 hours'
)
on conflict (slug) do nothing;
