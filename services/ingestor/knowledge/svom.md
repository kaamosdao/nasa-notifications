---
title: SVOM (Space Variable Objects Monitor)
kind: grb
topics: gcn.notices.svom
url: https://gcn.nasa.gov/missions/svom
---

SVOM (Space-based multi-band astronomical Variable Objects Monitor) is a French-Chinese mission of
the China National Space Administration (CNSA) and the French space agency CNES. It was launched
on 22 June 2024, with a planned mission of 3 years. It is dedicated to gamma-ray bursts and other
high-energy transients. Like Swift, it can turn itself toward a new burst on its own and observe
it with its narrow-field instruments.

SVOM carries four instruments:

- **ECLAIRs** — a coded-mask telescope, 4–250 keV, field of view about 2 steradians. It localizes
  bursts to about 10 arcminutes; about 60 bursts per year.
- **Gamma-Ray burst Monitor (GRM)** — 15–5000 keV, field of view about 2.6 steradians. It gives
  only a rough position, about 10 degrees, but detects more bursts, about 130 per year, and
  measures their spectra up to MeV energies.
- **Microchannel X-ray Telescope (MXT)** — 0.2–10 keV, localizes the X-ray afterglow to
  10–100 arcseconds.
- **Visible Telescope (VT)** — optical, localizes the afterglow to about 1 arcsecond.

SVOM alerts reach the ground in under about 30 seconds and are published in VOEvent XML format
on Kafka topics that start with `gcn.notices.svom.voevent`: `grm` (GRM triggers), `eclairs`
(ECLAIRs localizations and slew decisions) and `mxt` (X-ray localizations). A `grm-trigger`
notice arrives about 15 seconds after the trigger and may include a rough position.

SVOM identifies bursts as `sbYYMMDDNN`, for example `sb25061218`. Once a burst is confirmed as a
gamma-ray burst it also gets a standard `GRB YYMMDDX` name, and circulars may use either.

Ground segments in China and France support SVOM with dedicated robotic telescopes for rapid
optical follow-up.
