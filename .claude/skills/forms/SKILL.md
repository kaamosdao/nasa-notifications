---
name: forms
description: >-
  How to build forms in this project: react-hook-form + Zod (single shared schema) + the shared/ui
  primitives + submission through a Next API route (the mailer handler). Forms are greenfield here —
  the libs are installed but nothing is wired, and there are real traps (Input needs Controller, not bare
  register; @hookform/resolvers isn't installed; the mailer handler isn't routed). Use ALWAYS when building or
  editing a form, contact form, input validation, form submission, react-hook-form/Controller/register,
  Zod form schema — "make a contact form", "add a form", "validate this field", "submit the form".
---

# Forms (react-hook-form + Zod)

**Status: greenfield.** `react-hook-form`, `zod`, `nodemailer`, `axios`, `ky` are in `package.json`,
but there is **no real form in `src/`** — RHF is never called, the mailer handler isn't routed, and
the form Zod schema is a stub. Below is the canonical pattern plus the traps to fix first.

## Setup (one missing dependency)

`@hookform/resolvers` is **not installed** — needed for `zodResolver`:
```bash
pnpm add @hookform/resolvers
```

## One Zod schema, shared FE + server

Today the contact shape is defined **three divergent times** (`mailer.ts` `contactFormSchema`,
`sendEmail.ts` `ContactFormData`, plus stubs). Define it once and import on both sides — validation at
the boundary is required (MR review checks this):
```ts
// e.g. src/shared/api/mailer/schema.ts
import { z } from "zod";
export const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
});
export type ContactForm = z.infer<typeof contactSchema>;
```

## The form

```ts
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactForm } from "@shared/api/mailer/schema";

const { register, handleSubmit, control, formState: { errors, isSubmitting } } =
  useForm<ContactForm>({ resolver: zodResolver(contactSchema) });

const onSubmit = handleSubmit(async (data) => {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  // handle res.ok / error
});
```

## Wiring the primitives (the key trap)

- **`Checkbox` / `Radio`** (`shared/ui`) — spread `...rest` onto the native input, so they work with
  `{...register("field")}` **out of the box** (ref/onChange/name propagate).
- **`Input`** (`shared/ui/input`) works with **`<Controller>`**, not with bare `register()`. Its JSX
  spreads `{...inputProps}` **last**, so props you pass override the internal `value`/`onChange`:
  - `{...register("name")}` alone is **broken** — `register` supplies `onChange`+`ref` but **no `value`**,
    so the internal `value` state (starts empty) freezes the field: typing fires RHF but the input shows nothing.
  - `<Controller render={({ field }) => <Input {...field} />} />` **works** — `field` supplies both `value`
    and `onChange`, which override the internal state (the internal `useState` becomes dead but harmless).
  - Cleaner long-term: drop `Input`'s internal `useState` so `register()` works directly.
- There is **no `Field`/`Form` wrapper** and no `File` input in `shared/ui` — build them if needed.
  Only `Input` has an `error` prop; render `errors.<field>?.message` yourself for checkbox/radio.

## Submission (route the mailer)

The nodemailer pipeline exists (`src/shared/api/mailer/`: `mailer.ts` exports a Next
`handler(req,res)`, `sendEmail.ts`, `createTransporter.ts`), **but it is not a route** — it sits in
`shared/api/`, and `src/pages/api/` only has `preview`/`exit-preview`. Create the route:
```ts
// src/pages/api/contact.ts
export { default } from "@shared/api/mailer/mailer";
```
`sendEmail` needs SMTP env: `SMTP_HOST/PORT/USER/PASSWORD/SECURE`, `SMTP_CONTACT_FORM_EMAIL`.
Validate `req.body` with the **same** `contactSchema` (`.parse` → catch `ZodError` → 400).

There is **no shared HTTP client** (`shared/api/client.ts` doesn't exist; `axios`/`ky` are unused) —
call the route with plain `fetch`.

## Pitfalls

1. **`Input` + bare `register()` is broken** — `register` passes no `value`, so `Input`'s internal `value`
   state freezes the field. Use `<Controller>` (supplies value+onChange, which override the internal state)
   or drop `Input`'s internal `useState`.
2. **`@hookform/resolvers` missing** — `zodResolver` won't import until you `pnpm add` it.
3. **Mailer handler isn't routed** — no `/api/contact` exists; create it, or the form has nowhere to post.
4. **Divergent schemas** — unify the contact shape into one Zod schema used by both the form and the handler.
5. **Validate on the server too** — never trust the client; `.parse` the body in the route.

## Checklist

- [ ] `@hookform/resolvers` installed
- [ ] One shared Zod schema (FE `zodResolver` + server `.parse`)
- [ ] Checkbox/Radio via `register`; text `Input` via `<Controller render={({field}) => <Input {...field}/>}>` (or drop Input's internal state)
- [ ] `src/pages/api/<name>.ts` route created; SMTP env set
- [ ] Errors rendered (`errors.<field>?.message`); submit disabled while `isSubmitting`
- [ ] Server re-validates the body
