---
title: GCN: the General Coordinates Network
url: https://gcn.nasa.gov/docs
---

The General Coordinates Network (GCN) is NASA's public service for sharing alerts about
high-energy and multi-messenger transients: gamma-ray bursts, gravitational-wave events,
high-energy neutrinos, X-ray transients and fast radio bursts. Its purpose is speed. Many of
these events fade within minutes to days, so telescopes around the world need to learn about
them as quickly as possible to point at the right part of the sky.

GCN distributes two kinds of messages.

**Notices** are machine-generated and arrive within seconds to minutes of a detection. They
carry structured data: the time of the event, a sky position with an error radius or a
probability sky map, and instrument-specific measurements such as brightness, significance or
classification. Notices are produced automatically by spacecraft and detector pipelines, often
before any human has looked at the data, so early notices can later be updated or retracted.

**Circulars** are short reports written by scientists. They describe follow-up observations,
refined analyses, detections or non-detections of counterparts, redshift measurements and
classifications. Circulars are how the community coordinates the study of a single event, and
each one is permanently archived and citable.

Modern GCN delivers notices and circulars through Apache Kafka topics. Topic names describe the
source, for example `igwn.gwalert` for LIGO/Virgo/KAGRA gravitational-wave alerts,
`gcn.circulars` for circulars and `gcn.classic.text.FERMI_GBM_FIN_POS` for a notice type from the
older "GCN Classic" system that is still relayed over Kafka.

Most follow-up campaigns follow the same pattern: a wide-field instrument detects a transient and
issues a notice; narrow-field telescopes observe the reported region; results are shared in
circulars; and the combined observations reveal what the source was and how far away it is.
