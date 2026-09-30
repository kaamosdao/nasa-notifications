---
title: Neil Gehrels Swift Observatory
kind: grb
topics: gcn.classic.text.SWIFT, gcn.notices.swift
url: https://gcn.nasa.gov/missions/swift
---

The Neil Gehrels Swift Observatory is a NASA mission launched on 20 November 2004, with
partners in Italy and the United Kingdom. It was built for gamma-ray bursts: it detects a burst
and, within a couple of minutes, turns itself to observe the position in X-rays and
ultraviolet/optical light without waiting for commands from the ground.

Swift carries three instruments:

- **Burst Alert Telescope (BAT)** — 15–350 keV, field of view about 2 steradians. It localizes
  bursts to 1–3 arcminutes and triggers on roughly 80–90 bursts per year.
- **X-ray Telescope (XRT)** — 0.3–10 keV. It finds the X-ray afterglow and gives positions
  accurate to a few arcseconds.
- **UV/Optical Telescope (UVOT)** — 170–650 nm. It detects the optical and ultraviolet
  afterglow in a smaller share of bursts, with sub-arcsecond positions.

Notice types this site shows:

- **SWIFT_BAT_GRB_POS_ACK** — the BAT position for a burst trigger, sent within seconds. It is
  the first accurate position, precise enough for ground telescopes to start observing.
- **gcn.notices.swift.bat.guano** — alerts from GUANO, a ground system that retrieves BAT data
  around other triggers, such as gravitational-wave or Fermi GBM events, and searches for weaker
  bursts that did not trigger on board. Alerts come minutes to hours later. They can include an
  arcminute position, and they can be retracted.

Swift is the backbone of gamma-ray burst follow-up. A typical sequence of Swift circulars for a
burst: identification with the BAT position (about 30 minutes), an enhanced XRT position, UVOT
results, and refined BAT and XRT analyses (about 12 hours). An XRT afterglow position lets large
optical telescopes take a spectrum and measure the redshift. Swift also searches the sky maps of
gravitational-wave events.

Swift was renamed in 2018 in honour of Neil Gehrels, its principal investigator.
