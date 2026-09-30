---
title: LIGO, Virgo and KAGRA gravitational-wave alerts
kind: gw
topics: igwn.gwalert
url: https://gcn.nasa.gov/missions/lvk
---

LIGO, Virgo and KAGRA (together "LVK") form the international network of ground-based
gravitational-wave detectors:

- **LIGO** — two 4 km interferometers in Hanford, Washington and Livingston, Louisiana (USA),
  operated with the US National Science Foundation. Detector codes H1 and L1.
- **Virgo** — a 3 km interferometer near Pisa, Italy, operated by the European Gravitational
  Observatory. Detector code V1.
- **KAGRA** — a 3 km underground cryogenic interferometer in Kamioka, Japan. Detector code K1.

LVK publishes public alerts for candidate compact binary mergers and unmodelled bursts on the GCN
Kafka topic `igwn.gwalert`. Each candidate is a **superevent** named `S` + date + letters, for
example `S250206dm`. Alerts for one superevent come in a sequence:

| Alert type | Meaning | Typical latency |
|---|---|---|
| EARLYWARNING | Pre-merger alert for a loud neutron-star signal | before the merger |
| PRELIMINARY | First automated alert with a sky map | 1–10 minutes |
| INITIAL | Human-vetted alert with an improved sky map | 4–24 hours |
| UPDATE | Refined parameters and sky map from offline analysis | days |
| RETRACTION | Candidate judged not astrophysical after human review | 1 hour – 1 day |

Main fields of the alert, which this site summarizes on the card:

- `superevent_id` — the event name.
- `event.time` — merger time (UTC).
- `event.far` — false alarm rate: how often noise alone would produce a candidate this strong. A
  FAR of once per hundred years means the signal is very unlikely to be noise.
- `event.significant` — `true` if the candidate passes the significance threshold for public
  follow-up; low-significance alerts are also published but are more often noise.
- `event.classification` — probabilities that the source is **BNS** (two neutron stars),
  **NSBH** (neutron star and black hole), **BBH** (two black holes) or **Terrestrial** (noise).
- `event.properties` — `HasNS` (probability that at least one object is a neutron star),
  `HasRemnant` (probability that matter was left outside the final black hole, which is needed to
  produce light) and `HasMassGap` (probability that an object falls in the 3–5 solar mass gap
  between known neutron stars and black holes).
- `event.instruments` — detectors that saw the signal, such as H1, L1 and V1.
- `event.skymap` — a multi-order sky map with the probability of the source position.

For follow-up astronomers the most interesting alerts are significant candidates with high `HasNS`
and `HasRemnant`: only they are expected to produce light, such as a kilonova or a short gamma-ray
burst. Binary black hole mergers are much more common but usually have no electromagnetic
counterpart. The LVK team also publishes GCN Circulars for significant candidates: identification,
updated sky localization and retractions.
