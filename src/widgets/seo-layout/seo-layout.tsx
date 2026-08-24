import type { ReactNode } from "react";
import Head from "next/head";

import type { LinkSocial, Organization } from "@shared/types/strapi-components";

import { Favicons } from "./favicons";
import { LdJson } from "./ld-json";
import { OgTags } from "./og-tags/og-tags";
import type { SeoLayoutDataType } from "./type";

export type SeoLayoutProps = SeoLayoutDataType & {
  children?: ReactNode;
  /** Блок организации из глобальных данных — источник schema.org `Organization`. */
  organization?: Organization | null;
  /** Соцсети из глобальных данных — источник `sameAs`. */
  socials?: LinkSocial[];
};

export const SeoLayout = ({
  commonSeoData,
  pageSeoData,
  organization = null,
  socials = [],
  children,
}: SeoLayoutProps) => {
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
      </Head>
      <OgTags commonSeoData={commonSeoData} pageSeoData={pageSeoData} />
      <Favicons />
      <LdJson
        commonSeoData={commonSeoData}
        pageSeoData={pageSeoData}
        organization={organization}
        socials={socials}
      />

      {children}
    </>
  );
};
