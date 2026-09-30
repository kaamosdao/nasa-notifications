---
title: IceCube Neutrino Observatory alerts
kind: neutrino
topics: gcn.notices.icecube, gcn.classic.text.ICECUBE, gcn.classic.text.AMON
url: https://gcn.nasa.gov/missions/icecube
---

The IceCube Neutrino Observatory is a cubic-kilometre neutrino detector built into the Antarctic
ice beneath the Amundsen-Scott South Pole Station and completed in December 2010. It has 86
strings of light sensors frozen into the ice at depths down to about 2,500 metres. It watches the
whole sky, day and night, and has run a real-time alert system since 2016.

**Track alerts (Gold and Bronze).** When IceCube sees a high-energy (TeV–PeV) muon track that is
likely astrophysical, it issues an alert named `IceCube-YYMMDDA`. Alerts are split by how likely
they are to be astrophysical. The field for this is called signalness, or `p_astro` in newer
formats:

- **Gold** — on average about 50% probability of being astrophysical; about 10 per year.
- **Bronze** — on average about 30%; about 16 per year.

So even a Gold alert is roughly a coin flip between a real cosmic neutrino and atmospheric
background. Each alert comes in two steps. A prompt notice (revision 0) arrives within a minute.
A more careful reconstruction (revision 1) follows with an improved position and 90% error region,
typically about a degree across. The revision is accompanied by a GCN Circular that lists known
gamma-ray sources inside the error region. In GCN Classic these are the
`ICECUBE_ASTROTRACK_GOLD` and `ICECUBE_ASTROTRACK_BRONZE` notices; the same alerts are now also
distributed as JSON on Kafka.

Useful fields: `ra`, `dec` and `ra_dec_error` (position and 90% uncertainty in degrees), the
signalness or `p_astro`, the estimated neutrino energy, and the false alarm rate.

**Searches for gravitational-wave neutrinos** (`gcn.notices.icecube.lvk_nu_track_search`). For
every LIGO/Virgo/KAGRA alert, IceCube searches for neutrino tracks within ±500 seconds of the
merger and inside the gravitational-wave sky map. It publishes the result as a notice and repeats
the search for each update of the LVK alert. Almost all of these report no significant
coincidence, which is still useful: it sets an upper limit on neutrino emission from the merger.

The most famous IceCube alert is IceCube-170922A, which arrived during a gamma-ray flare of the
blazar TXS 0506+056. This showed how fast follow-up of a single neutrino can identify a source.
