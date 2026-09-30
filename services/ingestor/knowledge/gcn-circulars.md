---
title: GCN Circulars and event names
kind: circular
topics: gcn.circulars
url: https://gcn.nasa.gov/circulars
---

GCN Circulars are short, human-written reports about astronomical transients. Anyone registered
with GCN as a professional astronomer can submit one, and they are distributed by email and over
the Kafka topic `gcn.circulars`. Each circular has a sequential number and a permanent page at
`https://gcn.nasa.gov/circulars/<number>`. Since the service started in 1997 more than 40,000
circulars have been published.

A typical circular reports one piece of follow-up work on a single event: a refined position, an
optical or X-ray afterglow detection, an upper limit when nothing was found, a spectrum with a
redshift, or an analysis by a satellite team. Circulars are written quickly and are preliminary by
nature; results are often refined in later circulars and in journal papers. Authors cite earlier
circulars as "GCN <number>".

The subject line of a circular starts with the name of the event. The naming conventions are:

- **GRB YYMMDDX** — a gamma-ray burst, for example `GRB 250706A`. The letter orders bursts
  detected on the same UTC day: A, B, C.
- **S YYMMDD xx** — a LIGO/Virgo/KAGRA gravitational-wave superevent, for example `S250206dm`.
  Circular subjects usually write it as `LIGO/Virgo/KAGRA S250206dm`. The lowercase letters count
  candidates within a day: a…z, then aa, ab and so on.
- **IceCube-YYMMDDX** — a high-energy neutrino alert from IceCube, for example `IceCube-250708A`.
- **EPYYMMDDx** — a transient discovered by the Einstein Probe, for example `EP250227a`.
- **sbYYMMDDNN** — a burst identifier from the SVOM mission, for example `sb25061218`.
- **FRB YYYYMMDDX** — a fast radio burst, for example `FRB 20250316A`.
- **AT YYYYxxx** — a transient registered on the IAU Transient Name Server, typically an optical
  counterpart.

Because every team reports on the same event name, reading all circulars for one name gives the
full history of the event: the discovery, the follow-up observations and the conclusions.
