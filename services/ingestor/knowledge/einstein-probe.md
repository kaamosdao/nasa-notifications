---
title: Einstein Probe
kind: grb
topics: gcn.notices.einstein_probe
url: https://gcn.nasa.gov/missions/einstein-probe
---

The Einstein Probe (EP) is an X-ray mission of the Chinese Academy of Sciences, in
collaboration with the European Space Agency and the Max Planck Institute for Extraterrestrial
Physics (Germany). It was launched on 9 January 2024, with a planned mission of 3 years and a goal
of 5. Its purpose is to find new and fading X-ray transients and to monitor variable objects.

EP carries two instruments:

- **Wide-field X-ray Telescope (WXT)** — 0.5–4 keV, with an enormous field of view of about 3,600
  square degrees. It uses "lobster-eye" micro-pore optics, inspired by the eyes of lobsters, to
  focus X-rays over a very wide field. Localization is about 2 arcminutes.
- **Follow-up X-ray Telescope (FXT)** — 0.5–10 keV, a narrow-field telescope that refines positions
  to about 5–15 arcseconds.

WXT alerts are published on the Kafka topic `gcn.notices.einstein_probe.wxt.alert` within about a
minute. They report the position, count rate and detection significance. WXT issues roughly 100
alerts per year, covering gamma-ray bursts, other X-ray transients and some non-astrophysical
triggers.

Transients discovered by EP are named `EPYYMMDDa`, for example `EP250227a`. Many are **fast X-ray
transients**: bright X-ray flashes lasting minutes to hours. Some turn out to be gamma-ray bursts
seen in soft X-rays, some are bursts too faint or too soft for gamma-ray instruments, and some are
flares from stars in our own Galaxy. Working out which is which needs quick follow-up: optical
spectroscopy for a redshift, a search for simultaneous gamma-rays, and radio observations. That
follow-up is reported in GCN Circulars under the EP name.
