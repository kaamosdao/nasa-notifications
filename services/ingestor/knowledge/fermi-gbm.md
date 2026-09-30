---
title: Fermi Gamma-ray Space Telescope and GBM
kind: grb
topics: gcn.classic.text.FERMI, gcn.notices.fermi
url: https://gcn.nasa.gov/missions/fermi
---

The Fermi Gamma-ray Space Telescope is a NASA mission launched on 11 June 2008, built in
partnership with the US Department of Energy and agencies in France, Germany, Italy, Japan and
Sweden. It surveys the whole sky in gamma rays with two instruments:

- **Gamma-ray Burst Monitor (GBM)** — 8 keV to 30 MeV, sees about 8.8 steradians, roughly
  two-thirds of the sky not blocked by Earth. It detects about 240 gamma-ray bursts per year,
  more than any other instrument. Localizations are coarse, from about 1 to 10 degrees, because
  the position is inferred from how brightly the burst lights up detectors facing different
  directions.
- **Large Area Telescope (LAT)** — 20 MeV to more than 300 GeV, field of view 2.5 steradians,
  localizes to about a degree or better. It detects the highest-energy emission from a small
  fraction of bursts.

GBM notices arrive over GCN in stages as the analysis improves:

| Notice | Contents | Latency |
|---|---|---|
| FERMI_GBM_ALERT | Trigger time and basic trigger information | ~5 seconds |
| FERMI_GBM_FLT_POS | On-board localization and classification | ~10 seconds |
| FERMI_GBM_GND_POS | Improved ground localization | 20–300 seconds |
| FERMI_GBM_FIN_POS | Final localization by the automated pipeline | ~15 minutes |
| FERMI_GBM_SUBTHRESH | Weaker signals found by a ground search | 0.5–6 hours |

The on-board software classifies each trigger. Besides gamma-ray bursts, GBM also triggers on
solar flares, bursts from magnetars (soft gamma repeaters), terrestrial gamma-ray flashes from
thunderstorms and charged particles in Earth's radiation belts. Only some triggers are real
bursts.

The large error regions of GBM mean that a burst it detects alone is hard to follow up with
narrow-field telescopes. Its role is to detect bursts quickly and to measure their spectra and
light curves, and to look for gamma-ray counterparts to gravitational-wave and neutrino events.
GBM detected GRB 170817A, the short burst from the neutron-star merger GW170817.

Typical Fermi circulars include GBM identification of a burst (within about 15 minutes), a fuller
GBM analysis with duration and spectrum (a few hours) and LAT reports of high-energy emission.
